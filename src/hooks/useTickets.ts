import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import {
  getTickets,
  getCategories,
  getProblemTypes,
  getUsersBySchool,
  updateTicket,
  updateTicketStatus,
} from '@/lib/firestore';
import { getCurrentUser } from '@/lib/firebase-auth';
import type {
  Ticket as FirestoreTicket,
  TicketStatus,
  Category,
  ProblemType,
  User,
} from '@/lib/firebase-types';

export interface TicketFilters {
  statuses?: string[];
  categoryId?: string;
  problemTypeId?: string;
  schoolId?: string;
  assignedTo?: string;
  dateRange?: DateRange;
  search?: string;
  isSafetyRelated?: boolean;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  category_id: string;
  problem_type_id: string;
  location: string;
  description: string | null;
  status: string;
  priority: number;
  created_by: string;
  assigned_to: string | null;
  resolved_by?: string | null;
  closed_by?: string | null;
  is_safety_related: boolean;
  images: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
  auto_delete_at: string | null;
  categories?: { name: string };
  problem_types?: { name: string };
  profiles?: { full_name: string | null };
  assigned?: { full_name: string | null };
  resolved?: { full_name: string | null };
  closed?: { full_name: string | null };
}

// Helper to convert Firestore ticket to local format
function mapTicket(
  ticket: FirestoreTicket,
  categories: Category[],
  problemTypes: ProblemType[],
  users: User[]
): Ticket {
  const category = categories.find((c) => c.id === ticket.category_id);
  const problemType = problemTypes.find((p) => p.id === ticket.problem_type_id);
  const creator = users.find((u) => u.id === ticket.created_by);
  const assignee = users.find((u) => u.id === ticket.assigned_to);
  const resolver = users.find((u) => u.id === ticket.resolved_by);
  const closer = users.find((u) => u.id === ticket.closed_by);

  return {
    id: ticket.id,
    ticket_number: ticket.ticket_number,
    category_id: ticket.category_id,
    problem_type_id: ticket.problem_type_id,
    location: ticket.location,
    description: ticket.description || null,
    status: ticket.status,
    priority: ticket.priority || 0,
    created_by: ticket.created_by || '',
    assigned_to: ticket.assigned_to || null,
    resolved_by: ticket.resolved_by || null,
    closed_by: ticket.closed_by || null,
    is_safety_related: ticket.is_safety_related || false,
    images: ticket.images || [],
    created_at: ticket.created_at.toISOString(),
    updated_at: ticket.updated_at.toISOString(),
    resolved_at: ticket.resolved_at?.toISOString() || null,
    verified_at: ticket.verified_at?.toISOString() || null,
    closed_at: ticket.closed_at?.toISOString() || null,
    auto_delete_at: ticket.auto_delete_at?.toISOString() || null,
    categories: category ? { name: category.name } : undefined,
    problem_types: problemType ? { name: problemType.name } : undefined,
    profiles: creator ? { full_name: creator.full_name } : undefined,
    assigned: assignee ? { full_name: assignee.full_name } : undefined,
    resolved: resolver ? { full_name: resolver.full_name } : undefined,
    closed: closer ? { full_name: closer.full_name } : undefined,
  };
}

export function useTickets(filters: TicketFilters = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTickets = async () => {
    if (!filters.schoolId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch tickets and lookup data in parallel
      const [rawTickets, categories, problemTypes, users] = await Promise.all([
        getTickets(filters.schoolId, {
          status: filters.statuses?.[0] as TicketStatus | undefined,
          category_id: filters.categoryId,
          assigned_to: filters.assignedTo,
          is_safety_related: filters.isSafetyRelated,
        }),
        getCategories(filters.schoolId),
        getProblemTypes(filters.schoolId),
        getUsersBySchool(filters.schoolId),
      ]);

      // Apply client-side filters that Firestore doesn't support well
      let filteredTickets = rawTickets;

      // Filter by multiple statuses
      if (filters.statuses && filters.statuses.length > 1) {
        filteredTickets = filteredTickets.filter((t) =>
          filters.statuses!.includes(t.status)
        );
      }

      // Filter by problem type
      if (filters.problemTypeId) {
        filteredTickets = filteredTickets.filter(
          (t) => t.problem_type_id === filters.problemTypeId
        );
      }

      // Filter by date range
      if (filters.dateRange?.from) {
        filteredTickets = filteredTickets.filter(
          (t) => t.created_at >= filters.dateRange!.from!
        );
      }
      if (filters.dateRange?.to) {
        filteredTickets = filteredTickets.filter(
          (t) => t.created_at <= filters.dateRange!.to!
        );
      }

      // Filter by search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchNum = parseInt(filters.search, 10);
        filteredTickets = filteredTickets.filter(
          (t) =>
            t.ticket_number === searchNum ||
            t.location.toLowerCase().includes(searchLower) ||
            t.description?.toLowerCase().includes(searchLower)
        );
      }

      // Map to local format with relations
      const mappedTickets = filteredTickets.map((t) =>
        mapTicket(t, categories, problemTypes, users)
      );

      setTickets(mappedTickets);
      setTotalCount(mappedTickets.length);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [
    filters.statuses?.join(','),
    filters.categoryId,
    filters.problemTypeId,
    filters.schoolId,
    filters.assignedTo,
    filters.dateRange?.from?.toISOString(),
    filters.dateRange?.to?.toISOString(),
    filters.search,
    filters.isSafetyRelated,
  ]);

  return {
    tickets,
    loading,
    error,
    totalCount,
    refetch: fetchTickets,
  };
}

export function useBulkTicketUpdate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCurrentUserId = () => {
    const user = getCurrentUser();
    return user?.uid ?? null;
  };

  const updateStatus = async (
    schoolId: string,
    ticketIds: string[],
    newStatus: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const userId = getCurrentUserId();

      await Promise.all(
        ticketIds.map((ticketId) =>
          updateTicketStatus(schoolId, ticketId, newStatus as TicketStatus, userId || undefined)
        )
      );

      return { success: true };
    } catch (err) {
      setError(err as Error);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const assignTo = async (
    schoolId: string,
    ticketIds: string[],
    userId: string | null
  ) => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all(
        ticketIds.map((ticketId) =>
          updateTicket(schoolId, ticketId, { assigned_to: userId })
        )
      );

      return { success: true };
    } catch (err) {
      setError(err as Error);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updatePriority = async (
    schoolId: string,
    ticketIds: string[],
    priority: number
  ) => {
    try {
      setLoading(true);
      setError(null);

      await Promise.all(
        ticketIds.map((ticketId) =>
          updateTicket(schoolId, ticketId, { priority })
        )
      );

      return { success: true };
    } catch (err) {
      setError(err as Error);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  return {
    updateStatus,
    assignTo,
    updatePriority,
    loading,
    error,
  };
}
