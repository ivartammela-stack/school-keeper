import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DateRange } from 'react-day-picker';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  dateRange?: DateRange;
}

export interface AuditLogEntry {
  id: string;
  ticket_id: string | null;
  user_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  details: Record<string, any>;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('audit_log')
        .select(
          `
          *,
          profiles:user_id(full_name, email)
        `,
          { count: 'exact' }
        );

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }

      if (filters.dateRange?.from) {
        query = query.gte('created_at', filters.dateRange.from.toISOString());
      }

      if (filters.dateRange?.to) {
        query = query.lte('created_at', filters.dateRange.to.toISOString());
      }

      // Order by created_at descending
      query = query.order('created_at', { ascending: false }).limit(100);

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      setLogs(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [
    filters.userId,
    filters.action,
    filters.entityType,
    filters.dateRange,
  ]);

  return {
    logs,
    loading,
    error,
    totalCount,
    refetch: fetchLogs,
  };
}
