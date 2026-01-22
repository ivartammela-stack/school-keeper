import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  signOut as firebaseSignOut,
  getUserClaims,
} from '@/lib/firebase-auth';
import { getUser, createUser, getSchools, getSchool, updateUser, initializeSchoolLookups } from '@/lib/firestore';
import { logger } from '@/lib/logger';
import { initializePushNotifications, unregisterPushNotifications } from '@/lib/push-notifications';
import type { AppRole, User } from '@/lib/firebase-types';

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
  roles: AppRole[];
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isDemo: boolean;
  schoolId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(DEMO_MODE ? DEMO_FIREBASE_USER : null);
  const [profile, setProfile] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(DEMO_MODE ? DEMO_ROLES : []);
  const [loading, setLoading] = useState(!DEMO_MODE);
  const [schoolId, setSchoolId] = useState<string | null>(null);

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
          let [userProfile, claims] = await Promise.all([
            getUser(firebaseUser.uid),
            getUserClaims(),
          ]);

          if (!userProfile) {
            await createUser(firebaseUser.uid, {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              full_name: firebaseUser.displayName || null,
              avatar_url: firebaseUser.photoURL || null,
              school_id: null,
              created_at: new Date(),
            });
            userProfile = await getUser(firebaseUser.uid);
          }

          // Sync role from claims into Firestore if needed
          const profileRole = userProfile?.role || null;
          const claimsRole = claims?.role || null;

          if (!profileRole && claimsRole) {
            try {
              await updateUser(firebaseUser.uid, { role: claimsRole });
              userProfile = await getUser(firebaseUser.uid);
            } catch (error) {
              logger.warn('Failed to sync Firestore role from claims', error);
            }
          }

          // Validate and fix school_id for admin users
          let validSchoolId = userProfile?.school_id || claims?.school_id || null;

          if (validSchoolId) {
            // Check if the school actually exists
            const school = await getSchool(validSchoolId);
            if (!school) {
              logger.warn('User school_id does not exist, will reassign', { school_id: validSchoolId });
              validSchoolId = null;
            }
          }

          // Auto-assign school when missing (single-school safe default)
          const isAdmin = userProfile?.role === 'admin' || claims?.role === 'admin';
          if (!validSchoolId) {
            try {
              const schools = await getSchools();
              if (schools.length === 1) {
                validSchoolId = schools[0].id;
                await updateUser(firebaseUser.uid, { school_id: validSchoolId });
                userProfile = await getUser(firebaseUser.uid);
                logger.info('Auto-assigned school to user', { school_id: validSchoolId });
              } else if (isAdmin && schools.length > 0) {
                validSchoolId = schools[0].id;
                await updateUser(firebaseUser.uid, { school_id: validSchoolId });
                userProfile = await getUser(firebaseUser.uid);
                logger.info('Auto-assigned school to admin', { school_id: validSchoolId });
              }
            } catch (error) {
              logger.warn('Failed to auto-assign school', error);
            }
          }

          setProfile(userProfile);
          setSchoolId(validSchoolId);

          // Initialize lookups for admin users (creates default categories/problem types)
          if (validSchoolId && isAdmin) {
            try {
              const initialized = await initializeSchoolLookups(validSchoolId);
              if (initialized) {
                logger.info('Initialized default lookups for school', { school_id: validSchoolId });
              }
            } catch (error) {
              logger.warn('Failed to initialize lookups', error);
            }
          }

          // Prefer roles from profile (Firestore), fallback to single role or claims
          if (userProfile?.roles && userProfile.roles.length > 0) {
            setRoles(userProfile.roles);
          } else if (userProfile?.role) {
            setRoles([userProfile.role]);
          } else if (claims?.role) {
            setRoles([claims.role]);
          } else {
            setRoles([]);
          }

          // Initialize push notifications for logged in user
          initializePushNotifications(firebaseUser.uid);
        } catch (error) {
          console.error('Error fetching user data', error);
          logger.error('Error fetching user data', error);
          setRoles([]);
          setProfile(null);
        }
      } else {
        setRoles([]);
        setProfile(null);
        setSchoolId(null);
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
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some((r) => roles.includes(r));

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        loading,
        signUp,
        signIn,
        signOut,
        hasRole,
        hasAnyRole,
        isDemo: DEMO_MODE,
        schoolId,
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
