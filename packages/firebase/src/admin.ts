// Firebase Admin SDK initialization (server-only)
// Uses FIREBASE_ADMIN_* env vars — never exposed to the client
//
// Lazy-init pattern: the Admin SDK is only initialized when first accessed
// at runtime, NOT at import/build time. This prevents Next.js "Collecting
// page data" phase from crashing when env vars aren't available during
// `next build`. Routes still need `export const dynamic = 'force-dynamic'`.

import 'server-only';

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

// Cached singletons — populated on first call to getters
let _app: App | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;

function getAdminApp(): App {
  if (!_app) {
    if (getApps().length > 0) {
      _app = getApp();
    } else {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
      console.log(`[admin] Initializing Firebase Admin: project=${projectId}, email=${clientEmail}, keyLength=${privateKey?.length ?? 0}`);
      _app = initializeApp({ credential: cert({ projectId: projectId!, clientEmail: clientEmail!, privateKey }) });
    }
  }
  return _app;
}

function getAdminAuth(): Auth {
  if (!_auth) _auth = getAuth(getAdminApp());
  return _auth;
}

function getAdminDb(): Firestore {
  if (!_db) _db = getFirestore(getAdminApp());
  return _db;
}

// Named exports — callers use getAdminDb() and getAdminAuth() instead of
// the old direct `adminDb` and `adminAuth` constants.
export { getAdminApp, getAdminAuth, getAdminDb, FieldValue };

// Auth guards — server-side route protection
export {
  verifySession,
  requireAuth,
  requireRole,
  requireSuperAdmin,
  isVerifiedSession,
} from './auth-guard';
export type { VerifiedSession } from './auth-guard';

// Legacy aliases for backward compat during migration (will be removed)
// These are getters, not constants — they defer initialization.
export const adminApp = new Proxy({} as App, {
  get(_, prop, receiver) {
    const real = getAdminApp();
    const val = Reflect.get(real, prop, real);
    return typeof val === 'function' ? val.bind(real) : val;
  },
});
export const adminAuth = new Proxy({} as Auth, {
  get(_, prop, receiver) {
    const real = getAdminAuth();
    const val = Reflect.get(real, prop, real);
    return typeof val === 'function' ? val.bind(real) : val;
  },
});
export const adminDb = new Proxy({} as Firestore, {
  get(_, prop, receiver) {
    const real = getAdminDb();
    const val = Reflect.get(real, prop, real);
    return typeof val === 'function' ? val.bind(real) : val;
  },
});
