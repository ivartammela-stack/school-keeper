import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { toast } from 'sonner';
import { ShieldCheck, Trash2 } from 'lucide-react';
import {
  getTickets,
  getCategories,
  getProblemTypes,
  getUsersBySchool,
  updateTicketStatus,
  deleteTicket as deleteTicketRecord,
} from '@/lib/firestore';
import { deleteTicketImages } from '@/lib/firebase-storage';
import type { Category, ProblemType, User as FirestoreUser } from '@/lib/firebase-types';

type Ticket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  resolved_by: string | null;
  closed_by: string | null;
  categories: { name: string } | null;
  problem_types: { name: string } | null;
  images: string[] | null;
  profiles?: { full_name: string | null };
  assigned?: { full_name: string | null };
  resolved?: { full_name: string | null };
  closed?: { full_name: string | null };
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

export default function Safety() {
  const { hasRole, user, schoolId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingTicket, setDeletingTicket] = useState<string | null>(null);

  const isSafetyOfficer = hasRole('safety_officer');
  const isAdmin = hasRole('admin');

  useEffect(() => {
    if (schoolId) {
      fetchTickets();
    }
  }, [schoolId]);

  const fetchTickets = async () => {
    if (!schoolId) return;

    try {
      const [rawTickets, categories, problemTypes, users] = await Promise.all([
        getTickets(schoolId, { is_safety_related: true }),
        getCategories(schoolId),
        getProblemTypes(schoolId),
        getUsersBySchool(schoolId),
      ]);

      const categoryMap = new Map<string, Category>();
      categories.forEach((c) => categoryMap.set(c.id, c));

      const problemTypeMap = new Map<string, ProblemType>();
      problemTypes.forEach((p) => problemTypeMap.set(p.id, p));

      const userMap = new Map<string, FirestoreUser>();
      users.forEach((u) => userMap.set(u.id, u));

      const mappedTickets: Ticket[] = rawTickets.map((t) => {
        const category = categoryMap.get(t.category_id);
        const problemType = problemTypeMap.get(t.problem_type_id);
        const creator = t.created_by ? userMap.get(t.created_by) : null;
        const assignee = t.assigned_to ? userMap.get(t.assigned_to) : null;
        const resolver = t.resolved_by ? userMap.get(t.resolved_by) : null;
        const closer = t.closed_by ? userMap.get(t.closed_by) : null;

        return {
          id: t.id,
          ticket_number: t.ticket_number,
          location: t.location,
          status: t.status,
          created_at: t.created_at.toISOString(),
          resolved_at: t.resolved_at?.toISOString() || null,
          created_by: t.created_by || null,
          assigned_to: t.assigned_to || null,
          resolved_by: t.resolved_by || null,
          closed_by: t.closed_by || null,
          images: t.images || null,
          categories: category ? { name: category.name } : null,
          problem_types: problemType ? { name: problemType.name } : null,
          profiles: creator ? { full_name: creator.full_name } : null,
          assigned: assignee ? { full_name: assignee.full_name } : null,
          resolved: resolver ? { full_name: resolver.full_name } : null,
          closed: closer ? { full_name: closer.full_name } : null,
        };
      });

      setTickets(mappedTickets);
    } finally {
      setLoading(false);
    }
  };

  const verifyTicket = async (ticketId: string) => {
    if (!schoolId) return;
    try {
      await updateTicketStatus(schoolId, ticketId, 'verified');
      toast.success('Ohutusteade kinnitatud');
      fetchTickets();
    } catch (error) {
      toast.error('Kinnitamine ebaõnnestus');
    }
  };

  const closeTicket = async (ticketId: string) => {
    if (!schoolId) return;
    try {
      await updateTicketStatus(schoolId, ticketId, 'closed', user?.uid || undefined);
      toast.success('Ohutusteade suletud');
      fetchTickets();
    } catch (error) {
      toast.error('Sulgemine ebaõnnestus');
    }
  };

  const deleteTicket = async (ticket: Ticket) => {
    setDeletingTicket(ticket.id);
    try {
      if (!schoolId) return;
      await deleteTicketImages(schoolId, ticket.id);
      await deleteTicketRecord(schoolId, ticket.id);
      toast.success('Teade kustutatud');
      fetchTickets();
    } finally {
      setDeletingTicket(null);
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
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-orange-500" />
        <h1 className="text-2xl font-bold">Ohutusteated</h1>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>Hetkel pole ohutusteated.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="border-l-4 border-l-red-500">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-muted-foreground">#{ticket.ticket_number}</span>
                    <p className="font-medium">{ticket.problem_types?.name}</p>
                    <p className="text-sm text-muted-foreground">{ticket.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ticket.created_at), 'd. MMM yyyy', { locale: et })}
                    </p>
                    {(ticket.profiles?.full_name ||
                      ticket.assigned?.full_name ||
                      ticket.resolved?.full_name ||
                      ticket.closed?.full_name) && (
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        {ticket.profiles?.full_name && <p>Looja: {ticket.profiles.full_name}</p>}
                        {ticket.assigned?.full_name && <p>Töös: {ticket.assigned.full_name}</p>}
                        {ticket.resolved?.full_name && <p>Lahendas: {ticket.resolved.full_name}</p>}
                        {ticket.closed?.full_name && <p>Sulges: {ticket.closed.full_name}</p>}
                      </div>
                    )}
                  </div>
                  <Badge className={`${statusColors[ticket.status]} text-white shrink-0`}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>

                {/* Safety Officer Actions */}
                <div className="flex gap-2 flex-wrap">
                  {ticket.status === 'resolved' && isSafetyOfficer && (
                    <Button size="sm" onClick={() => verifyTicket(ticket.id)} className="bg-purple-600 hover:bg-purple-700">
                      Kinnita kontrollituks
                    </Button>
                  )}
                  {ticket.status === 'verified' && isAdmin && (
                    <Button size="sm" onClick={() => closeTicket(ticket.id)}>
                      Sulge
                    </Button>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          disabled={deletingTicket === ticket.id}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Kustuta
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kustuta teade #{ticket.ticket_number}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Kas oled kindel, et soovid selle teate lõplikult kustutada? 
                            See tegevus on pöördumatu.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Tühista</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTicket(ticket)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Kustuta lõplikult
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
