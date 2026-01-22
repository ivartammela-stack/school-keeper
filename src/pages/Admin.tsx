import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Users, Shield, School, Check, X, Plus, Pencil, Trash2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getSchoolMembers,
  updateSchoolMember,
  getSchools,
  createSchool,
  updateSchool as updateSchoolRecord,
  deleteSchool as deleteSchoolRecord,
  getPushTokenStats,
} from '@/lib/firestore';
import { deleteUser as deleteFirebaseUser } from '@/lib/firebase-auth';
import type { AppRole, MembershipStatus } from '@/lib/firebase-types';

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  roles: AppRole[];
  status: MembershipStatus;
}

interface SchoolData {
  id: string;
  name: string;
  code: string | null;
}

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'teacher', label: 'Õpetaja' },
  { value: 'safety_officer', label: 'Töökeskkonnavolinik' },
  { value: 'director', label: 'Direktor' },
  { value: 'worker', label: 'Töömees' },
  { value: 'facility_manager', label: 'Majandusjuhataja' },
  { value: 'admin', label: 'Admin' },
];

const roleColors: Record<AppRole, string> = {
  teacher: 'bg-blue-100 text-blue-800',
  safety_officer: 'bg-green-100 text-green-800',
  director: 'bg-purple-100 text-purple-800',
  worker: 'bg-yellow-100 text-yellow-800',
  facility_manager: 'bg-orange-100 text-orange-800',
  admin: 'bg-red-100 text-red-800',
};

export default function Admin() {
  const { user: currentUser, roles: currentRoles, schoolId, isDemo } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [pushTokensError, setPushTokensError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [pushTokenStats, setPushTokenStats] = useState<{
    total: number;
    byPlatform: Record<'android' | 'ios' | 'web', number>;
  } | null>(null);
  
  // School form state
  const [schoolDialogOpen, setSchoolDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');

  useEffect(() => {
    fetchData();
  }, [schoolId]);

  const normalizeError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return String(error);
  };

  const fetchData = async () => {
    if (!schoolId) {
      setUsers([]);
      setSchools([]);
      setPushTokenStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setUsersError(null);
    setSchoolsError(null);
    setPushTokensError(null);
    setLastError(null);

    try {
      console.log('Admin: Fetching data...');
      const [profiles, schoolsData, tokenStats] = await Promise.all([
        getSchoolMembers(schoolId).catch(err => {
          console.error('getSchoolMembers failed:', err);
          setUsersError(normalizeError(err));
          return [];
        }),
        getSchools().catch(err => {
          console.error('getSchools failed:', err);
          setSchoolsError(normalizeError(err));
          return [];
        }),
        getPushTokenStats().catch(err => {
          console.error('getPushTokenStats failed:', err);
          setPushTokensError(normalizeError(err));
          return null;
        }),
      ]);

      console.log('Admin: Got profiles:', profiles.length, profiles);
      console.log('Admin: Got schools:', schoolsData.length, schoolsData);
      if (tokenStats) {
        console.log('Admin: Got push token stats:', tokenStats);
      }

      const usersWithRoles: UserProfile[] = profiles.map((profile) => ({
        id: profile.user_id || profile.id,
        email: profile.email || null,
        full_name: profile.full_name || null,
        roles: profile.roles || [],
        status: profile.status,
      }));

      setUsers(usersWithRoles);

      setSchools(
        schoolsData.map((school) => ({
          id: school.id,
          name: school.name,
          code: school.code || null,
        }))
      );
      setPushTokenStats(tokenStats);
    } catch (error) {
      toast.error('Viga andmete laadimisel');
      console.error('Admin fetchData error:', error);
      setLastError(normalizeError(error));
    } finally {
      setLastFetchAt(new Date());
      setLoading(false);
    }
  };

  const toggleRole = async (user: UserProfile, role: AppRole) => {
    if (!schoolId) return;
    const hasRole = user.roles.includes(role);
    const updatedRoles = hasRole
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];
    const nextStatus: MembershipStatus = updatedRoles.length > 0 ? 'active' : 'pending';

    try {
      await updateSchoolMember(schoolId, user.id, { roles: updatedRoles, status: nextStatus });
      toast.success(hasRole ? 'Roll eemaldatud' : 'Roll lisatud');
      fetchData();
    } catch (error) {
      toast.error('Viga rolli muutmisel');
    }
  };

  const openSchoolDialog = (school?: SchoolData) => {
    if (school) {
      setEditingSchool(school);
      setSchoolName(school.name);
      setSchoolCode(school.code || '');
    } else {
      setEditingSchool(null);
      setSchoolName('');
      setSchoolCode('');
    }
    setSchoolDialogOpen(true);
  };

  const saveSchool = async () => {
    if (!schoolName.trim()) {
      toast.error('Kooli nimi on kohustuslik');
      return;
    }

    if (editingSchool) {
      // Update existing school
      try {
        await updateSchoolRecord(editingSchool.id, {
          name: schoolName.trim(),
          code: schoolCode.trim() || null,
        });
      } catch (error) {
        toast.error('Viga kooli uuendamisel');
        console.error(error);
        return;
      }
      toast.success('Kool uuendatud');
    } else {
      // Create new school
      try {
        await createSchool({
          name: schoolName.trim(),
          code: schoolCode.trim() || null,
        });
      } catch (error) {
        toast.error('Viga kooli lisamisel');
        console.error(error);
        return;
      }
      toast.success('Kool lisatud');
    }

    setSchoolDialogOpen(false);
    setEditingSchool(null);
    setSchoolName('');
    setSchoolCode('');
    fetchData();
  };

  const deleteSchool = async (schoolId: string) => {
    try {
      const members = await getSchoolMembers(schoolId);
      if (members.length > 0) {
        toast.error(`Ei saa kustutada - ${members.length} kasutajat on sellesse kooli määratud`);
        return;
      }
    } catch (error) {
      toast.error('Viga kooli kasutajate kontrollimisel');
      return;
    }

    try {
      await deleteSchoolRecord(schoolId);
    } catch (error) {
      toast.error('Viga kooli kustutamisel');
      console.error(error);
      return;
    }

    toast.success('Kool kustutatud');
    fetchData();
  };

  const deleteUser = async (userId: string) => {
    if (!schoolId) return;
    setDeletingUserId(userId);
    
    try {
      await deleteFirebaseUser(userId, schoolId);
      toast.success('Kasutaja kustutatud');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Viga kasutaja kustutamisel');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <Card className="p-4">
        <div className="text-center text-muted-foreground">
          Vali aktiivne kool Profiili lehelt.
        </div>
      </Card>
    );
  }

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');
  const usersWithoutEmail = users.filter(u => !u.email);
  const usersWithMultipleRoles = users.filter(u => u.roles.length > 1);
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '—';

  const roleCounts = ROLES.reduce<Record<AppRole, number>>((acc, role) => {
    acc[role.value] = users.filter((u) => u.roles.includes(role.value)).length;
    return acc;
  }, {
    teacher: 0,
    safety_officer: 0,
    director: 0,
    worker: 0,
    facility_manager: 0,
    admin: 0,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Administreerimine</h1>
      </div>

      <Card className="p-4">
        <Accordion type="single" collapsible>
          <AccordionItem value="diagnostics" className="border-none">
            <AccordionTrigger className="py-0 hover:no-underline">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                Diagnostika
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Kasutaja ID</div>
                  <div className="truncate">{currentUser?.uid || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="truncate">{currentUser?.email || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Rollid</div>
                  <div>{currentRoles.length > 0 ? currentRoles.join(', ') : '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kool</div>
                  <div className="truncate">{schoolId || '—'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Keskkond</div>
                  <div className="truncate">{appOrigin}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Demo režiim</div>
                  <div>{isDemo ? 'jah' : 'ei'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kasutajaid kokku</div>
                  <div>{users.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Aktiivseid</div>
                  <div>{activeUsers.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kinnitamata</div>
                  <div>{pendingUsers.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Mitu rolli</div>
                  <div>{usersWithMultipleRoles.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Email puudu</div>
                  <div>{usersWithoutEmail.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Koolid</div>
                  <div>{schools.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Viimane laadimine</div>
                  <div>{lastFetchAt ? lastFetchAt.toLocaleString('et-EE') : '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Push tokenid</div>
                  <div>
                    {pushTokenStats
                      ? `${pushTokenStats.total} (web ${pushTokenStats.byPlatform.web}, android ${pushTokenStats.byPlatform.android}, ios ${pushTokenStats.byPlatform.ios})`
                      : '—'}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Rollide jaotus</div>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map((role) => (
                      <span key={role.value} className="text-xs rounded-full bg-muted px-2 py-1">
                        {role.label}: {roleCounts[role.value]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Push tokenite viga</div>
                  <div className={pushTokensError ? 'text-destructive' : ''}>{pushTokensError || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Kasutajate viga</div>
                  <div className={usersError ? 'text-destructive' : ''}>{usersError || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Koolide viga</div>
                  <div className={schoolsError ? 'text-destructive' : ''}>{schoolsError || '—'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground">Üldviga</div>
                  <div className={lastError ? 'text-destructive' : ''}>{lastError || '—'}</div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

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
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{user.full_name || 'Nimetu'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          disabled={deletingUserId === user.id}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kustuta kasutaja</AlertDialogTitle>
                          <AlertDialogDescription>
                            Kas oled kindel, et soovid kustutada kasutaja <strong>{user.full_name || user.email}</strong>? 
                            See tegevus on pöördumatu.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Tühista</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteUser(user.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Kustuta
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map(role => (
                      <Button
                        key={role.value}
                        size="sm"
                        variant="outline"
                        onClick={() => toggleRole(user, role.value)}
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
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{user.full_name || 'Nimetu'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    {user.id !== currentUser?.uid && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingUserId === user.id}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Kustuta kasutaja</AlertDialogTitle>
                            <AlertDialogDescription>
                              Kas oled kindel, et soovid kustutada kasutaja <strong>{user.full_name || user.email}</strong>? 
                              See tegevus on pöördumatu ja eemaldab kõik kasutaja andmed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Tühista</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteUser(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Kustuta
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  
                  {/* Current Roles */}
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map(role => (
                      <Badge 
                        key={role} 
                        className={`${roleColors[role]} cursor-pointer hover:opacity-70`}
                        onClick={() => toggleRole(user, role)}
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
                        onClick={() => toggleRole(user, role.value)}
                        className="text-xs h-7 text-muted-foreground"
                      >
                        + {role.label}
                      </Button>
                    ))}
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Schools Management */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold">Koolid ({schools.length})</h2>
          </div>
          <Dialog open={schoolDialogOpen} onOpenChange={setSchoolDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => openSchoolDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Lisa kool
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSchool ? 'Muuda kooli' : 'Lisa uus kool'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">Kooli nimi *</Label>
                  <Input
                    id="schoolName"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="nt. Tallinna Põhikool"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolCode">Kooli kood</Label>
                  <Input
                    id="schoolCode"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="nt. TPK001"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSchoolDialogOpen(false)}>
                    Tühista
                  </Button>
                  <Button onClick={saveSchool}>
                    {editingSchool ? 'Salvesta' : 'Lisa'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {schools.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Pole koole lisatud</p>
        ) : (
          <div className="space-y-2">
            {schools.map(school => {
              const userCount = school.id === schoolId ? users.length : null;
              return (
                <div key={school.id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <p className="font-medium">{school.name}</p>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {school.code && <span>Kood: {school.code}</span>}
                      {userCount !== null && <span>• {userCount} kasutajat</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => openSchoolDialog(school)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteSchool(school.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
