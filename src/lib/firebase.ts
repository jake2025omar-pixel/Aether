import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';

/**
 * Firebase Client Configuration
 * Client-safe parameters provided via Vite environment variables (VITE_FIREBASE_*).
 */
const defaultAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '';
const resolvedAuthDomain = typeof window !== 'undefined' && window.location.host
  ? window.location.host
  : defaultAuthDomain;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: resolvedAuthDomain || defaultAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/**
 * Check if the minimum required Firebase configuration is provided
 */
export const isFirebaseConfigured: boolean = Boolean(
  firebaseConfig.apiKey &&
  (firebaseConfig.authDomain || defaultAuthDomain) &&
  firebaseConfig.projectId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account',
    });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Firebase initialization warning:', error);
    }
  }
}

export { app, auth, googleProvider };
