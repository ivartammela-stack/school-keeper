import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';

type Ticket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
  is_safety_related: boolean;
  categories: { name: string } | null;
  problem_types: { name: string } | null;
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

export default function MyTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user]);

  const fetchTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        ticket_number,
        location,
        status,
        created_at,
        is_safety_related,
        categories (name),
        problem_types (name)
      `)
      .eq('created_by', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data as Ticket[]);
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
      <h1 className="text-2xl font-bold">Minu teated</h1>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Sul pole veel teateid esitatud.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">#{ticket.ticket_number}</span>
                      {ticket.is_safety_related && (
                        <Badge variant="destructive" className="text-xs">Ohutus</Badge>
                      )}
                    </div>
                    <p className="font-medium truncate">{ticket.problem_types?.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{ticket.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ticket.created_at), 'd. MMM yyyy HH:mm', { locale: et })}
                    </p>
                  </div>
                  <Badge className={`${statusColors[ticket.status]} text-white shrink-0`}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
