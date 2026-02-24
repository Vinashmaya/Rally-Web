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
  // ---------------------------------------------------------------------------
  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged listener handles the rest
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // signOut — sign out and clear all state
  // ---------------------------------------------------------------------------
  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged listener handles clearing state
    } catch (err) {
      console.error('[AuthStore] Sign out error:', err);
      // Force-clear state even if Firebase signout fails
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
      if (user) {
        // User logged in
        set({
          firebaseUser: user,
          isAuthenticated: true,
          isSuperAdmin: isSuperAdmin(user.uid),
          isLoading: true,
        });

        try {
          // Load DealerUser from Firestore users/{uid}
          const userDoc = await getDoc(doc(db, 'users', user.uid));
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
