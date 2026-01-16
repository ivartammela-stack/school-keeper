import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Mail, Lock, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'signin' | 'signup' | 'forgot-password' | 'reset-password';

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading && mode !== 'reset-password') {
      navigate('/');
    }
  }, [user, loading, navigate, mode]);

  // Check for password recovery event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = async () => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('See email on juba registreeritud. Proovi sisse logida.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Konto loodud! Oota administraatori kinnitust.');
    }
  };

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Vale email või parool');
      } else {
        toast.error(error.message);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Palun sisesta oma email');
      return;
    }

    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Parooli lähtestamise link saadeti emailile!');
      setMode('signin');
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Parool peab olema vähemalt 6 tähemärki');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Parool on edukalt muudetud!');
      setMode('signin');
      navigate('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      switch (mode) {
        case 'signup':
          await handleSignUp();
          break;
        case 'signin':
          await handleSignIn();
          break;
        case 'forgot-password':
          await handleForgotPassword();
          break;
        case 'reset-password':
          await handleResetPassword();
          break;
      }
    } catch (error: any) {
      toast.error(error.message || 'Midagi läks valesti');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case 'signup': return 'Loo uus konto';
      case 'signin': return 'Logi oma kontole sisse';
      case 'forgot-password': return 'Lähtesta parool';
      case 'reset-password': return 'Sisesta uus parool';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'signup': return 'Registreeru';
      case 'signin': return 'Logi sisse';
      case 'forgot-password': return 'Saada lähtestamise link';
      case 'reset-password': return 'Salvesta uus parool';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-xl p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-500 text-white mb-4">
              <Building2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Kooli Hooldus
            </h1>
            <p className="text-muted-foreground">
              {getTitle()}
            </p>
          </div>

          {/* Back button for forgot password and reset password */}
          {(mode === 'forgot-password' || mode === 'reset-password') && (
            <Button
              type="button"
              variant="ghost"
              className="gap-2"
              onClick={() => setMode('signin')}
            >
              <ArrowLeft className="h-4 w-4" />
              Tagasi sisselogimisse
            </Button>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Täisnimi</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Mari Maasikas"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {mode !== 'reset-password' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="mari@kool.ee"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'signin' || mode === 'signup') && (
              <div className="space-y-2">
                <Label htmlFor="password">Parool</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {mode === 'reset-password' && (
              <div className="space-y-2">
                <Label htmlFor="newPassword">Uus parool</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {/* Forgot password link */}
            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
                >
                  Unustasid parooli?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-orange-500 hover:bg-orange-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                getButtonText()
              )}
            </Button>
          </form>

          {/* Toggle Sign Up / Sign In */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {mode === 'signin' ? (
                  <>Pole veel kontot? <span className="text-orange-500 font-medium">Registreeru</span></>
                ) : (
                  <>Sul on juba konto? <span className="text-orange-500 font-medium">Logi sisse</span></>
                )}
              </button>
            </div>
          )}

          {/* Footer */}
          {mode === 'signup' && (
            <p className="text-center text-xs text-muted-foreground pt-2">
              Registreerudes nõustud kasutustingimustega
            </p>
          )}
        </div>
      </div>
    </div>
  );
}