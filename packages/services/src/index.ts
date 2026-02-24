// @rally/services — business logic, tenant context, permission resolution
// Re-exports everything for convenient single-import usage

// Permission resolution — the 5-layer merge
export {
  resolvePermissions,
  can,
  isManager,
  canAccessPortal,
  toUserPermissions,
  ROLE_HIERARCHY,
  ALL_PERMISSION_KEYS,
  EMPTY_RESOLVED,
} from './permissions';
export type {
  PermissionKey,
  ResolvedPermissions,
} from './permissions';

// Tenant context — active group/store/membership
export { useTenantStore } from './tenant';

// Super admin utilities
export { isSuperAdmin, getSuperAdminUids } from './superAdmin';

// Zustand stores
export {
  useAuthStore,
  usePermissionStore,
  initPermissionSubscription,
} from './stores';
