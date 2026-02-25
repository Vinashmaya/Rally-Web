// Firebase Client SDK initialization
// Uses NEXT_PUBLIC_ env vars for browser-safe configuration
//
// Lazy-guard pattern: During `next build`, env vars may not be available.
// Firebase must NOT call initializeApp() without a valid API key.
// The guard returns typed stubs during build — these are never called
// because useEffect (which triggers auth listeners) doesn't run during SSR.

import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
} as const;

// ---------------------------------------------------------------------------
// Initialization guard
// ---------------------------------------------------------------------------

function initFirebase() {
  // During `next build`, NEXT_PUBLIC_ env vars may not be present.
  // Return typed stubs that are never actually invoked at build time
  // (useEffect / event handlers don't run during SSR pre-rendering).
  if (!firebaseConfig.apiKey) {
    return {
      app: undefined as unknown as FirebaseApp,
      auth: undefined as unknown as Auth,
      db: undefined as unknown as Firestore,
      storage: undefined as unknown as FirebaseStorage,
    };
  }

  // Prevent double-initialization (Next.js hot reload, multiple imports)
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  const db = getFirestore(app);

  const storage = getStorage(app);

  return { app, auth, db, storage };
}

const { app, auth, db, storage } = initFirebase();

export { app, auth, db, storage };
