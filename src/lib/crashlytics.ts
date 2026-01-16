import { Capacitor } from '@capacitor/core';

// Crashlytics is disabled until native plugin is properly configured
// Just log to console for now

export async function logError(error: Error, context?: Record<string, any>) {
  console.error('Error:', error, context);
}

export async function setUserId(userId: string) {
  console.log('Crashlytics setUserId:', userId);
}

export async function log(message: string) {
  console.log('Crashlytics log:', message);
}
