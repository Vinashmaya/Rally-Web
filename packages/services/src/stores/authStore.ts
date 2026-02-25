'use client';

// @rally/services — Auth State Zustand Store
// Manages Firebase Auth state and DealerUser document sync

import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@rally/firebase/client';
import type { DealerUser } from '@rally/firebase/types';
import { isSuperAdmin } from '../superAdmin';
import { useTenantStore } from '../tenant';

// ---------------------------------------------------------------------------
// State Interface
// ---------------------------------------------------------------------------

interface AuthState {
  firebaseUser: User | null;
  dealerUser: DealerUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;

  // Actions
  setFirebaseUser: (user: User | null) => void;
  setDealerUser: (user: DealerUser | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void; // returns unsubscribe function
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()((set, get) => ({
  // Initial state
  firebaseUser: null,
  dealerUser: null,
  isLoading: true,
  isAuthenticated: false,
  isSuperAdmin: false,

  // ---------------------------------------------------------------------------
  // setFirebaseUser — update the raw Firebase User
  // ---------------------------------------------------------------------------
  setFirebaseUser: (user: User | null) => {
    set({
      firebaseUser: user,
      isAuthenticated: user !== null,
      isSuperAdmin: user ? isSuperAdmin(user.uid) : false,
    });
  },

  // ---------------------------------------------------------------------------
  // setDealerUser — update the DealerUser document from Firestore
  // ---------------------------------------------------------------------------
  setDealerUser: (user: DealerUser | null) => {
    set({ dealerUser: user });
  },

  // ---------------------------------------------------------------------------
  // signIn — email/password authentication
  // After Firebase auth succeeds, sets the __session cookie so middleware
  // allows navigation to protected routes.
  // ---------------------------------------------------------------------------
  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Set session cookie for middleware auth guard
      const idToken = await credential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      // onAuthStateChanged listener handles the rest
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // signOut — sign out and clear all state
  // Clears the __session cookie so middleware redirects to /login.
  // ---------------------------------------------------------------------------
  signOut: async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      await firebaseSignOut(auth);
      // onAuthStateChanged listener handles clearing state
    } catch (err) {
      console.error('[AuthStore] Sign out error:', err);
      // Force-clear cookie and state even if Firebase signout fails
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      set({
        firebaseUser: null,
        dealerUser: null,
        isLoading: false,
        isAuthenticated: false,
        isSuperAdmin: false,
      });
      useTenantStore.getState().clear();
    }
  },

  // ---------------------------------------------------------------------------
  // initialize — set up onAuthStateChanged listener
  // Returns unsubscribe function for cleanup.
  //
  // On user login:
  //   1. Loads DealerUser from Firestore users/{uid}
  //   2. Checks if UID is in SUPER_ADMIN_UIDS
  //   3. Triggers tenant resolution
  //
  // On user logout:
  //   1. Clears auth state
  //   2. Clears tenant store
  // ---------------------------------------------------------------------------
  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthStore] onAuthStateChanged fired, user:', user ? user.uid : 'null');
      if (user) {
        // User logged in
        set({
          firebaseUser: user,
          isAuthenticated: true,
          isSuperAdmin: isSuperAdmin(user.uid),
          isLoading: true,
        });
        console.log('[AuthStore] State set, isLoading: true. Starting data load...');

        // Refresh session cookie — force a fresh ID token so createSessionCookie()
        // accepts it (requires token < 5 min old). Best-effort, non-blocking.
        // With Firebase session cookies (14-day expiry), the existing cookie is
        // still valid even if this refresh fails — it just resets the 14-day window.
        user.getIdToken(true).then((idToken) => {
          console.log('[AuthStore] Got fresh ID token, refreshing session cookie...');
          fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }).catch(() => {});
        }).catch(() => {});

        try {
          // Load DealerUser from Firestore users/{uid}
          // Wrap in a timeout — if Firestore SDK hangs (e.g. broken IndexedDB),
          // we fail fast instead of showing a loading screen forever.
          console.log('[AuthStore] Calling getDoc for users/' + user.uid + '...');
          const userDoc = await Promise.race([
            getDoc(doc(db, 'users', user.uid)),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Firestore getDoc timed out after 15s')), 15_000)
            ),
          ]);
          console.log('[AuthStore] getDoc returned, exists:', userDoc.exists());
          if (userDoc.exists()) {
            const data = userDoc.data();
            const dealerUser: DealerUser = {
              id: userDoc.id,
              email: data.email,
              displayName: data.displayName,
              phone: data.phone,
              photoURL: data.photoURL,
              dealershipId: data.dealershipId,
              role: data.role,
              permissions: data.permissions,
              fcmTokens: data.fcmTokens,
              createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
              lastActiveAt: data.lastActiveAt?.toDate?.() ?? (data.lastActiveAt ? new Date(data.lastActiveAt) : undefined),
              preferences: data.preferences,
            };
            set({ dealerUser, isLoading: false });
          } else {
            console.warn(`[AuthStore] No DealerUser document found for uid: ${user.uid}`);
            set({ dealerUser: null, isLoading: false });
          }

          // Resolve tenant context
          await useTenantStore.getState().resolve(user.uid);
        } catch (err) {
          console.error('[AuthStore] Failed to load user data:', err);
          set({ isLoading: false });
        }
      } else {
        // User logged out — clear everything
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        set({
          firebaseUser: null,
          dealerUser: null,
          isLoading: false,
          isAuthenticated: false,
          isSuperAdmin: false,
        });
        useTenantStore.getState().clear();
      }
    });

    return unsubscribe;
  },
}));
