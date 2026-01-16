import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, AlertTriangle, CheckCircle, Clock, Users } from 'lucide-react';

type Stats = {
  total: number;
  submitted: number;
  in_progress: number;
  resolved: number;
  closed: number;
  safety_open: number;
};

export default function Overview() {
  const [stats, setStats] = useState<Stats>({
    total: 0,
    submitted: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    safety_open: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('status, is_safety_related');

    if (!error && data) {
      const newStats: Stats = {
        total: data.length,
        submitted: data.filter(t => t.status === 'submitted').length,
        in_progress: data.filter(t => t.status === 'in_progress').length,
        resolved: data.filter(t => t.status === 'resolved').length,
        closed: data.filter(t => t.status === 'closed').length,
        safety_open: data.filter(t => t.is_safety_related && t.status !== 'closed').length,
      };
      setStats(newStats);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Ülevaade</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Kokku teateid</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.submitted + stats.in_progress}</p>
              <p className="text-xs text-muted-foreground">Avatud</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.closed}</p>
              <p className="text-xs text-muted-foreground">Suletud</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.safety_open}</p>
              <p className="text-xs text-muted-foreground">Ohutus avatud</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staatuste jaotus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Esitatud</span>
            <span className="font-medium">{stats.submitted}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Töös</span>
            <span className="font-medium">{stats.in_progress}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Lahendatud</span>
            <span className="font-medium">{stats.resolved}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Suletud</span>
            <span className="font-medium">{stats.closed}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
