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
  ticket_id: string;
  user_id: string | null;
  action: string;
  old_status: string | null;
  new_status: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  entity_type?: string | null;
  entity_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
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

      // Build base query - cast to any to avoid deep type instantiation issues
      const baseQuery = supabase.from('audit_log').select('*', { count: 'exact' }) as any;

      // Apply filters
      let query = baseQuery;
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

      query = query.order('created_at', { ascending: false }).limit(100);

      const { data: auditData, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      // Fetch profile info separately
      const rawData = (auditData || []) as any[];
      const userIds = [...new Set(rawData.map((a) => a.user_id).filter(Boolean))];

      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = Object.fromEntries(
            profilesData.map((p) => [p.id, { full_name: p.full_name, email: p.email }])
          );
        }
      }

      const entries: AuditLogEntry[] = rawData.map((row) => ({
        id: row.id,
        ticket_id: row.ticket_id,
        user_id: row.user_id,
        action: row.action,
        old_status: row.old_status,
        new_status: row.new_status,
        details: row.details,
        created_at: row.created_at,
        entity_type: row.entity_type ?? null,
        entity_id: row.entity_id ?? null,
        ip_address: row.ip_address ?? null,
        user_agent: row.user_agent ?? null,
        profiles: row.user_id ? profilesMap[row.user_id] || null : null,
      }));

      setLogs(entries);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
