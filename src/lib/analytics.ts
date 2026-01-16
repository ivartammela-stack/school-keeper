import { logEvent as firebaseLogEvent } from 'firebase/analytics';
import { analytics } from './firebase';
import { Capacitor } from '@capacitor/core';

export async function logEvent(name: string, params?: Record<string, any>) {
  try {
    if (analytics) {
      // Use web SDK (works on all platforms when Firebase is configured)
      firebaseLogEvent(analytics, name, params);
    } else {
      // Just log to console if Firebase not configured
      console.log(`[Analytics] ${name}`, params);
    }
  } catch (error) {
    console.error('Analytics error:', error);
  }
}

export async function setUserId(userId: string) {
  try {
    if (analytics) {
      const { setUserId: setUserIdWeb } = await import('firebase/analytics');
      setUserIdWeb(analytics, userId);
    }
  } catch (error) {
    console.error('Failed to set analytics user ID:', error);
  }
}

export async function setUserProperty(name: string, value: string) {
  try {
    if (analytics) {
      const { setUserProperties } = await import('firebase/analytics');
      setUserProperties(analytics, { [name]: value });
    }
  } catch (error) {
    console.error('Failed to set analytics user property:', error);
  }
}

// Predefined events
export const AnalyticsEvents = {
  TICKET_CREATED: 'ticket_created',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_VERIFIED: 'ticket_verified',
  TICKET_CLOSED: 'ticket_closed',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  REPORT_VIEWED: 'report_viewed',
  REPORT_EXPORTED: 'report_exported',
  SETTINGS_CHANGED: 'settings_changed',
  AUDIT_LOG_VIEWED: 'audit_log_viewed',
  TICKET_MANAGEMENT_VIEWED: 'ticket_management_viewed',
};
