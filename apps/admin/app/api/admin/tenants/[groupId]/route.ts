import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — Fetch tenant detail (group + stores + aggregate stats)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const auth = await requireSuperAdmin();
    if (!isVerifiedSession(auth)) return auth;

    const { groupId } = await params;

    // Fetch group document
    const groupDoc = await adminDb.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupData = groupDoc.data();

    // Fetch stores subcollection
    const storesSnapshot = await adminDb
      .collection('groups')
      .doc(groupId)
      .collection('stores')
      .get();

    const stores = storesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Count users who belong to this group (via memberships collection group)
    let userCount = 0;
    try {
      const membersSnapshot = await adminDb
        .collectionGroup('memberships')
        .where('groupId', '==', groupId)
        .where('status', '==', 'active')
        .get();
      userCount = membersSnapshot.size;
    } catch {
      userCount = 0;
    }

    // Count vehicles across all stores in this group
    let vehicleCount = 0;
    for (const store of stores) {
      try {
        const storeId = (store as Record<string, unknown>).id as string;
        const vehiclesSnapshot = await adminDb
          .collection('vehicles')
          .where('dealershipId', '==', storeId)
          .count()
          .get();
        vehicleCount += vehiclesSnapshot.data().count;
      } catch {
        // Individual store count failures are non-fatal
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: groupDoc.id,
        ...groupData,
        stores,
        stats: {
          users: userCount,
          stores: stores.length,
          vehicles: vehicleCount,
        },
      },
    });
  } catch (error) {
    console.error('[API] Tenant detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
