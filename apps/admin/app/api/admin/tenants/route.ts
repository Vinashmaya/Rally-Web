import { NextResponse } from 'next/server';
import { getAdminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — List all tenant groups with aggregated counts
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!isVerifiedSession(auth)) return auth;

  try {
    const groupsSnapshot = await getAdminDb()
      .collection('groups')
      .orderBy('name')
      .get();

    const tenants = await Promise.all(
      groupsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const groupId = doc.id;

        // Count stores
        let storesCount = 0;
        try {
          const storesSnapshot = await getAdminDb()
            .collection('groups')
            .doc(groupId)
            .collection('stores')
            .get();
          storesCount = storesSnapshot.size;
        } catch { /* non-fatal */ }

        // Count members
        let usersCount = 0;
        try {
          const membersSnapshot = await getAdminDb()
            .collection('groups')
            .doc(groupId)
            .collection('members')
            .get();
          usersCount = membersSnapshot.size;
        } catch { /* may not exist */ }

        // Count vehicles across stores (use count() aggregation)
        let vehiclesCount = 0;
        try {
          const countResult = await getAdminDb()
            .collection('vehicles')
            .where('groupId', '==', groupId)
            .count()
            .get();
          vehiclesCount = countResult.data().count;
        } catch { /* non-fatal */ }

        return {
          id: groupId,
          name: data.name ?? '',
          status: data.status ?? 'active',
          ownerId: data.ownerId ?? '',
          createdAt: data.createdAt ?? null,
          updatedAt: data.updatedAt ?? null,
          storesCount,
          usersCount,
          vehiclesCount,
        };
      }),
    );

    return NextResponse.json({ success: true, data: tenants });
  } catch (error) {
    console.error('[API] Tenants list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
