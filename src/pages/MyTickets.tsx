import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { Image as ImageIcon, X } from 'lucide-react';
import { logger } from '@/lib/logger';
import {
  getTickets,
  getCategories,
  getProblemTypes,
  getUsersBySchool,
} from '@/lib/firestore';
import type { Ticket as FirestoreTicket, Category, ProblemType, User } from '@/lib/firebase-types';

type Ticket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
  created_by?: string | null;
  is_safety_related: boolean;
  description: string | null;
  images: string[] | null;
  auto_delete_at?: string | null;
  categories: { name: string } | null;
  problem_types: { name: string } | null;
  profiles?: { full_name: string | null } | null;
  assigned?: { full_name: string | null } | null;
  resolved?: { full_name: string | null } | null;
  closed?: { full_name: string | null } | null;
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
  const { user, schoolId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (user && schoolId) {
      fetchTickets();
    }
  }, [user, schoolId]);

  const fetchTickets = async () => {
    if (!user || !schoolId) return;

    try {
      // Fetch tickets and lookup data in parallel
      const [rawTickets, categories, problemTypes, users] = await Promise.all([
        getTickets(schoolId, { created_by: user.uid }),
        getCategories(schoolId),
        getProblemTypes(schoolId),
        getUsersBySchool(schoolId),
      ]);

      // Create lookup maps
      const categoryMap = new Map<string, Category>();
      categories.forEach((c) => categoryMap.set(c.id, c));

      const problemTypeMap = new Map<string, ProblemType>();
      problemTypes.forEach((p) => problemTypeMap.set(p.id, p));

      const userMap = new Map<string, User>();
      users.forEach((u) => userMap.set(u.id, u));

      // Map to local format
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
          created_by: t.created_by,
          is_safety_related: t.is_safety_related || false,
          description: t.description || null,
          images: t.images || null,
          auto_delete_at: t.auto_delete_at?.toISOString() || null,
          categories: category ? { name: category.name } : null,
          problem_types: problemType ? { name: problemType.name } : null,
          profiles: creator ? { full_name: creator.full_name } : null,
          assigned: assignee ? { full_name: assignee.full_name } : null,
          resolved: resolver ? { full_name: resolver.full_name } : null,
          closed: closer ? { full_name: closer.full_name } : null,
        };
      });

      setTickets(mappedTickets);
    } catch (error) {
      logger.error('Failed to load tickets', error);
    } finally {
      setLoading(false);
    }
  };

  // Firebase Storage URLs are already public download URLs
  const getImageUrl = (url: string) => url;

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
            <Card
              key={ticket.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">
                        #{ticket.ticket_number}
                      </span>
                      {ticket.is_safety_related && (
                        <Badge variant="destructive" className="text-xs">
                          Ohutus
                        </Badge>
                      )}
                      {ticket.images && ticket.images.length > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span className="text-xs">{ticket.images.length}</span>
                        </div>
                      )}
                    </div>
                    <p className="font-medium truncate">
                      {ticket.problem_types?.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {ticket.location}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ticket.created_at), 'd. MMM yyyy HH:mm', {
                        locale: et,
                      })}
                    </p>
                  </div>
                  {/* Show first image thumbnail if exists */}
                  {ticket.images && ticket.images.length > 0 && (
                    <img
                      src={getImageUrl(ticket.images[0])}
                      alt="Pildi eelvaade"
                      className="h-14 w-14 object-cover rounded-lg shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <Badge
                    className={`${statusColors[ticket.status]} text-white shrink-0`}
                  >
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>#{selectedTicket.ticket_number}</span>
                  <Badge
                    className={`${statusColors[selectedTicket.status]} text-white`}
                  >
                    {statusLabels[selectedTicket.status]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Kategooria</p>
                  <p className="font-medium">{selectedTicket.categories?.name}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Probleem</p>
                  <p className="font-medium">
                    {selectedTicket.problem_types?.name}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Asukoht</p>
                  <p className="font-medium">{selectedTicket.location}</p>
                </div>

                {selectedTicket.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Kirjeldus</p>
                    <p>{selectedTicket.description}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Esitatud</p>
                  <p>
                    {format(
                      new Date(selectedTicket.created_at),
                      'd. MMMM yyyy HH:mm',
                      { locale: et }
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Looja</p>
                  <p>{selectedTicket.profiles?.full_name || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Töös</p>
                  <p>{selectedTicket.assigned?.full_name || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Lahendas</p>
                  <p>{selectedTicket.resolved?.full_name || '-'}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Sulges</p>
                  <p>{selectedTicket.closed?.full_name || '-'}</p>
                </div>
                {selectedTicket.status === 'closed' && selectedTicket.auto_delete_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Kustub automaatselt</p>
                    <p>
                      {format(
                        new Date(selectedTicket.auto_delete_at),
                        'd. MMMM yyyy HH:mm',
                        { locale: et }
                      )}
                    </p>
                  </div>
                )}

                {/* Images */}
                {selectedTicket.images && selectedTicket.images.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Pildid</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedTicket.images.map((image, index) => (
                        <img
                          key={index}
                          src={getImageUrl(image)}
                          alt={`Pilt ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(getImageUrl(image))}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Image Viewer */}
      <Dialog
        open={!!selectedImage}
        onOpenChange={(open) => !open && setSelectedImage(null)}
      >
        <DialogContent className="max-w-4xl p-0 bg-black/90 border-none">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-2 right-2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Suur pilt"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
