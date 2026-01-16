import { supabase } from '@/integrations/supabase/client';
import { logEvent } from './analytics';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'assign'
  | 'verify'
  | 'login'
  | 'logout'
  | 'export'
  | 'bulk_update';

export type EntityType = 'ticket' | 'user' | 'school' | 'setting' | 'email_template';

interface AuditLogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, any>;
  oldStatus?: string;
  newStatus?: string;
}

export async function logAudit({
  action,
  entityType,
  entityId,
  details,
  oldStatus,
  newStatus,
}: AuditLogParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No user found for audit log');
      return;
    }

    // Get user agent and prepare audit data
    const userAgent = navigator.userAgent;

    // Insert audit log
    const { error } = await supabase
      .from('audit_log')
      .insert({
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_status: oldStatus,
        new_status: newStatus,
        details: details || {},
        user_agent: userAgent,
        // IP address would need to be set by Edge Function or backend
      });

    if (error) {
      console.error('Failed to log audit:', error);
      return;
    }

    // Also log to Firebase Analytics for broader tracking
    await logEvent('audit_action', {
      action,
      entity_type: entityType,
      entity_id: entityId,
    });
  } catch (error) {
    console.error('Error in audit logging:', error);
  }
}

// Convenience functions for common audit actions

export async function logTicketCreated(ticketId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'create',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logTicketUpdated(
  ticketId: string,
  oldStatus?: string,
  newStatus?: string,
  details?: Record<string, any>
) {
  await logAudit({
    action: oldStatus && newStatus ? 'status_change' : 'update',
    entityType: 'ticket',
    entityId: ticketId,
    oldStatus,
    newStatus,
    details,
  });
}

export async function logTicketDeleted(ticketId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'delete',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logTicketAssigned(
  ticketId: string,
  assignedToId: string,
  details?: Record<string, any>
) {
  await logAudit({
    action: 'assign',
    entityType: 'ticket',
    entityId: ticketId,
    details: {
      ...details,
      assigned_to: assignedToId,
    },
  });
}

export async function logTicketVerified(ticketId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'verify',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logUserLogin(userId: string) {
  await logAudit({
    action: 'login',
    entityType: 'user',
    entityId: userId,
  });
}

export async function logUserLogout(userId: string) {
  await logAudit({
    action: 'logout',
    entityType: 'user',
    entityId: userId,
  });
}

export async function logUserUpdated(userId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'update',
    entityType: 'user',
    entityId: userId,
    details,
  });
}

export async function logSchoolCreated(schoolId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'create',
    entityType: 'school',
    entityId: schoolId,
    details,
  });
}

export async function logSchoolUpdated(schoolId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'update',
    entityType: 'school',
    entityId: schoolId,
    details,
  });
}

export async function logSchoolDeleted(schoolId: string, details?: Record<string, any>) {
  await logAudit({
    action: 'delete',
    entityType: 'school',
    entityId: schoolId,
    details,
  });
}

export async function logSettingChanged(
  settingKey: string,
  oldValue: any,
  newValue: any
) {
  await logAudit({
    action: 'update',
    entityType: 'setting',
    entityId: settingKey,
    details: {
      old_value: oldValue,
      new_value: newValue,
    },
  });
}

export async function logBulkUpdate(
  entityType: EntityType,
  entityIds: string[],
  details?: Record<string, any>
) {
  await logAudit({
    action: 'bulk_update',
    entityType,
    entityId: entityIds[0], // Log first entity as primary
    details: {
      ...details,
      affected_count: entityIds.length,
      entity_ids: entityIds,
    },
  });
}

export async function logExport(
  dataType: string,
  format: 'csv' | 'pdf',
  recordCount: number
) {
  await logAudit({
    action: 'export',
    entityType: 'ticket', // or could be generic
    entityId: `export_${Date.now()}`,
    details: {
      data_type: dataType,
      format,
      record_count: recordCount,
    },
  });
}
