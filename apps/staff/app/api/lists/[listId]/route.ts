import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'vehicleLists' as const;

// PUT — Update a vehicle list
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
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
    const { listId } = await params;

    // Verify list exists
    const listDoc = await adminDb.collection(COLLECTION).doc(listId).get();
    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Delete all items in the list first
    const itemsSnapshot = await adminDb
      .collection(COLLECTION)
      .doc(listId)
      .collection('items')
      .get();

    const batch = adminDb.batch();
    for (const itemDoc of itemsSnapshot.docs) {
      batch.delete(itemDoc.ref);
    }
    // Delete the list document itself
    batch.delete(adminDb.collection(COLLECTION).doc(listId));
    await batch.commit();

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
