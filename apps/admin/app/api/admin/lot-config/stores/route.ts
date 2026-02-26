import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// GET — List stores for a group
// Query params: groupId
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  const groupId = new URL(request.url).searchParams.get('groupId');
  if (!groupId) {
    return NextResponse.json({ error: 'Missing groupId' }, { status: 400 });
  }

  try {
    const snapshot = await getAdminDb()
      .collection('groups')
      .doc(groupId)
      .collection('stores')
      .get();

    const stores = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name ?? doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ stores });
  } catch (err) {
    console.error('[lot-config/stores GET]', err);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}
