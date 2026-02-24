'use client';

// @rally/services — Permission State Zustand Store
// Subscribes to tenant store and recomputes permissions when
// activeStore/activeMembership changes.

import { create } from 'zustand';
import type { ResolvedPermissions, PermissionKey } from '../permissions';
import {
  resolvePermissions,
  can as canCheck,
  EMPTY_RESOLVED,
} from '../permissions';
import { useTenantStore } from '../tenant';

// ---------------------------------------------------------------------------
// State Interface
// ---------------------------------------------------------------------------

interface PermissionState {
  resolved: ResolvedPermissions;

  // Computed permission check
  can: (permission: PermissionKey) => boolean;

  // Actions
  resolve: () => void;
  invalidate: () => void;
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const usePermissionStore = create<PermissionState>()((set, get) => ({
  resolved: EMPTY_RESOLVED,

  // ---------------------------------------------------------------------------
  // can() — check a single permission against the current resolved set
  // ---------------------------------------------------------------------------
  can: (permission: PermissionKey) => {
    return canCheck(get().resolved, permission);
  },

  // ---------------------------------------------------------------------------
  // resolve() — recompute permissions from the current tenant state
  // ---------------------------------------------------------------------------
  resolve: () => {
    const tenantState = useTenantStore.getState();
    const { activeMembership, activeStore, activeGroup } = tenantState;

    if (!activeMembership || !activeStore) {
      set({ resolved: EMPTY_RESOLVED });
      return;
    }

    const resolved = resolvePermissions(activeMembership, activeStore, activeGroup);
    set({ resolved });
  },

  // ---------------------------------------------------------------------------
  // invalidate() — force a permission recompute (e.g., after role change)
  // ---------------------------------------------------------------------------
  invalidate: () => {
    get().resolve();
  },
}));

// ---------------------------------------------------------------------------
// Auto-subscribe to tenant store changes
// When activeStore or activeMembership changes, recompute permissions.
// Uses vanilla Zustand subscribe (no middleware required).
// ---------------------------------------------------------------------------

let _subscribed = false;

/**
 * Initialize the permission store subscription.
 * Call this once at app startup (e.g., in a layout effect).
 * Safe to call multiple times — only subscribes once.
 */
export function initPermissionSubscription(): () => void {
  if (_subscribed) return () => {};
  _subscribed = true;

  // Track previous identity keys to avoid redundant recomputes
  let prevStoreId = useTenantStore.getState().activeStore?.id;
  let prevMembershipId = useTenantStore.getState().activeMembership?.id;
  let prevGroupId = useTenantStore.getState().activeGroup?.id;

  const unsubscribe = useTenantStore.subscribe((state) => {
    const storeId = state.activeStore?.id;
    const membershipId = state.activeMembership?.id;
    const groupId = state.activeGroup?.id;

    // Only recompute if identity changed
    if (
      storeId !== prevStoreId ||
      membershipId !== prevMembershipId ||
      groupId !== prevGroupId
    ) {
      prevStoreId = storeId;
      prevMembershipId = membershipId;
      prevGroupId = groupId;
      usePermissionStore.getState().resolve();
    }
  });

  // Do an initial resolve
  usePermissionStore.getState().resolve();

  return () => {
    unsubscribe();
    _subscribed = false;
  };
}
