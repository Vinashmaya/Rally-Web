import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireAuth, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'vehicleLists' as const;

// PUT — Update a vehicle list
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!isVerifiedSession(auth)) return auth;

    const { listId } = await params;
    const body = await request.json();

    const { name, color, icon } = body as {
      name?: string;
      color?: string;
      icon?: string;
    };

    // Verify list exists
    const listDoc = await adminDb.collection(COLLECTION).doc(listId).get();
    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const updateData: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;

    await adminDb.collection(COLLECTION).doc(listId).update(updateData);

    return NextResponse.json({
      success: true,
      data: { id: listId, ...updateData },
    });
  } catch (error) {
    console.error('[API] List update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// DELETE — Delete a vehicle list
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!isVerifiedSession(auth)) return auth;

    const { listId } = await params;

    // Verify list exists
    const listDoc = await adminDb.collection(COLLECTION).doc(listId).get();
    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Delete all items in the list first (batch limit: 500 ops)
    const itemsSnapshot = await adminDb
      .collection(COLLECTION)
      .doc(listId)
      .collection('items')
      .get();

    const BATCH_LIMIT = 499;
    const docs = itemsSnapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const chunk = docs.slice(i, i + BATCH_LIMIT);
      const batch = adminDb.batch();
      for (const doc of chunk) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    // Delete the list document itself
    await adminDb.collection(COLLECTION).doc(listId).delete();

    return NextResponse.json({
      success: true,
      data: { deletedId: listId, deletedItems: itemsSnapshot.size },
    });
  } catch (error) {
    console.error('[API] List delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
