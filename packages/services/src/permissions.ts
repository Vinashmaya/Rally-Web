// @rally/services — PermissionResolver
// Port of iOS PermissionResolver.swift to TypeScript
// 5-layer permission merge: role defaults -> custom role -> user overrides -> store flags -> group flags

import type { UserRole, UserPermissions } from '@rally/firebase/types';
import type { StoreMembership, Store, DealerGroup } from '@rally/firebase/types';
import { DEFAULT_PERMISSIONS, ROLE_HIERARCHY } from '@rally/firebase/types';

// ---------------------------------------------------------------------------
// PermissionKey — matches iOS PermissionKey enum
// ---------------------------------------------------------------------------

export type PermissionKey =
  | 'canViewAllVehicles'
  | 'canChangeAnyStatus'
  | 'canStartTestDrive'
  | 'canMarkAsSold'
  | 'canMoveToService'
  | 'canCompleteDetail'
  | 'canViewAnalytics'
  | 'canManageUsers'
  | 'canProgramNfcTags'
  | 'canExportData'
  | 'canViewTelemetry'
  | 'canOverrideHolds'
  | 'canDeleteInteractions'
  | 'canAccessAllDepartments';

/** All permission keys for iteration — matches iOS PermissionKey.allCases */
export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'canViewAllVehicles',
  'canChangeAnyStatus',
  'canStartTestDrive',
  'canMarkAsSold',
  'canMoveToService',
  'canCompleteDetail',
  'canViewAnalytics',
  'canManageUsers',
  'canProgramNfcTags',
  'canExportData',
  'canViewTelemetry',
  'canOverrideHolds',
  'canDeleteInteractions',
  'canAccessAllDepartments',
] as const;

// ---------------------------------------------------------------------------
// ResolvedPermissions — matches iOS ResolvedPermissions struct
// ---------------------------------------------------------------------------

export interface ResolvedPermissions {
  readonly storeId: string;
  readonly role: UserRole;
  readonly permissions: Set<PermissionKey>;
  readonly resolvedAt: Date;
}

/** Empty permission set — matches iOS ResolvedPermissions.empty */
export const EMPTY_RESOLVED: ResolvedPermissions = {
  storeId: '',
  role: 'salesperson',
  permissions: new Set<PermissionKey>(),
  resolvedAt: new Date(),
} as const;

// ---------------------------------------------------------------------------
// Permission Resolution — 5-layer merge
// ---------------------------------------------------------------------------

/**
 * Convert a UserPermissions object to a Set of granted PermissionKeys.
 * Matches iOS PermissionResolver.permissionSet(from:)
 */
function permissionSetFromDefaults(perms: UserPermissions): Set<PermissionKey> {
  const set = new Set<PermissionKey>();
  if (perms.canViewAllVehicles) set.add('canViewAllVehicles');
  if (perms.canChangeAnyStatus) set.add('canChangeAnyStatus');
  if (perms.canStartTestDrive) set.add('canStartTestDrive');
  if (perms.canMarkAsSold) set.add('canMarkAsSold');
  if (perms.canMoveToService) set.add('canMoveToService');
  if (perms.canCompleteDetail) set.add('canCompleteDetail');
  if (perms.canViewAnalytics) set.add('canViewAnalytics');
  if (perms.canManageUsers) set.add('canManageUsers');
  if (perms.canProgramNfcTags) set.add('canProgramNfcTags');
  if (perms.canExportData) set.add('canExportData');
  if (perms.canViewTelemetry) set.add('canViewTelemetry');
  if (perms.canOverrideHolds) set.add('canOverrideHolds');
  if (perms.canDeleteInteractions) set.add('canDeleteInteractions');
  if (perms.canAccessAllDepartments) set.add('canAccessAllDepartments');
  return set;
}

/**
 * The 5-layer permission merge — matches iOS PermissionResolver.computePermissions()
 *
 * Layer 1: System role defaults (from DEFAULT_PERMISSIONS)
 * Layer 2: Custom role overrides (future — loads from groups/{groupId}/roles/{customRoleId})
 * Layer 3: Per-user permission overrides from membership.permissionOverrides
 * Layer 4: Store feature flags (additive only — can only enable beyond defaults)
 * Layer 5: Group feature flags (restrictive — can only disable)
 */
export function resolvePermissions(
  membership: StoreMembership,
  store: Store,
  group: DealerGroup | null
): ResolvedPermissions {
  // Layer 1: Start with system role defaults
  const roleDefaults = DEFAULT_PERMISSIONS[membership.role];
  const granted = permissionSetFromDefaults(roleDefaults);

  // Layer 2: Custom role overrides (future implementation)
  // When custom roles are implemented, they would be loaded from
  // groups/{groupId}/roles/{membership.customRoleId} and applied here.

  // Layer 3: Per-user permission overrides (absolute: grant or deny)
  for (const [key, override] of Object.entries(membership.permissionOverrides)) {
    // Validate that the key is a valid PermissionKey
    if (!ALL_PERMISSION_KEYS.includes(key as PermissionKey)) continue;
    const permKey = key as PermissionKey;
    if (override === 'grant') {
      granted.add(permKey);
    } else if (override === 'deny') {
      granted.delete(permKey);
    }
  }

  // Layer 4: Store feature flags (additive only)
  // Store flags control feature availability at the store level,
  // not individual user permissions. They are checked separately
  // via store.featureFlags (e.g., store.featureFlags.detailTrackingEnabled).
  // No PermissionKey mutations here — by design.

  // Layer 5: Group feature flags (restrictive — can ONLY disable)
  if (group) {
    if (!group.featureFlags.nfcEnabled) {
      granted.delete('canProgramNfcTags');
    }
    if (!group.featureFlags.testDriveTrackingEnabled) {
      granted.delete('canStartTestDrive');
    }
    if (!group.featureFlags.analyticsEnabled) {
      granted.delete('canViewAnalytics');
      granted.delete('canViewTelemetry');
    }
  }

  return {
    storeId: membership.storeId,
    role: membership.role,
    permissions: granted,
    resolvedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Permission Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a resolved permission set grants a specific permission.
 * Matches iOS ResolvedPermissions.can(_:)
 */
export function can(resolved: ResolvedPermissions, permission: PermissionKey): boolean {
  return resolved.permissions.has(permission);
}

/**
 * Role hierarchy — re-exported from @rally/firebase/types for convenience.
 * Lower number = more authority. Matches iOS UserRole.hierarchyLevel.
 */
export { ROLE_HIERARCHY } from '@rally/firebase/types';

/**
 * Check if a role is a manager level (hierarchyLevel <= 3).
 * Matches iOS UserRole.isManager.
 */
export function isManager(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] <= 3;
}

/**
 * Determine which portals a role can access.
 * - staff: all roles can access
 * - manage: owner, general_manager, sales_manager (limited)
 * - admin: super admin only (checked by UID via isSuperAdmin, not by role)
 */
export function canAccessPortal(
  role: UserRole,
  portal: 'staff' | 'manage' | 'admin'
): boolean {
  switch (portal) {
    case 'staff':
      // All roles can access the staff app
      return true;

    case 'manage':
      // Only owner, general_manager, and sales_manager (limited) can access manage
      return ['owner', 'general_manager', 'sales_manager'].includes(role);

    case 'admin':
      // Super admin access is checked by UID, not by role.
      // No role alone grants admin portal access.
      return false;
  }
}

/**
 * Convert a ResolvedPermissions set back to a UserPermissions object.
 * Matches iOS ResolvedPermissions.asUserPermissions.
 */
export function toUserPermissions(resolved: ResolvedPermissions): UserPermissions {
  return {
    canViewAllVehicles: resolved.permissions.has('canViewAllVehicles'),
    canChangeAnyStatus: resolved.permissions.has('canChangeAnyStatus'),
    canStartTestDrive: resolved.permissions.has('canStartTestDrive'),
    canMarkAsSold: resolved.permissions.has('canMarkAsSold'),
    canMoveToService: resolved.permissions.has('canMoveToService'),
    canCompleteDetail: resolved.permissions.has('canCompleteDetail'),
    canViewAnalytics: resolved.permissions.has('canViewAnalytics'),
    canManageUsers: resolved.permissions.has('canManageUsers'),
    canProgramNfcTags: resolved.permissions.has('canProgramNfcTags'),
    canExportData: resolved.permissions.has('canExportData'),
    canViewTelemetry: resolved.permissions.has('canViewTelemetry'),
    canOverrideHolds: resolved.permissions.has('canOverrideHolds'),
    canDeleteInteractions: resolved.permissions.has('canDeleteInteractions'),
    canAccessAllDepartments: resolved.permissions.has('canAccessAllDepartments'),
  };
}
