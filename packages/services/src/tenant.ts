'use client';

// @rally/services — TenantContext Zustand Store
// Port of iOS TenantContext.swift to a Zustand store
// Single source of truth for active group/store/membership

import { create } from 'zustand';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@rally/firebase/client';
import type {
  UserRole,
  EmployeeProfile,
  StoreMembership,
  Store,
  DealerGroup,
} from '@rally/firebase/types';

// ---------------------------------------------------------------------------
// State Interface
// ---------------------------------------------------------------------------

interface TenantState {
  // Core state
  employee: EmployeeProfile | null;
  memberships: StoreMembership[];
  activeStore: Store | null;
  activeGroup: DealerGroup | null;
  activeMembership: StoreMembership | null;
  availableStores: Store[];
  isLoading: boolean;
  error: string | null;

  // Computed-like getters (derived from state)
  readonly activeStoreId: string | undefined;
  readonly activeGroupId: string | undefined;
  readonly activeRole: UserRole | undefined;
  readonly isManagerAtActiveStore: boolean;
  readonly isResolved: boolean;

  // Actions
  resolve: (uid: string) => Promise<void>;
  switchStore: (store: Store) => Promise<void>;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const INITIAL_STATE: Pick<TenantState, 'employee' | 'memberships' | 'activeStore' | 'activeGroup' | 'activeMembership' | 'availableStores' | 'isLoading' | 'error'> = {
  employee: null,
  memberships: [],
  activeStore: null,
  activeGroup: null,
  activeMembership: null,
  availableStores: [],
  isLoading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a role is manager level (hierarchyLevel <= 3) */
function isManagerRole(role: UserRole): boolean {
  const managerRoles: UserRole[] = [
    'owner', 'general_manager', 'sales_manager',
    'service_manager', 'finance_manager', 'desk_manager',
  ];
  return managerRoles.includes(role);
}

/**
 * Load a group document from Firestore.
 * groups/{groupId}
 */
async function loadGroup(groupId: string): Promise<DealerGroup | null> {
  try {
    const groupDoc = await getDoc(doc(db, 'groups', groupId));
    if (!groupDoc.exists()) return null;
    const data = groupDoc.data();
    return {
      id: groupDoc.id,
      name: data.name,
      slug: data.slug ?? '',
      ownerId: data.ownerId,
      status: data.status,
      createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(data.updatedAt),
      featureFlags: {
        nfcEnabled: data.featureFlags?.nfcEnabled ?? true,
        testDriveTrackingEnabled: data.featureFlags?.testDriveTrackingEnabled ?? true,
        crossStoreInventoryEnabled: data.featureFlags?.crossStoreInventoryEnabled ?? false,
        analyticsEnabled: data.featureFlags?.analyticsEnabled ?? true,
      },
    } satisfies DealerGroup;
  } catch (err) {
    console.error(`[TenantStore] Failed to load group ${groupId}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const useTenantStore = create<TenantState>()((set, get) => ({
  // Initial state
  ...INITIAL_STATE,

  // Computed getters
  get activeStoreId() {
    return get().activeStore?.id;
  },
  get activeGroupId() {
    return get().activeGroup?.id;
  },
  get activeRole() {
    return get().activeMembership?.role;
  },
  get isManagerAtActiveStore() {
    const role = get().activeMembership?.role;
    return role ? isManagerRole(role) : false;
  },
  get isResolved() {
    return get().activeStore !== null && get().activeMembership !== null;
  },

  // ---------------------------------------------------------------------------
  // resolve() — Called after authentication to load tenant context.
  // Matches iOS TenantContext.resolveMultiTenant(employeeUid:)
  // ---------------------------------------------------------------------------
  resolve: async (uid: string) => {
    set({ isLoading: true, error: null });

    try {
      // 1. Load EmployeeProfile from employees/{uid}
      const empDoc = await getDoc(doc(db, 'employees', uid));
      if (!empDoc.exists()) {
        set({ isLoading: false, error: 'Employee profile not found. Contact your administrator.' });
        return;
      }
      const empData = empDoc.data();
      const employee: EmployeeProfile = {
        id: empDoc.id,
        email: empData.email,
        displayName: empData.displayName,
        phone: empData.phone,
        photoURL: empData.photoURL,
        status: empData.status,
        createdAt: empData.createdAt?.toDate?.() ?? new Date(empData.createdAt),
        updatedAt: empData.updatedAt?.toDate?.() ?? new Date(empData.updatedAt),
        lastActiveAt: empData.lastActiveAt?.toDate?.() ?? (empData.lastActiveAt ? new Date(empData.lastActiveAt) : undefined),
      };

      if (employee.status !== 'active') {
        set({ isLoading: false, error: 'Your account has been suspended.' });
        return;
      }

      // 2. Load all active memberships from employees/{uid}/memberships
      const membershipQuery = query(
        collection(db, 'employees', uid, 'memberships'),
        where('status', '==', 'active')
      );
      const membershipSnapshot = await getDocs(membershipQuery);
      const memberships: StoreMembership[] = membershipSnapshot.docs.map((memberDoc) => {
        const d = memberDoc.data();
        return {
          id: memberDoc.id,
          employeeUid: d.employeeUid,
          groupId: d.groupId,
          storeId: d.storeId,
          role: d.role,
          customRoleId: d.customRoleId,
          permissionOverrides: d.permissionOverrides ?? {},
          isPrimary: d.isPrimary ?? false,
          joinedAt: d.joinedAt?.toDate?.() ?? new Date(d.joinedAt),
          invitedBy: d.invitedBy,
          status: d.status,
        } satisfies StoreMembership;
      });

      if (memberships.length === 0) {
        set({
          employee,
          isLoading: false,
          error: "You don't have access to any stores. Contact your administrator.",
        });
        return;
      }

      // 3. Load all available stores
      const stores: Store[] = [];
      for (const membership of memberships) {
        try {
          const storeDoc = await getDoc(
            doc(db, 'groups', membership.groupId, 'stores', membership.storeId)
          );
          if (storeDoc.exists()) {
            const sd = storeDoc.data();
            stores.push({
              id: storeDoc.id,
              groupId: sd.groupId,
              name: sd.name,
              address: sd.address,
              city: sd.city,
              state: sd.state,
              zipCode: sd.zipCode,
              phone: sd.phone,
              status: sd.status,
              createdAt: sd.createdAt?.toDate?.() ?? new Date(sd.createdAt),
              updatedAt: sd.updatedAt?.toDate?.() ?? new Date(sd.updatedAt),
              location: sd.location,
              timezone: sd.timezone ?? 'America/Chicago',
              settings: sd.settings ?? {
                testDriveGeofenceRadius: 16093.4,
                testDriveMaxDuration: 60,
                requireCustomerInfo: false,
                requireLicenseVerification: true,
                holdExpirationHours: 48,
                allowHoldExtensions: true,
                maxHoldExtensions: 2,
                daysOnLotWarning: 45,
                daysOnLotCritical: 90,
                detailTimeWarningMinutes: 240,
                testDriveTimeWarningMinutes: 45,
              },
              featureFlags: {
                detailTrackingEnabled: sd.featureFlags?.detailTrackingEnabled ?? true,
                fuelTrackingEnabled: sd.featureFlags?.fuelTrackingEnabled ?? true,
                photoRequiredOnDelivery: sd.featureFlags?.photoRequiredOnDelivery ?? false,
              },
              logoUrl: sd.logoUrl,
              primaryColor: sd.primaryColor,
            } satisfies Store);
          }
        } catch (err) {
          console.error(`[TenantStore] Failed to load store ${membership.storeId}:`, err);
        }
      }

      // 4. Select the primary membership's store as default
      const primaryMembership =
        memberships.find((m) => m.isPrimary) ?? memberships[0];

      if (!primaryMembership) {
        set({
          employee,
          memberships,
          availableStores: stores,
          isLoading: false,
          error: 'No active store could be selected.',
        });
        return;
      }

      const primaryStore = stores.find((s) => s.id === primaryMembership.storeId);
      if (!primaryStore) {
        set({
          employee,
          memberships,
          availableStores: stores,
          isLoading: false,
          error: 'No active store could be selected.',
        });
        return;
      }

      // 5. Load the group for the active store
      const group = await loadGroup(primaryMembership.groupId);

      set({
        employee,
        memberships,
        activeStore: primaryStore,
        activeGroup: group,
        activeMembership: primaryMembership,
        availableStores: stores,
        isLoading: false,
        error: null,
      });

      console.info(
        `[TenantStore] Resolved: ${stores.length} stores, active: ${primaryStore.name}`
      );
    } catch (err) {
      console.error('[TenantStore] Failed to resolve tenant context:', err);
      set({
        isLoading: false,
        error: 'Failed to load your account. Please try again.',
      });
    }
  },

  // ---------------------------------------------------------------------------
  // switchStore() — Switch to a different store (multi-tenant).
  // Matches iOS TenantContext.switchStore(to:)
  // ---------------------------------------------------------------------------
  switchStore: async (store: Store) => {
    const { memberships, activeGroup } = get();

    // 1. Verify membership exists for that store
    const membership = memberships.find((m) => m.storeId === store.id);
    if (!membership) {
      set({ error: `You don't have access to ${store.name}.` });
      return;
    }

    if (membership.status !== 'active') {
      set({ error: `Your access to ${store.name} has been suspended.` });
      return;
    }

    // 2. Update activeStore, activeMembership
    set({
      activeStore: store,
      activeMembership: membership,
      error: null,
    });

    // 3. Load group if different
    if (store.groupId !== activeGroup?.id) {
      const newGroup = await loadGroup(store.groupId);
      set({ activeGroup: newGroup });
    }

    console.info(`[TenantStore] Switched to store: ${store.name}`);
  },

  // ---------------------------------------------------------------------------
  // clear() — Clear all tenant state (on sign out).
  // Matches iOS TenantContext.clear()
  // ---------------------------------------------------------------------------
  clear: () => {
    set({ ...INITIAL_STATE });
  },
}));
