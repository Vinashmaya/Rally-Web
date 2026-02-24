// @rally/services — Super Admin Utilities
// Super admin status is determined by UID, not by role.
// The UID list is configured via environment variable.

/**
 * Check if a UID is a super admin.
 * Reads from NEXT_PUBLIC_SUPER_ADMIN_UIDS (comma-separated list).
 * This is the client-side check — server-side middleware also validates
 * against the non-public SUPER_ADMIN_UIDS env var independently.
 */
export function isSuperAdmin(uid: string): boolean {
  const adminUids = process.env.NEXT_PUBLIC_SUPER_ADMIN_UIDS?.split(',') ?? [];
  return adminUids.map((id) => id.trim()).includes(uid);
}

/**
 * Get the list of all super admin UIDs.
 * Returns empty array if env var is not set.
 */
export function getSuperAdminUids(): string[] {
  const raw = process.env.NEXT_PUBLIC_SUPER_ADMIN_UIDS;
  if (!raw) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}
