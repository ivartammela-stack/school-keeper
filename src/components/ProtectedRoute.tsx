import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

type AppRole = 'teacher' | 'admin' | 'maintenance' | 'leadership' | 'safety_officer';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles: AppRole[];
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { hasAnyRole, loading, isDemo } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  
  // Allow all access in demo mode
  if (isDemo) {
    return <>{children}</>;
  }
  
  if (!hasAnyRole(requiredRoles)) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return <>{children}</>;
}
