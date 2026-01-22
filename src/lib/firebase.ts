import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getRemoteConfig, fetchAndActivate, RemoteConfig } from 'firebase/remote-config';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyATg9dObVyjoVMMOe6oo5SD3qMy0hL9w44',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kooli-haldus.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kooli-haldus',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kooli-haldus.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '791386011340',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:791386011340:web:3561727f8bb02441503469',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-9TRJ96T83T',
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
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let functions: Functions | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);

    // Initialize core services
    db = getFirestore(app);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Failed to set auth persistence:', error);
    });
    storage = getStorage(app);
    functions = getFunctions(app, 'europe-west1');

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

export { app, analytics, remoteConfig, db, auth, storage, functions };
