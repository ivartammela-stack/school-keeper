import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  signOut as firebaseSignOut,
} from '@/lib/firebase-auth';
import {
  getUser,
  createUser,
  updateUser,
  getUserMemberships,
  getSchool,
  setActiveSchool,
  initializeGlobalCatalogs,
  updateSchoolMember,
} from '@/lib/firestore';
import { logger } from '@/lib/logger';
import { initializePushNotifications, unregisterPushNotifications } from '@/lib/push-notifications';
import type { AppRole, User, School, SchoolMember } from '@/lib/firebase-types';

// DEMO MODE - set to false to enable real authentication
const DEMO_MODE = false;

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ROLES: AppRole[] = ['teacher', 'safety_officer', 'director', 'worker', 'facility_manager', 'admin'];

// Mock user object for demo mode
const DEMO_FIREBASE_USER = {
  uid: DEMO_USER_ID,
  email: 'demo@kooli.ee',
  displayName: 'Demo Kasutaja',
} as FirebaseUser;

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  memberships: SchoolMember[];
  schools: School[];
  activeMembership: SchoolMember | null;
  roles: AppRole[];
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isDemo: boolean;
  schoolId: string | null;
  setActiveSchoolId: (schoolId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(DEMO_MODE ? DEMO_FIREBASE_USER : null);
  const [profile, setProfile] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(DEMO_MODE ? DEMO_ROLES : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<SchoolMember[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [activeMembership, setActiveMembership] = useState<SchoolMember | null>(null);

  useEffect(() => {
    // Skip auth setup in demo mode
    if (DEMO_MODE) {
      return;
    }

    // Set up auth state listener
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Fetch user profile and roles
        try {
          let userProfile = await getUser(firebaseUser.uid);

          if (!userProfile) {
            await createUser(firebaseUser.uid, {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              full_name: firebaseUser.displayName || null,
              avatar_url: firebaseUser.photoURL || null,
              active_school_id: null,
              created_at: new Date(),
            });
            userProfile = await getUser(firebaseUser.uid);
          }

          const memberList = await getUserMemberships(firebaseUser.uid);
          setMemberships(memberList);

          const activeSchoolId = userProfile?.active_school_id || null;
          let active = activeSchoolId
            ? memberList.find((m) => m.school_id === activeSchoolId && m.status === 'active')
            : null;

          if (!active) {
            const activeMembers = memberList.filter((m) => m.status === 'active');
            if (activeMembers.length === 1) {
              active = activeMembers[0];
              await setActiveSchool(firebaseUser.uid, active.school_id);
              userProfile = await getUser(firebaseUser.uid);
            } else {
              active = null;
            }
          }

          setProfile(userProfile);
          setActiveMembership(active);
          setSchoolId(active?.school_id || null);
          setRoles(active?.roles || []);

          const schoolSnapshots = await Promise.all(
            memberList.map((m) => getSchool(m.school_id))
          );
          setSchools(schoolSnapshots.filter(Boolean) as School[]);

          try {
            await initializeGlobalCatalogs();
          } catch (error) {
            logger.warn('Failed to initialize global catalogs', error);
          }

          // Sync profile fields to membership docs (safe fields only)
          const profilePayload = {
            email: userProfile?.email || null,
            full_name: userProfile?.full_name || null,
            avatar_url: userProfile?.avatar_url || null,
          };
          await Promise.all(
            memberList.map((m) =>
              updateSchoolMember(m.school_id, firebaseUser.uid, profilePayload)
            )
          );

          // Initialize push notifications for logged in user
          initializePushNotifications(firebaseUser.uid);
        } catch (error) {
          console.error('Error fetching user data', error);
          logger.error('Error fetching user data', error);
          setRoles([]);
          setProfile(null);
          setMemberships([]);
          setSchools([]);
          setActiveMembership(null);
        }
      } else {
        setRoles([]);
        setProfile(null);
        setSchoolId(null);
        setMemberships([]);
        setSchools([]);
        setActiveMembership(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await signUpWithEmail(email, password, fullName);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmail(email, password);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    // Unregister push notifications before signing out
    if (user) {
      await unregisterPushNotifications(user.uid);
    }
    await firebaseSignOut();
    setRoles([]);
    setProfile(null);
    setSchoolId(null);
    setMemberships([]);
    setSchools([]);
    setActiveMembership(null);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some((r) => roles.includes(r));

  const setActiveSchoolId = async (nextSchoolId: string | null) => {
    if (!user) return;
    await setActiveSchool(user.uid, nextSchoolId);
    setSchoolId(nextSchoolId);
    setProfile((prev) => (prev ? { ...prev, active_school_id: nextSchoolId } : prev));
    const nextMember = memberships.find((m) => m.school_id === nextSchoolId) || null;
    setActiveMembership(nextMember);
    setRoles(nextMember?.roles || []);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        memberships,
        schools,
        activeMembership,
        roles,
        loading,
        signUp,
        signIn,
        signOut,
        hasRole,
        hasAnyRole,
        isDemo: DEMO_MODE,
        schoolId,
        setActiveSchoolId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
