import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendTicketNotification } from '@/lib/push-notifications';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { toast } from 'sonner';
import { Image as ImageIcon, X, Trash2 } from 'lucide-react';

type Ticket = {
  id: string;
  ticket_number: number;
  location: string;
  status: string;
  created_at: string;
  is_safety_related: boolean;
  assigned_to: string | null;
  description: string | null;
  images: string[] | null;
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

const getImageUrl = (path: string) => {
  const { data } = supabase.storage.from('ticket-images').getPublicUrl(path);
  return data.publicUrl;
};

export default function Work() {
  const { user, hasRole } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deletingTicket, setDeletingTicket] = useState(false);

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
        description,
        images,
        categories (name),
        problem_types (name)
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
      const notificationType =
        newStatus === 'resolved' ? 'resolved' : newStatus === 'closed' ? 'closed' : 'updated';
      await sendTicketNotification(ticketId, notificationType);
      toast.success('Staatus muudetud');
      fetchTickets();
      setSelectedTicket(null);
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
      await sendTicketNotification(ticketId, 'assigned');
      toast.success('Töö võetud');
      fetchTickets();
      setSelectedTicket(null);
    }
  };

  const deleteTicket = async (ticket: Ticket) => {
    setDeletingTicket(true);
    try {
      // Delete images from storage first
      if (ticket.images && ticket.images.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('ticket-images')
          .remove(ticket.images);
        
        if (storageError) {
          console.error('Error deleting images:', storageError);
        }
      }

      // Delete the ticket (cascade will handle audit_log and comments)
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticket.id);

      if (error) {
        toast.error('Teate kustutamine ebaõnnestus');
        console.error(error);
      } else {
        toast.success('Teade kustutatud');
        fetchTickets();
        setSelectedTicket(null);
      }
    } finally {
      setDeletingTicket(false);
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
            <Card 
              key={ticket.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">#{ticket.ticket_number}</span>
                      {ticket.is_safety_related && (
                        <Badge variant="destructive" className="text-xs">Ohutus</Badge>
                      )}
                      {ticket.images && ticket.images.length > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-3 w-3" />
                          <span className="text-xs">{ticket.images.length}</span>
                        </div>
                      )}
                    </div>
                    <p className="font-medium">{ticket.problem_types?.name}</p>
                    <p className="text-sm text-muted-foreground">{ticket.location}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(ticket.created_at), 'd. MMM yyyy', { locale: et })}
                    </p>
                  </div>
                  {/* Show first image thumbnail if exists */}
                  {ticket.images && ticket.images.length > 0 && (
                    <img 
                      src={getImageUrl(ticket.images[0])} 
                      alt="Pildi eelvaade"
                      className="h-14 w-14 object-cover rounded-lg shrink-0"
                    />
                  )}
                  <Badge className={`${statusColors[ticket.status]} text-white shrink-0`}>
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span>#{selectedTicket.ticket_number}</span>
                  <Badge className={`${statusColors[selectedTicket.status]} text-white`}>
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
                  <p className="font-medium">{selectedTicket.problem_types?.name}</p>
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
                  <p>{format(new Date(selectedTicket.created_at), 'd. MMMM yyyy HH:mm', { locale: et })}</p>
                </div>

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
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pt-2 border-t">
                  {selectedTicket.status === 'submitted' && !selectedTicket.assigned_to && (isMaintenance || isAdmin) && (
                    <Button size="sm" onClick={() => assignToMe(selectedTicket.id)}>
                      Võta töösse
                    </Button>
                  )}
                  
                  {selectedTicket.status === 'submitted' && selectedTicket.assigned_to && isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(selectedTicket.id, 'in_progress')}>
                      Pane töösse
                    </Button>
                  )}
                  
                  {selectedTicket.status === 'in_progress' && (isMaintenance || isAdmin) && (
                    <Button size="sm" onClick={() => updateStatus(selectedTicket.id, 'resolved')}>
                      Märgi lahendatuks
                    </Button>
                  )}
                  
                  {selectedTicket.status === 'resolved' && isAdmin && !selectedTicket.is_safety_related && (
                    <Button size="sm" onClick={() => updateStatus(selectedTicket.id, 'closed')}>
                      Sulge
                    </Button>
                  )}
                  
                  {isAdmin && selectedTicket.status !== 'submitted' && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => updateStatus(selectedTicket.id, 'submitted')}
                      className="text-muted-foreground"
                    >
                      Taasta esitatud
                    </Button>
                  )}

                  {/* Delete button for admin */}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          disabled={deletingTicket}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Kustuta
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Kustuta teade #{selectedTicket.ticket_number}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Kas oled kindel, et soovid selle teate lõplikult kustutada? 
                            See tegevus on pöördumatu ja kustutab ka kõik seotud pildid.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Tühista</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTicket(selectedTicket)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Kustuta lõplikult
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full Image Viewer */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
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
