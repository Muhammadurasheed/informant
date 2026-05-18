import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const validateFirebaseConfig = () => {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ] as const;

  const missing = requiredEnvVars.filter((k) => !import.meta.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Firebase configuration incomplete for extension. Missing: ${missing.join(', ')}`,
    );
  }
};

// Validate configuration before initializing
console.log("[Firebase Init] Checking environment variables...");
validateFirebaseConfig();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: any;
let auth: any;
let db: any;
let initError: Error | null = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Set persistence to indexedDB for extension stability
  setPersistence(auth, indexedDBLocalPersistence);
  
  db = getFirestore(app);
  console.log("[Firebase Init] Successfully initialized with IndexedDB persistence!");
} catch (error: any) {
  console.error("[Firebase Init] CRITICAL FAILURE:", error);
  initError = error;
}

export { app, auth, db, initError, GoogleAuthProvider };
