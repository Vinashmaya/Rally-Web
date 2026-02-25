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

        // Count members (via memberships collection group, matching useAllUsers hook)
        let usersCount = 0;
        try {
          const membersSnapshot = await getAdminDb()
            .collectionGroup('memberships')
            .where('groupId', '==', groupId)
            .where('status', '==', 'active')
            .get();
          usersCount = membersSnapshot.size;
        } catch { /* may not exist */ }

        // Count vehicles across all stores in this group
        // Vehicles are scoped by dealershipId (store), not groupId
        let vehiclesCount = 0;
        if (storesCount > 0) {
          try {
            const storesDocs = await getAdminDb()
              .collection('groups')
              .doc(groupId)
              .collection('stores')
              .get();
            const storeCounts = await Promise.all(
              storesDocs.docs.map(async (storeDoc) => {
                try {
                  const result = await getAdminDb()
                    .collection('vehicles')
                    .where('dealershipId', '==', storeDoc.id)
                    .count()
                    .get();
                  return result.data().count;
                } catch { return 0; }
              }),
            );
            vehiclesCount = storeCounts.reduce((sum, c) => sum + c, 0);
          } catch { /* non-fatal */ }
        }

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
