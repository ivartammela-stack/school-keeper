import { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, loading, roles, isDemo } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // Skip auth checks in demo mode
  if (!isDemo) {
    if (!user) {
      return <Navigate to="/auth" replace />;
    }

    // Show waiting screen if user has no roles assigned yet
    if (roles.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4">
            <div className="text-6xl">🎓</div>
            <h2 className="text-xl font-semibold">Ootame administraatori kinnitust</h2>
            <p className="text-muted-foreground max-w-sm">
              Sinu konto on loodud, kuid administraator peab sulle rolli määrama.
            </p>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="container mx-auto px-4 py-4 max-w-lg">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
