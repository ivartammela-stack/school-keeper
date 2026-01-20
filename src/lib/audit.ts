import { addAuditLog } from './firestore';
import { getCurrentUser } from './firebase-auth';
import { logEvent } from './analytics';
import type { TicketStatus } from './firebase-types';

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
  schoolId: string;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  details?: Record<string, unknown>;
  oldStatus?: TicketStatus;
  newStatus?: TicketStatus;
}

export async function logAudit({
  schoolId,
  action,
  entityType,
  entityId,
  details,
  oldStatus,
  newStatus,
}: AuditLogParams): Promise<void> {
  try {
    const user = getCurrentUser();

    if (!user) {
      console.warn('No user found for audit log');
      return;
    }

    // Only log ticket entities to audit log
    if (entityType !== 'ticket') {
      console.warn(`Audit logging skipped for non-ticket entity type: ${entityType}`);
      // Still log to analytics
      await logEvent('audit_action', {
        action,
        entity_type: entityType,
        entity_id: entityId,
      });
      return;
    }

    await addAuditLog(schoolId, {
      ticket_id: entityId,
      user_id: user.uid,
      action,
      old_status: oldStatus,
      new_status: newStatus,
      details: details || null,
    });

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

export async function logTicketCreated(
  schoolId: string,
  ticketId: string,
  details?: Record<string, unknown>
) {
  await logAudit({
    schoolId,
    action: 'create',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logTicketUpdated(
  schoolId: string,
  ticketId: string,
  oldStatus?: TicketStatus,
  newStatus?: TicketStatus,
  details?: Record<string, unknown>
) {
  await logAudit({
    schoolId,
    action: oldStatus && newStatus ? 'status_change' : 'update',
    entityType: 'ticket',
    entityId: ticketId,
    oldStatus,
    newStatus,
    details,
  });
}

export async function logTicketDeleted(
  schoolId: string,
  ticketId: string,
  details?: Record<string, unknown>
) {
  await logAudit({
    schoolId,
    action: 'delete',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logTicketAssigned(
  schoolId: string,
  ticketId: string,
  assignedToId: string,
  details?: Record<string, unknown>
) {
  await logAudit({
    schoolId,
    action: 'assign',
    entityType: 'ticket',
    entityId: ticketId,
    details: {
      ...details,
      assigned_to: assignedToId,
    },
  });
}

export async function logTicketVerified(
  schoolId: string,
  ticketId: string,
  details?: Record<string, unknown>
) {
  await logAudit({
    schoolId,
    action: 'verify',
    entityType: 'ticket',
    entityId: ticketId,
    details,
  });
}

export async function logUserLogin(userId: string) {
  // Just log to analytics, no Firestore audit for non-ticket
  await logEvent('audit_action', {
    action: 'login',
    entity_type: 'user',
    entity_id: userId,
  });
}

export async function logUserLogout(userId: string) {
  await logEvent('audit_action', {
    action: 'logout',
    entity_type: 'user',
    entity_id: userId,
  });
}

export async function logBulkUpdate(
  schoolId: string,
  entityType: EntityType,
  entityIds: string[],
  details?: Record<string, unknown>
) {
  if (entityType === 'ticket' && entityIds.length > 0) {
    await logAudit({
      schoolId,
      action: 'bulk_update',
      entityType,
      entityId: entityIds[0],
      details: {
        ...details,
        affected_count: entityIds.length,
        entity_ids: entityIds,
      },
    });
  }
}

export async function logExport(
  schoolId: string,
  dataType: string,
  format: 'csv' | 'pdf',
  recordCount: number
) {
  await logEvent('audit_action', {
    action: 'export',
    data_type: dataType,
    format,
    record_count: recordCount,
  });
}

export async function logSettingChanged(
  settingKey: string,
  oldValue: unknown,
  newValue: unknown
) {
  await logEvent('audit_action', {
    action: 'update',
    entity_type: 'setting',
    entity_id: settingKey,
    old_value: JSON.stringify(oldValue),
    new_value: JSON.stringify(newValue),
  });
}

export async function logUserUpdated(userId: string, details?: Record<string, unknown>) {
  await logEvent('audit_action', {
    action: 'update',
    entity_type: 'user',
    entity_id: userId,
    ...details,
  });
}

export async function logSchoolCreated(schoolId: string, details?: Record<string, unknown>) {
  await logEvent('audit_action', {
    action: 'create',
    entity_type: 'school',
    entity_id: schoolId,
    ...details,
  });
}

export async function logSchoolUpdated(schoolId: string, details?: Record<string, unknown>) {
  await logEvent('audit_action', {
    action: 'update',
    entity_type: 'school',
    entity_id: schoolId,
    ...details,
  });
}

export async function logSchoolDeleted(schoolId: string, details?: Record<string, unknown>) {
  await logEvent('audit_action', {
    action: 'delete',
    entity_type: 'school',
    entity_id: schoolId,
    ...details,
  });
}
