import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Shield, School, Check, X } from 'lucide-react';
import { toast } from 'sonner';

type AppRole = 'teacher' | 'admin' | 'maintenance' | 'leadership' | 'safety_officer';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  school_id: string | null;
  created_at: string;
  roles: AppRole[];
}

interface SchoolData {
  id: string;
  name: string;
  code: string | null;
}

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'teacher', label: 'Õpetaja' },
  { value: 'admin', label: 'Admin' },
  { value: 'maintenance', label: 'Hooldus' },
  { value: 'leadership', label: 'Juhtkond' },
  { value: 'safety_officer', label: 'Ohutusametnik' },
];

const roleColors: Record<AppRole, string> = {
  teacher: 'bg-blue-100 text-blue-800',
  admin: 'bg-red-100 text-red-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  leadership: 'bg-purple-100 text-purple-800',
  safety_officer: 'bg-green-100 text-green-800',
};

export default function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch users with their roles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name, school_id, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('Viga kasutajate laadimisel');
      console.error(profilesError);
      setLoading(false);
      return;
    }

    // Fetch all roles
    const { data: allRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast.error('Viga rollide laadimisel');
      console.error(rolesError);
    }

    // Map roles to users
    const usersWithRoles: UserProfile[] = (profiles || []).map(profile => ({
      ...profile,
      roles: (allRoles || [])
        .filter(r => r.user_id === profile.id)
        .map(r => r.role as AppRole)
    }));

    setUsers(usersWithRoles);

    // Fetch schools
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id, name, code')
      .order('name');

    setSchools(schoolsData || []);
    setLoading(false);
  };

  const toggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    if (hasRole) {
      // Remove role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) {
        toast.error('Viga rolli eemaldamisel');
        return;
      }
      toast.success('Roll eemaldatud');
    } else {
      // Add role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) {
        toast.error('Viga rolli lisamisel');
        return;
      }
      toast.success('Roll lisatud');
    }

    fetchData();
  };

  const updateSchool = async (userId: string, schoolId: string | null) => {
    const { error } = await supabase
      .from('profiles')
      .update({ school_id: schoolId === 'none' ? null : schoolId })
      .eq('id', userId);

    if (error) {
      toast.error('Viga kooli määramisel');
      return;
    }
    
    toast.success('Kool määratud');
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const pendingUsers = users.filter(u => u.roles.length === 0);
  const activeUsers = users.filter(u => u.roles.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Administreerimine</h1>
      </div>

      {/* Pending Users */}
      {pendingUsers.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-yellow-500" />
            <h2 className="font-semibold">Kinnitamata kasutajad ({pendingUsers.length})</h2>
          </div>
          <div className="space-y-3">
            {pendingUsers.map(user => (
              <div key={user.id} className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="font-medium">{user.full_name || 'Nimetu'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map(role => (
                      <Button
                        key={role.value}
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRole(user.id, role.value, false)}
                        className="text-xs"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {role.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active Users */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-green-500" />
          <h2 className="font-semibold">Aktiivsed kasutajad ({activeUsers.length})</h2>
        </div>
        
        {activeUsers.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Pole aktiivseid kasutajaid</p>
        ) : (
          <div className="space-y-4">
            {activeUsers.map(user => (
              <div key={user.id} className="border rounded-lg p-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-medium">{user.full_name || 'Nimetu'}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  
                  {/* Current Roles */}
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map(role => (
                      <Badge 
                        key={role} 
                        className={`${roleColors[role]} cursor-pointer hover:opacity-70`}
                        onClick={() => toggleRole(user.id, role, true)}
                      >
                        {ROLES.find(r => r.value === role)?.label}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>

                  {/* Add Role */}
                  <div className="flex flex-wrap gap-1">
                    {ROLES.filter(r => !user.roles.includes(r.value)).map(role => (
                      <Button
                        key={role.value}
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleRole(user.id, role.value, false)}
                        className="text-xs h-7 text-muted-foreground"
                      >
                        + {role.label}
                      </Button>
                    ))}
                  </div>

                  {/* School Assignment */}
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <Select
                      value={user.school_id || 'none'}
                      onValueChange={(value) => updateSchool(user.id, value)}
                    >
                      <SelectTrigger className="w-48 h-8">
                        <SelectValue placeholder="Vali kool" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pole määratud</SelectItem>
                        {schools.map(school => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Schools Management */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <School className="h-5 w-5 text-blue-500" />
          <h2 className="font-semibold">Koolid ({schools.length})</h2>
        </div>
        <div className="space-y-2">
          {schools.map(school => (
            <div key={school.id} className="flex items-center justify-between border rounded p-2">
              <span>{school.name}</span>
              <span className="text-sm text-muted-foreground">{school.code}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
