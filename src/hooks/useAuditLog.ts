import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { getAuditLogs, getUsersBySchool } from '@/lib/firestore';
import type { AuditLog, User } from '@/lib/firebase-types';

export interface AuditLogFilters {
  schoolId: string;
  userId?: string;
  action?: string;
  entityType?: string;
  dateRange?: DateRange;
  ticketId?: string;
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

export function useAuditLog(filters: AuditLogFilters) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = async () => {
    if (!filters.schoolId) {
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch audit logs and users in parallel
      const [rawLogs, users] = await Promise.all([
        getAuditLogs(filters.schoolId, filters.ticketId, 100),
        getUsersBySchool(filters.schoolId),
      ]);

      // Create user map for quick lookup
      const userMap = new Map<string, User>();
      users.forEach((u) => userMap.set(u.id, u));

      // Apply client-side filters
      let filteredLogs = rawLogs;

      if (filters.userId) {
        filteredLogs = filteredLogs.filter((l) => l.user_id === filters.userId);
      }
      if (filters.action) {
        filteredLogs = filteredLogs.filter((l) => l.action === filters.action);
      }
      if (filters.dateRange?.from) {
        filteredLogs = filteredLogs.filter(
          (l) => l.created_at >= filters.dateRange!.from!
        );
      }
      if (filters.dateRange?.to) {
        filteredLogs = filteredLogs.filter(
          (l) => l.created_at <= filters.dateRange!.to!
        );
      }

      // Map to entry format with user info
      const entries: AuditLogEntry[] = filteredLogs.map((log) => {
        const user = log.user_id ? userMap.get(log.user_id) : null;
        return {
          id: log.id,
          ticket_id: log.ticket_id,
          user_id: log.user_id || null,
          action: log.action,
          old_status: log.old_status || null,
          new_status: log.new_status || null,
          details: log.details || null,
          created_at: log.created_at.toISOString(),
          entity_type: null,
          entity_id: null,
          ip_address: null,
          user_agent: null,
          profiles: user
            ? { full_name: user.full_name, email: user.email }
            : null,
        };
      });

      setLogs(entries);
      setTotalCount(entries.length);
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
    filters.schoolId,
    filters.userId,
    filters.action,
    filters.entityType,
    filters.dateRange?.from?.toISOString(),
    filters.dateRange?.to?.toISOString(),
    filters.ticketId,
  ]);

  return {
    logs,
    loading,
    error,
    totalCount,
    refetch: fetchLogs,
  };
}
