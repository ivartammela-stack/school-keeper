import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-community/firebase-crashlytics';

export async function logError(error: Error, context?: Record<string, any>) {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback - just log to console
    console.error('Error:', error, context);
    return;
  }

  try {
    // Log error to Crashlytics
    await FirebaseCrashlytics.recordException({
      message: error.message,
      stacktrace: error.stack || '',
    });

    // Add context as custom keys
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        await FirebaseCrashlytics.setCustomKey({
          key,
          value: String(value),
        });
      }
    }
  } catch (e) {
    console.error('Failed to log to Crashlytics:', e);
  }
}

export async function setUserId(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await FirebaseCrashlytics.setUserId({ userId });
  } catch (error) {
    console.error('Failed to set Crashlytics user ID:', error);
  }
}

export async function log(message: string) {
  if (!Capacitor.isNativePlatform()) {
    console.log(message);
    return;
  }

  try {
    await FirebaseCrashlytics.log({ message });
  } catch (error) {
    console.error('Failed to log to Crashlytics:', error);
  }
}
