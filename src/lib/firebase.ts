import { isLocalPath } from './workspaceMode';
import { getDoc as localGetDoc, getDocs as localGetDocs } from './workspaceStore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, DocumentReference, Query, getDoc as fGetDoc, getDocFromCache as fGetDocFromCache, getDocs as fGetDocs, getDocsFromCache as fGetDocsFromCache, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId,
  measurementId: (config as any).measurementId,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || (config as any).firestoreDatabaseId;

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({}) // Single-tab persistent cache, avoids multiTabManager lock issues in WebKit/mobile Safari
  }, dbId);
} catch (e) {
  firestoreInstance = getFirestore(app, dbId);
}

export const db = firestoreInstance;
export const auth = getAuth(app);

// Explicitly set browser-local persistence
import { setPersistence, browserLocalPersistence, inMemoryPersistence } from 'firebase/auth';
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[FirebaseAuth] Failed to set persistence (often expected in iframes/safari), falling back to inMemory:', error);
  setPersistence(auth, inMemoryPersistence).catch(() => {});
});

export const storage = getStorage(app);

let localGuestMode = false;
export function setLocalGuest(val: boolean) {
  localGuestMode = val;
}

export async function safeGetDoc(ref: DocumentReference) {
  if (isLocalPath(ref.path)) return localGetDoc(ref);
  try { return await fGetDoc(ref); }
  catch (error: any) {
    if (error.code === 'unavailable') return fGetDocFromCache(ref);
    throw error;
  }
}

export async function safeGetDocs(query: Query) {
  // The adapter selects local storage by the reference namespace.
  return localGetDocs(query);
}
