import { useState, useMemo } from 'react';
import { useTickets, useBulkTicketUpdate, type Ticket } from '@/hooks/useTickets';
import { DataTable, selectColumn } from '@/components/ui/data-table';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  Filter,
  Download,
  RotateCw,
  CheckCircle2,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import { DateRange } from 'react-day-picker';
import { logEvent, AnalyticsEvents } from '@/lib/analytics';
import { logBulkUpdate } from '@/lib/audit';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Status options
const statusOptions: MultiSelectOption[] = [
  { label: 'Esitatud', value: 'submitted' },
  { label: 'Töös', value: 'in_progress' },
  { label: 'Lahendatud', value: 'resolved' },
  { label: 'Kinnitatud', value: 'verified' },
  { label: 'Suletud', value: 'closed' },
];

// Status badge colors
const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  verified: 'bg-purple-100 text-purple-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function TicketManagement() {
  // Filters state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState<Ticket[]>([]);

  // Fetch tickets with filters
  const { tickets, loading, error, refetch } = useTickets({
    statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    dateRange,
    search: searchTerm || undefined,
  });

  // Bulk operations
  const { updateStatus, assignTo, updatePriority, loading: bulkLoading } = useBulkTicketUpdate();

  // Log page view
  useState(() => {
    logEvent(AnalyticsEvents.TICKET_MANAGEMENT_VIEWED);
  });

  // Table columns
  const columns: ColumnDef<Ticket>[] = useMemo(
    () => [
      selectColumn,
      {
        accessorKey: 'ticket_number',
        header: 'Nr',
        cell: ({ row }) => (
          <span className="font-mono font-semibold">#{row.original.ticket_number}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Staatus',
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge className={statusColors[status] || ''}>
              {statusOptions.find(s => s.value === status)?.label || status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'location',
        header: 'Asukoht',
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate">{row.original.location}</div>
        ),
      },
      {
        accessorKey: 'profiles',
        header: 'Looja',
        cell: ({ row }) => row.original.profiles?.full_name || '-',
      },
      {
        accessorKey: 'categories',
        header: 'Kategooria',
        cell: ({ row }) => row.original.categories?.name || '-',
      },
      {
        accessorKey: 'is_safety_related',
        header: 'Ohutus',
        cell: ({ row }) =>
          row.original.is_safety_related ? (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          ) : null,
      },
      {
        accessorKey: 'assigned',
        header: 'Määratud',
        cell: ({ row }) => row.original.assigned?.full_name || 'Pole määratud',
      },
      {
        accessorKey: 'created_at',
        header: 'Loodud',
        cell: ({ row }) =>
          format(new Date(row.original.created_at), 'd. MMM yyyy', { locale: et }),
      },
    ],
    []
  );

  // Handle bulk status update
  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedRows.length === 0) {
      toast.error('Vali vähemalt üks tiket');
      return;
    }

    const ticketIds = selectedRows.map(t => t.id);
    const result = await updateStatus(ticketIds, newStatus);

    if (result.success) {
      toast.success(`${ticketIds.length} tiketit uuendatud`);
      await logBulkUpdate('ticket', ticketIds, {
        action: 'status_update',
        new_status: newStatus,
      });
      refetch();
      setSelectedRows([]);
    } else {
      toast.error('Viga tikettide uuendamisel');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card>
          <CardHeader>
            <CardTitle>Viga tikettide laadimisel</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Tikettide Haldus</h1>
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
              <label className="text-sm font-medium mb-2 block">Staatus</label>
              <MultiSelect
                options={statusOptions}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="Vali staatused"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Kuupäevavahemik</label>
              <DateRangePicker value={dateRange} onChange={setDateRange} />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Otsing</label>
              <Input
                placeholder="Tiketi nr, asukoht, kirjeldus..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStatuses([]);
                setDateRange(undefined);
                setSearchTerm('');
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

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedRows.length} tiketit valitud
              </span>
              <div className="flex gap-2">
                <Select onValueChange={handleBulkStatusUpdate}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Muuda staatus" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={bulkLoading}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Määra
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={tickets}
              searchKey="ticket_number"
              searchPlaceholder="Otsi tiketi numbri järgi..."
            />
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Kokku tikette</CardDescription>
            <CardTitle className="text-3xl">{tickets.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Esitatud</CardDescription>
            <CardTitle className="text-3xl">
              {tickets.filter((t) => t.status === 'submitted').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Töös</CardDescription>
            <CardTitle className="text-3xl">
              {tickets.filter((t) => t.status === 'in_progress').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Ohutus</CardDescription>
            <CardTitle className="text-3xl">
              {tickets.filter((t) => t.is_safety_related).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
