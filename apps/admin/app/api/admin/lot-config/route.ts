import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminDb, requireSuperAdmin, isVerifiedSession, FieldValue } from '@rally/firebase/admin';
import { lotGridConfigSchema } from '@rally/firebase';
import type { LotSpace } from '@rally/firebase';

export const dynamic = 'force-dynamic';

// Firestore rejects nested arrays ([[lng,lat],...]).
// Convert [lng,lat] tuples ↔ {lng,lat} objects at the API boundary.
function spacesToFirestore(spaces: LotSpace[]) {
  return spaces.map((s) => ({
    ...s,
    coordinates: s.coordinates.map((c) => ({ lng: c[0], lat: c[1] })),
  }));
}

function spacesFromFirestore(spaces: unknown[]): LotSpace[] {
  return spaces.map((raw) => {
    const s = raw as Record<string, unknown>;
    return {
      ...s,
      coordinates: ((s.coordinates ?? []) as { lng: number; lat: number }[]).map(
        (c) => [c.lng, c.lat] as [number, number],
      ),
    } as LotSpace;
  });
}

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

    const configs = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert {lng,lat} objects back to [lng,lat] tuples for the client
        spaces: data.spaces ? spacesFromFirestore(data.spaces) : [],
        // Also convert overlayCorners if stored as objects
        overlayCorners: data.overlayCorners
          ? (data.overlayCorners as { lng: number; lat: number }[]).map(
              (c: { lng: number; lat: number }) =>
                typeof c === 'object' && 'lng' in c ? [c.lng, c.lat] : c,
            )
          : data.overlayCorners,
      };
    });

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

    // Convert coordinates to Firestore-safe format (no nested arrays)
    const firestoreData = {
      ...configData,
      spaces: configData.spaces ? spacesToFirestore(configData.spaces) : [],
    };

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
          ...firestoreData,
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
        ...firestoreData,
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
