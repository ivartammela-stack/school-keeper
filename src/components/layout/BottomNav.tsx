import { NavLink, useLocation } from 'react-router-dom';
import { PlusCircle, ClipboardList, Wrench, ShieldAlert, BarChart3, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { path: '/submit', label: 'Teavita', icon: PlusCircle, roles: ['teacher', 'safety_officer', 'director', 'worker', 'facility_manager', 'admin'] },
  { path: '/my-tickets', label: 'Minu teated', icon: ClipboardList, roles: ['teacher', 'safety_officer', 'director', 'worker', 'facility_manager', 'admin'] },
  { path: '/work', label: 'Tööd', icon: Wrench, roles: ['admin', 'worker', 'facility_manager'] },
  { path: '/safety', label: 'Ohutus', icon: ShieldAlert, roles: ['admin', 'safety_officer'] },
  { path: '/overview', label: 'Ülevaade', icon: BarChart3, roles: ['admin', 'director'] },
  { path: '/admin', label: 'Haldus', icon: Settings, roles: ['admin'] },
  { path: '/profile', label: 'Profiil', icon: User, roles: ['teacher', 'safety_officer', 'director', 'worker', 'facility_manager', 'admin'] },
];

export function BottomNav() {
  const location = useLocation();
  const { hasAnyRole } = useAuth();

  const visibleItems = navItems.filter(item => 
    hasAnyRole(item.roles as any[])
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex justify-around items-center h-16 px-1">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full py-1.5 transition-colors min-w-0",
                isActive 
                  ? "text-orange-500" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 flex-shrink-0", isActive && "stroke-[2.5]")} />
              <span className="text-[9px] leading-none font-medium truncate max-w-full px-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
