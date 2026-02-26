import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — List all users with real auth data (email, displayName) merged with membership roles
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  try {
    // Get all memberships across all tenants
    // No orderBy — collection group queries on 'joinedAt' require an explicit
    // index that hasn't been deployed yet. We fetch all memberships and sort
    // client-side after merging with Auth data.
    const membershipsSnapshot = await getAdminDb()
      .collectionGroup('memberships')
      .get();

    // Collect unique UIDs
    interface MembershipDoc {
      id: string;
      employeeUid: string;
      role: string;
      status: string;
      storeId: string;
      groupId: string;
      joinedAt: unknown;
    }

    const uidSet = new Set<string>();
    const memberships: MembershipDoc[] = membershipsSnapshot.docs.map((doc) => {
      const data = doc.data();
      // UID can be stored as a field OR extracted from the doc path:
      // employees/{uid}/memberships/{storeId}
      const uid = (data.employeeUid ?? data.uid ?? doc.ref.parent.parent?.id ?? '') as string;
      uidSet.add(uid);
      return {
        id: doc.id,
        employeeUid: uid,
        role: data.role as string,
        status: data.status as string,
        storeId: (data.storeId ?? data.dealershipId ?? doc.id) as string,
        groupId: data.groupId as string,
        joinedAt: data.joinedAt,
      };
    });

    // Batch-fetch Firebase Auth user records (max 100 per getUsers call)
    const uids = Array.from(uidSet);
    const authUsers = new Map<string, { email: string; displayName: string; disabled: boolean }>();

    for (let i = 0; i < uids.length; i += 100) {
      const batch = uids.slice(i, i + 100);
      try {
        const result = await getAdminAuth().getUsers(
          batch.map((uid) => ({ uid })),
        );
        for (const user of result.users) {
          authUsers.set(user.uid, {
            email: user.email ?? '',
            displayName: user.displayName ?? user.email ?? user.uid,
            disabled: user.disabled,
          });
        }
      } catch {
        // If batch fails, skip — users will show UID as fallback
      }
    }

    // Merge membership + auth data
    const users = memberships.map((m) => {
      const authUser = authUsers.get(m.employeeUid);
      return {
        id: m.employeeUid,
        email: authUser?.email ?? '',
        displayName: authUser?.displayName ?? m.employeeUid,
        role: m.role ?? 'salesperson',
        status: authUser?.disabled ? 'disabled' : (m.status === 'suspended' ? 'disabled' : 'active'),
        dealershipId: m.storeId ?? '',
        groupId: m.groupId ?? '',
        joinedAt: m.joinedAt
          ? new Date(((m.joinedAt as { _seconds?: number })._seconds ?? 0) * 1000).toISOString()
          : null,
      };
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('[API] Admin users list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
