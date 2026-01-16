import { useState, useMemo } from 'react';
import { useAuditLog, type AuditLogEntry } from '@/hooks/useAuditLog';
import { DataTable } from '@/components/ui/data-table';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Filter, Download, RotateCw } from 'lucide-react';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { DateRange } from 'react-day-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logEvent, AnalyticsEvents } from '@/lib/analytics';
import { logExport } from '@/lib/audit';

// Action colors
const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  status_change: 'bg-yellow-100 text-yellow-800',
  assign: 'bg-purple-100 text-purple-800',
  verify: 'bg-green-100 text-green-800',
  login: 'bg-gray-100 text-gray-800',
  logout: 'bg-gray-100 text-gray-800',
  export: 'bg-orange-100 text-orange-800',
  bulk_update: 'bg-purple-100 text-purple-800',
};

export default function AuditLog() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch audit logs
  const { logs, loading, error, totalCount, refetch } = useAuditLog({
    action: selectedAction || undefined,
    entityType: selectedEntityType || undefined,
    dateRange,
  });

  // Log page view
  useState(() => {
    logEvent(AnalyticsEvents.AUDIT_LOG_VIEWED);
  });

  // Table columns
  const columns: ColumnDef<AuditLogEntry>[] = useMemo(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Kuupäev',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'dd.MM.yyyy HH:mm', {
            locale: et,
          }),
      },
      {
        accessorKey: 'profiles',
        header: 'Kasutaja',
        cell: ({ row }) => {
          const profile = row.original.profiles;
          return profile?.full_name || profile?.email || 'Unknown';
        },
      },
      {
        accessorKey: 'action',
        header: 'Tegevus',
        cell: ({ row }) => {
          const action = row.original.action;
          return (
            <Badge className={actionColors[action] || 'bg-gray-100'}>
              {action}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'entity_type',
        header: 'Tüüp',
        cell: ({ row }) => row.original.entity_type || '-',
      },
      {
        accessorKey: 'old_status',
        header: 'Vana → Uus',
        cell: ({ row }) => {
          const { old_status, new_status } = row.original;
          if (!old_status && !new_status) return '-';
          return (
            <span className="text-sm">
              {old_status || '?'} → {new_status || '?'}
            </span>
          );
        },
      },
      {
        id: 'details',
        header: 'Detailid',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedLog(row.original);
              setDetailsDialogOpen(true);
            }}
          >
            Vaata
          </Button>
        ),
      },
    ],
    []
  );

  // Export to CSV
  const exportToCSV = () => {
    const csvData = [
      ['Date', 'User', 'Action', 'Entity Type', 'Old Status', 'New Status'],
      ...logs.map((log) => [
        format(new Date(log.created_at), 'dd.MM.yyyy HH:mm'),
        log.profiles?.full_name || log.profiles?.email || 'Unknown',
        log.action,
        log.entity_type || '',
        log.old_status || '',
        log.new_status || '',
      ]),
    ];

    const csv = csvData.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    logExport('audit_log', 'csv', logs.length);
    toast.success('Audit logi eksporditud CSV formaadis');
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card>
          <CardHeader>
            <CardTitle>Viga logi laadimisel</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-orange-500" />
          <h1 className="text-2xl font-bold">Auditeerimislogi</h1>
        </div>
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <Download className="h-4 w-4 mr-2" />
          Ekspordi CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filtrid</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tegevus</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Kõik tegevused" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kõik tegevused</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="status_change">Status Change</SelectItem>
                  <SelectItem value="assign">Assign</SelectItem>
                  <SelectItem value="verify">Verify</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="bulk_update">Bulk Update</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Entiteedi tüüp
              </label>
              <Select
                value={selectedEntityType}
                onValueChange={setSelectedEntityType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kõik tüübid" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Kõik tüübid</SelectItem>
                  <SelectItem value="ticket">Ticket</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="setting">Setting</SelectItem>
                  <SelectItem value="email_template">Email Template</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Kuupäevavahemik
              </label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedAction('');
                setSelectedEntityType('');
                setDateRange(undefined);
              }}
            >
              Tühjenda filtrid
            </Button>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RotateCw className="h-4 w-4 mr-2" />
              Värskenda
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Kokku: {totalCount} kirjet (näidatakse viimased 100)
              </div>
              <DataTable columns={columns} data={logs} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Logi Detailid</DialogTitle>
            <DialogDescription>
              Täielik info valitud tegevuse kohta
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Kuupäev
                  </p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at), 'dd.MM.yyyy HH:mm:ss', {
                      locale: et,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Kasutaja
                  </p>
                  <p className="text-sm">
                    {selectedLog.profiles?.full_name ||
                      selectedLog.profiles?.email ||
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Tegevus
                  </p>
                  <Badge className={actionColors[selectedLog.action] || ''}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Entiteedi tüüp
                  </p>
                  <p className="text-sm">{selectedLog.entity_type || '-'}</p>
                </div>
                {selectedLog.old_status && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Vana staatus
                    </p>
                    <p className="text-sm">{selectedLog.old_status}</p>
                  </div>
                )}
                {selectedLog.new_status && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Uus staatus
                    </p>
                    <p className="text-sm">{selectedLog.new_status}</p>
                  </div>
                )}
              </div>
              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    User Agent
                  </p>
                  <p className="text-xs font-mono bg-muted p-2 rounded">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Detailid (JSON)
                  </p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
