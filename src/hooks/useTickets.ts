import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';

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
  is_safety_related: boolean;
  images: string[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  verified_at: string | null;
  closed_at: string | null;
  categories?: { name: string };
  problem_types?: { name: string };
  profiles?: { full_name: string | null };
  assigned?: { full_name: string | null };
}

export function useTickets(filters: TicketFilters = {}) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('tickets')
        .select(
          `
          *,
          categories:category_id(name),
          problem_types:problem_type_id(name),
          profiles:created_by(full_name),
          assigned:assigned_to(full_name)
        `,
          { count: 'exact' }
        );

      // Apply filters
      if (filters.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      }

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.problemTypeId) {
        query = query.eq('problem_type_id', filters.problemTypeId);
      }

      if (filters.schoolId) {
        // Need to join with profiles to filter by school
        // This is a simplified version - adjust based on your schema
        query = query.eq('profiles.school_id', filters.schoolId);
      }

      if (filters.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      if (filters.dateRange?.from) {
        query = query.gte('created_at', filters.dateRange.from.toISOString());
      }

      if (filters.dateRange?.to) {
        query = query.lte('created_at', filters.dateRange.to.toISOString());
      }

      if (filters.search) {
        query = query.or(
          `ticket_number.eq.${filters.search},location.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
        );
      }

      if (filters.isSafetyRelated !== undefined) {
        query = query.eq('is_safety_related', filters.isSafetyRelated);
      }

      // Order by created_at descending
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setTickets(data || []);
      setTotalCount(count || 0);
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
    filters.statuses,
    filters.categoryId,
    filters.problemTypeId,
    filters.schoolId,
    filters.assignedTo,
    filters.dateRange,
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

  const updateStatus = async (ticketIds: string[], newStatus: string) => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', ticketIds);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err) {
      setError(err as Error);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const assignTo = async (ticketIds: string[], userId: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tickets')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .in('id', ticketIds);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err) {
      setError(err as Error);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updatePriority = async (ticketIds: string[], priority: number) => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('tickets')
        .update({ priority, updated_at: new Date().toISOString() })
        .in('id', ticketIds);

      if (updateError) throw updateError;

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
