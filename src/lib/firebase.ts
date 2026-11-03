import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeFirestore, getFirestore, persistentLocalCache, DocumentReference, Query, getDoc as fGetDoc, getDocFromCache as fGetDocFromCache, getDocs as fGetDocs, getDocsFromCache as fGetDocsFromCache, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId,
  measurementId: (config as any).measurementId,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = (config as any).firestoreDatabaseId;

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
  if (auth.currentUser?.isAnonymous || localGuestMode) {
    try {
      const snap = await fGetDocFromCache(ref);
      if (snap.exists()) return snap;
    } catch (_) {}
    try {
      return await fGetDoc(ref);
    } catch (e) {
      return { exists: () => false, data: () => undefined, id: ref.id, ref } as any;
    }
  }
  
  try {
    return await fGetDoc(ref);
  } catch (e: any) {
    if (e.code === 'unavailable' || e.message?.includes('offline') || e.message?.toLowerCase().includes('database') || e.message?.toLowerCase().includes('closing')) {
      try {
        const snap = await fGetDocFromCache(ref);
        return snap;
      } catch (_) {}
      return { exists: () => false, data: () => undefined, id: ref.id, ref } as any;
    }
    console.error('[safeGetDoc Error]', e);
    return { exists: () => false, data: () => undefined, id: ref.id, ref } as any;
  }
}

export async function safeGetDocs(query: Query) {
  if (auth.currentUser?.isAnonymous || localGuestMode) {
    try {
      const snap = await fGetDocsFromCache(query);
      if (!snap.empty) return snap;
    } catch (_) {}
    try {
      return await fGetDocs(query);
    } catch (e) {
      return { empty: true, docs: [], size: 0, forEach: () => {} } as any;
    }
  }
  
  try {
    return await fGetDocs(query);
  } catch (e: any) {
    if (e.code === 'unavailable' || e.message?.includes('offline') || e.message?.toLowerCase().includes('database') || e.message?.toLowerCase().includes('closing')) {
      try {
        const snap = await fGetDocsFromCache(query);
        return snap;
      } catch (_) {}
      return { empty: true, docs: [], size: 0, forEach: () => {} } as any;
    }
    console.error('[safeGetDocs Error]', e);
    return { empty: true, docs: [], size: 0, forEach: () => {} } as any;
  }
}

