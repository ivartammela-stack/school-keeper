import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getRemoteConfig, fetchAndActivate, RemoteConfig } from 'firebase/remote-config';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC3jGSOz3OB9uVTm9YLFLDqQUNWGbs09fo',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'test-ddda8.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'test-ddda8',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'test-ddda8.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1083875306702',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1083875306702:android:04bb889bb141387777f49f',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_firebase_api_key' &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id';

// Initialize Firebase (only if configured)
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let remoteConfig: RemoteConfig | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Initialize Analytics (web only)
    if (!Capacitor.isNativePlatform()) {
      analytics = getAnalytics(app);
    }
    
    // Initialize Remote Config
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour
    
    // Default config values
    remoteConfig.defaultConfig = {
      maintenance_mode: false,
      feature_reports: true,
      feature_audit_log: true,
      auto_close_days: 30,
    };
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
} else {
  console.warn('Firebase not configured - analytics and remote config disabled');
}

export async function initRemoteConfig() {
  if (!remoteConfig) {
    console.warn('Remote config not available');
    return;
  }
  
  try {
    await fetchAndActivate(remoteConfig);
    console.log('Remote config initialized successfully');
  } catch (error) {
    console.error('Failed to fetch remote config:', error);
  }
}

export { app, analytics, remoteConfig };
