import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { toast } from 'sonner';

type Ticket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
  is_safety_related: boolean;
  assigned_to: string | null;
  categories: { name: string } | null;
  problem_types: { name: string } | null;
  profiles: { full_name: string } | null;
};

const statusLabels: Record<string, string> = {
  submitted: 'Esitatud',
  in_progress: 'Töös',
  resolved: 'Lahendatud',
  verified: 'Kontrollitud',
  closed: 'Suletud',
};

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  resolved: 'bg-green-500',
  verified: 'bg-purple-500',
  closed: 'bg-gray-500',
};

export default function Work() {
  const { user, hasRole } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const isAdmin = hasRole('admin');
  const isMaintenance = hasRole('maintenance');

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  const fetchTickets = async () => {
    let query = supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        location,
        status,
        created_at,
        is_safety_related,
        assigned_to,
        categories (name),
        problem_types (name),
        profiles:created_by (full_name)
      `)
      .in('status', ['submitted', 'in_progress', 'resolved'])
      .order('created_at', { ascending: false });

    if (filter === 'mine' && isMaintenance) {
      query = query.eq('assigned_to', user!.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTickets(data as Ticket[]);
    }
    setLoading(false);
  };

  const updateStatus = async (ticketId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

    const { error } = await supabase
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) {
      toast.error('Staatuse muutmine ebaõnnestus');
    } else {
      toast.success('Staatus muudetud');
      fetchTickets();
    }
  };

  const assignToMe = async (ticketId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: user!.id, status: 'in_progress' })
      .eq('id', ticketId);

    if (error) {
      toast.error('Määramine ebaõnnestus');
    } else {
      toast.success('Töö võetud');
      fetchTickets();
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tööd</h1>
        {isMaintenance && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              Kõik
            </Button>
            <Button
              size="sm"
              variant={filter === 'mine' ? 'default' : 'outline'}
              onClick={() => setFilter('mine')}
            >
              Minu
            </Button>
          </div>
        )}
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Hetkel pole avatud töid.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">#{ticket.ticket_number}</span>
                      {ticket.is_safety_related && (
                        <Badge variant="destructive" className="text-xs">Ohutus</Badge>
                      )}
                    </div>
                    <p className="font-medium">{ticket.problem_types?.name}</p>
                    <p className="text-sm text-muted-foreground">{ticket.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ticket.created_at), 'd. MMM yyyy', { locale: et })}
                      {ticket.profiles?.full_name && ` • ${ticket.profiles.full_name}`}
                    </p>
                  </div>
                  <Badge className={`${statusColors[ticket.status]} text-white shrink-0`}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {ticket.status === 'submitted' && isMaintenance && !ticket.assigned_to && (
                    <Button size="sm" onClick={() => assignToMe(ticket.id)}>
                      Võta töösse
                    </Button>
                  )}
                  {ticket.status === 'in_progress' && (isMaintenance || isAdmin) && (
                    <Button size="sm" onClick={() => updateStatus(ticket.id, 'resolved')}>
                      Märgi lahendatuks
                    </Button>
                  )}
                  {ticket.status === 'resolved' && isAdmin && !ticket.is_safety_related && (
                    <Button size="sm" onClick={() => updateStatus(ticket.id, 'closed')}>
                      Sulge
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
