import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb, requireSuperAdmin, isVerifiedSession, FieldValue } from '@rally/firebase/admin';
import { lotGridConfigSchema } from '@rally/firebase';

export const dynamic = 'force-dynamic';

// GET — List lot configs for a specific store
// Query params: groupId, storeId
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const storeId = searchParams.get('storeId');

  if (!groupId || !storeId) {
    return NextResponse.json(
      { error: 'Missing groupId or storeId' },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getAdminDb()
      .collection('groups')
      .doc(groupId)
      .collection('stores')
      .doc(storeId)
      .collection('lotConfigs')
      .orderBy('name')
      .get();

    const configs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ configs });
  } catch (err) {
    console.error('[lot-config GET]', err);
    return NextResponse.json(
      { error: 'Failed to fetch lot configs' },
      { status: 500 },
    );
  }
}

// POST — Create or update a lot config
// Body: LotGridConfig (if id is present, update; otherwise create)
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  try {
    const body = await request.json();
    const parsed = lotGridConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { groupId, storeId, id, ...configData } = parsed.data;

    const configsRef = getAdminDb()
      .collection('groups')
      .doc(groupId)
      .collection('stores')
      .doc(storeId)
      .collection('lotConfigs');

    if (id) {
      // Update existing
      await configsRef.doc(id).set(
        {
          ...configData,
          groupId,
          storeId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return NextResponse.json({ id, updated: true });
    } else {
      // Create new
      const docRef = await configsRef.add({
        ...configData,
        groupId,
        storeId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: auth.uid,
      });
      return NextResponse.json({ id: docRef.id, created: true });
    }
  } catch (err) {
    console.error('[lot-config POST]', err);
    return NextResponse.json(
      { error: 'Failed to save lot config' },
      { status: 500 },
    );
  }
}

// DELETE — Remove a lot config
// Query params: groupId, storeId, configId
export async function DELETE(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('groupId');
  const storeId = searchParams.get('storeId');
  const configId = searchParams.get('configId');

  if (!groupId || !storeId || !configId) {
    return NextResponse.json(
      { error: 'Missing groupId, storeId, or configId' },
      { status: 400 },
    );
  }

  try {
    await getAdminDb()
      .collection('groups')
      .doc(groupId)
      .collection('stores')
      .doc(storeId)
      .collection('lotConfigs')
      .doc(configId)
      .delete();

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[lot-config DELETE]', err);
    return NextResponse.json(
      { error: 'Failed to delete lot config' },
      { status: 500 },
    );
  }
}
