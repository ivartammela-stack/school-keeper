import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, LogOut, Moon, Sun, Mail, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

const roleLabels: Record<string, string> = {
  teacher: 'Õpetaja',
  safety_officer: 'Töökeskkonnavolinik',
  director: 'Direktor',
  worker: 'Töömees',
  facility_manager: 'Majandusjuhataja',
  admin: 'Admin',
};

const roleColors: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  safety_officer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  director: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  worker: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  facility_manager: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function Profile() {
  const { user, roles, signOut } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/auth';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Profiil</h1>
      </div>

      {/* User Info */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
            <User className="h-8 w-8 text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg">
              {user?.user_metadata?.full_name || 'Kasutaja'}
            </p>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-sm">{user?.email}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Roles */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Rollid</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {roles.length > 0 ? (
            roles.map(role => (
              <Badge key={role} className={roleColors[role]}>
                {roleLabels[role] || role}
              </Badge>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">Rolle pole määratud</p>
          )}
        </div>
      </Card>

      {/* Settings */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Seaded</h2>
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? (
              <Moon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Sun className="h-5 w-5 text-muted-foreground" />
            )}
            <Label htmlFor="theme-toggle" className="cursor-pointer">
              Tume teema
            </Label>
          </div>
          <Switch
            id="theme-toggle"
            checked={isDark}
            onCheckedChange={toggleTheme}
          />
        </div>
      </Card>

      {/* Logout Button */}
      <Button 
        onClick={handleSignOut}
        variant="destructive" 
        className="w-full"
        size="lg"
      >
        <LogOut className="h-5 w-5 mr-2" />
        Logi välja
      </Button>
    </div>
  );
}
