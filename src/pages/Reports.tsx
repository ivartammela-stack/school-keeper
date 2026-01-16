import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, TrendingUp, PieChart, Users } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useTickets } from '@/hooks/useTickets';
import { addDays } from 'date-fns';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { logEvent, AnalyticsEvents } from '@/lib/analytics';
import { logExport } from '@/lib/audit';
import { toast } from 'sonner';

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b'];

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  // Fetch tickets for statistics
  const { tickets, loading } = useTickets({ dateRange });

  // Log page view
  useState(() => {
    logEvent(AnalyticsEvents.REPORT_VIEWED);
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    const byStatus = {
      submitted: tickets.filter((t) => t.status === 'submitted').length,
      in_progress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      verified: tickets.filter((t) => t.status === 'verified').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    };
    const safetyTickets = tickets.filter((t) => t.is_safety_related).length;
    const activeTickets = byStatus.submitted + byStatus.in_progress;

    // Calculate average resolution time (in hours)
    const resolvedTickets = tickets.filter((t) => t.resolved_at);
    const avgResolutionTime =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const created = new Date(t.created_at).getTime();
            const resolved = new Date(t.resolved_at!).getTime();
            return sum + (resolved - created) / (1000 * 60 * 60);
          }, 0) / resolvedTickets.length
        : 0;

    return {
      total,
      byStatus,
      safetyTickets,
      activeTickets,
      avgResolutionTime: Math.round(avgResolutionTime),
    };
  }, [tickets]);

  // Chart data preparations
  const statusDistributionData = [
    { name: 'Esitatud', value: stats.byStatus.submitted, color: COLORS[1] },
    { name: 'Töös', value: stats.byStatus.in_progress, color: COLORS[5] },
    { name: 'Lahendatud', value: stats.byStatus.resolved, color: COLORS[2] },
    { name: 'Kinnitatud', value: stats.byStatus.verified, color: COLORS[3] },
    { name: 'Suletud', value: stats.byStatus.closed, color: COLORS[0] },
  ];

  const categoryBreakdownData = useMemo(() => {
    const categoryMap = new Map<string, number>();
    tickets.forEach((t) => {
      const category = t.categories?.name || 'Unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [tickets]);

  const priorityDistributionData = useMemo(() => {
    const priorityMap = new Map<number, number>();
    tickets.forEach((t) => {
      priorityMap.set(t.priority, (priorityMap.get(t.priority) || 0) + 1);
    });
    return Array.from(priorityMap.entries())
      .map(([priority, count]) => ({
        name: `Prioriteet ${priority}`,
        value: count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const workloadDistributionData = useMemo(() => {
    const assignedMap = new Map<string, number>();
    tickets
      .filter((t) => t.assigned_to)
      .forEach((t) => {
        const name = t.assigned?.full_name || 'Unknown';
        assignedMap.set(name, (assignedMap.get(name) || 0) + 1);
      });
    return Array.from(assignedMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [tickets]);

  // Export functions
  const exportToCSV = () => {
    const csvData = [
      ['Metric', 'Value'],
      ['Total Tickets', stats.total],
      ['Active Tickets', stats.activeTickets],
      ['Safety Tickets', stats.safetyTickets],
      ['Avg Resolution Time (hours)', stats.avgResolutionTime],
      ['Submitted', stats.byStatus.submitted],
      ['In Progress', stats.byStatus.in_progress],
      ['Resolved', stats.byStatus.resolved],
      ['Verified', stats.byStatus.verified],
      ['Closed', stats.byStatus.closed],
    ];

    const csv = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logExport('tickets_statistics', 'csv', stats.total);
    logEvent(AnalyticsEvents.REPORT_EXPORTED, { format: 'csv' });
    toast.success('Raport eksporditud CSV formaadis');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Aruanded ja Statistika</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Ekspordi CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Kuupäevavahemik:</label>
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Kokku tikette</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Keskmine lahendamisaeg</CardDescription>
            <CardTitle className="text-3xl">{stats.avgResolutionTime}h</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Aktiivsed tiketid</CardDescription>
            <CardTitle className="text-3xl">{stats.activeTickets}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ohutustiketid</CardDescription>
            <CardTitle className="text-3xl">{stats.safetyTickets}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs for different report types */}
      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tickets">Tikettide Statistika</TabsTrigger>
          <TabsTrigger value="usage">Kasutuse Statistika</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          {/* Status Distribution - Pie Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                <CardTitle>Staatus Jaotus</CardTitle>
              </div>
              <CardDescription>Tikettide jaotus staatuse järgi</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={statusDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Breakdown - Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Kategooria Jaotus</CardTitle>
              <CardDescription>Tikettide arv kategooriate kaupa</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryBreakdownData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Workload Distribution - Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Tööjaotus</CardTitle>
              <CardDescription>
                Tikettide arv määratud isikute kaupa (Top 10)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workloadDistributionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Priority Distribution - Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Prioriteedi Jaotus</CardTitle>
              <CardDescription>Tikettide jaotus prioriteedi järgi</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={priorityDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {priorityDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Safety Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Ohutuse Statistika</CardTitle>
              <CardDescription>Ohutusega seotud tikettide ülevaade</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Ohutustiketid kokku
                  </p>
                  <p className="text-2xl font-bold">{stats.safetyTickets}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Kinnitatud ohutustiketid
                  </p>
                  <p className="text-2xl font-bold">{stats.byStatus.verified}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Kinnitamise määr</p>
                  <p className="text-2xl font-bold">
                    {stats.safetyTickets > 0
                      ? Math.round(
                          (stats.byStatus.verified / stats.safetyTickets) * 100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>Kasutuse Statistika</CardTitle>
              </div>
              <CardDescription>
                Firebase Analytics andmed (vajab konfiguratsiooni)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Firebase Analytics pole veel seadistatud</p>
                <p className="text-sm mt-2">
                  Seadista Firebase projekt ja lisa credentials .env faili
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
