import { remoteConfig } from './firebase';
import { getValue, getBoolean, getNumber, getString } from 'firebase/remote-config';

export function getRemoteConfigValue(key: string): string {
  try {
    return getString(remoteConfig, key);
  } catch (error) {
    console.error('Failed to get remote config value:', error);
    return '';
  }
}

export function getRemoteConfigBoolean(key: string): boolean {
  try {
    return getBoolean(remoteConfig, key);
  } catch (error) {
    console.error('Failed to get remote config boolean:', error);
    return false;
  }
}

export function getRemoteConfigNumber(key: string): number {
  try {
    return getNumber(remoteConfig, key);
  } catch (error) {
    console.error('Failed to get remote config number:', error);
    return 0;
  }
}

// Convenience functions for specific configs
export const RemoteConfigKeys = {
  MAINTENANCE_MODE: 'maintenance_mode',
  FEATURE_REPORTS: 'feature_reports',
  FEATURE_AUDIT_LOG: 'feature_audit_log',
  AUTO_CLOSE_DAYS: 'auto_close_days',
};

// Hook for using remote config in components
export function useRemoteConfig(key: string): string | boolean | number {
  try {
    const value = getValue(remoteConfig, key);
    // Return the appropriate type based on the value
    if (value.asBoolean() !== undefined) return value.asBoolean();
    if (value.asNumber() !== undefined) return value.asNumber();
    return value.asString();
  } catch (error) {
    console.error('Failed to use remote config:', error);
    return '';
  }
}
