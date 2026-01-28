import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Helper to remove accidental extra quotes or whitespace, and gs:// or https:// prefixes
const sanitize = (val: string | undefined) => val ? val.replace(/['"]/g, '').trim() : undefined;
const sanitizeBucket = (val: string | undefined) => {
  if (!val) return undefined;
  let clean = val.replace(/['"]/g, '').trim();
  // Remove gs:// prefix
  if (clean.startsWith('gs://')) clean = clean.slice(5);
  // Remove https:// prefix
  if (clean.startsWith('https://')) clean = clean.slice(8);
  // Remove trailing slash
  if (clean.endsWith('/')) clean = clean.slice(0, -1);

  // If user pasted full URL like https://firebasestorage.googleapis.com/v0/b/xyz.appspot.com
  // We try to extract the bucket name if possible, but usually just stripping protocol is enough for most copy-pastes
  return clean;
};

const firebaseConfig = {
  apiKey: sanitize(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitize(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitize(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeBucket(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitize(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitize(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: sanitize(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID)
};

import { Auth } from 'firebase/auth';

import { Firestore, getFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

console.log('Initializing Firebase...');
let app;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let googleProvider: GoogleAuthProvider;

try {
  // Debug log: Check partially masked key and length to verify correct loading
  console.log('API Key (partial):', firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 5)}... (len: ${firebaseConfig.apiKey.length})` : 'MISSING');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('Storage Bucket:', firebaseConfig.storageBucket || 'MISSING');

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Explicitly set persistence to local storage to ensure long-term session works
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error("Firebase Persistence Error:", error);
  });

  db = getFirestore(app);
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  console.log('Firebase Initialized successfully.');
} catch (e) {
  console.error('Firebase Initialization Failed:', e);
}

export { auth, db, googleProvider, storage };
