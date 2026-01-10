import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Helper to remove accidental extra quotes or whitespace
const sanitize = (val: string | undefined) => val ? val.replace(/['"]/g, '').trim() : undefined;

const firebaseConfig = {
  apiKey: sanitize(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitize(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: sanitize(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
};

import { Auth } from 'firebase/auth';

import { Firestore, getFirestore } from 'firebase/firestore';

console.log('Initializing Firebase...');
let app;
let auth: Auth;
let db: Firestore;
let googleProvider: GoogleAuthProvider;

try {
  // Debug log: Check partially masked key and length to verify correct loading
  console.log('API Key (partial):', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 5)}... (len: ${firebaseConfig.apiKey.length})` : 'MISSING');
  console.log('Project ID:', firebaseConfig.projectId); 
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  console.log('Firebase Initialized successfully.');
} catch (e) {
  console.error('Firebase Initialization Failed:', e);
}

export { auth, db, googleProvider };
