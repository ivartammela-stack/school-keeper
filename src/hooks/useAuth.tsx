import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// DEMO MODE - set to false to enable real authentication
const DEMO_MODE = false;

type AppRole = 'teacher' | 'admin' | 'maintenance' | 'leadership' | 'safety_officer';

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_ROLES: AppRole[] = ['teacher', 'admin', 'maintenance', 'leadership', 'safety_officer'];

// Mock user object for demo mode
const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@kooli.ee',
  aud: 'authenticated',
  role: 'authenticated',
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: { full_name: 'Demo Kasutaja' },
} as User;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_MODE ? DEMO_USER : null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(DEMO_MODE ? DEMO_ROLES : []);
  const [loading, setLoading] = useState(!DEMO_MODE);

  useEffect(() => {
    // Skip auth setup in demo mode
    if (DEMO_MODE) {
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRoles(session.user.id);
          }, 0);
        } else {
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      if (error) throw error;
      setRoles((data || []).map(r => r.role as AppRole));
    } catch (error) {
      logger.error('Error fetching user roles', error);
      setRoles([]);
    }
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl }
    });
  };

  const signInWithMicrosoft = async () => {
    const redirectUrl = `${window.location.origin}/`;
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { 
        redirectTo: redirectUrl,
        scopes: 'email profile openid'
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some(r => roles.includes(r));

  return (
    <AuthContext.Provider value={{
      user,
      session,
      roles,
      loading,
      signInWithGoogle,
      signInWithMicrosoft,
      signOut,
      hasRole,
      hasAnyRole,
      isDemo: DEMO_MODE,
    }}>
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
