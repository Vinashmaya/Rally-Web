import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, FieldValue } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'vehicleLists' as const;

// POST — Add a vehicle to a list
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    const body = await request.json();

    const { vin, stockNumber, year, make, model, trim, addedBy } = body as {
      vin: string;
      stockNumber: string;
      year: number;
      make: string;
      model: string;
      trim?: string;
      addedBy: string;
    };

    if (!vin || !stockNumber || !year || !make || !model || !addedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: vin, stockNumber, year, make, model, addedBy' },
        { status: 400 },
      );
    }

    // Verify list exists
    const listDoc = await adminDb.collection(COLLECTION).doc(listId).get();
    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Check if vehicle is already in the list
    const existing = await adminDb
      .collection(COLLECTION)
      .doc(listId)
      .collection('items')
      .where('vin', '==', vin)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: 'Vehicle is already in this list' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const itemRef = adminDb
      .collection(COLLECTION)
      .doc(listId)
      .collection('items')
      .doc();

    const itemData = {
      vin,
      stockNumber,
      year,
      make,
      model,
      trim: trim ?? null,
      addedBy,
      addedAt: now,
    };

    await itemRef.set(itemData);

    // Increment vehicle count on the list
    await adminDb.collection(COLLECTION).doc(listId).update({
      vehicleCount: FieldValue.increment(1),
      updatedAt: now,
    });

    return NextResponse.json({
      success: true,
      data: { id: itemRef.id, listId, ...itemData },
    });
  } catch (error) {
    console.error('[API] List item add error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// DELETE — Remove a vehicle from a list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> },
) {
  try {
    const { listId } = await params;
    const body = await request.json();

    const { vin } = body as { vin: string };

    if (!vin) {
      return NextResponse.json(
        { error: 'Missing required field: vin' },
        { status: 400 },
      );
    }

    // Verify list exists
    const listDoc = await adminDb.collection(COLLECTION).doc(listId).get();
    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    // Find the item by VIN
    const itemsSnapshot = await adminDb
      .collection(COLLECTION)
      .doc(listId)
      .collection('items')
      .where('vin', '==', vin)
      .limit(1)
      .get();

    if (itemsSnapshot.empty) {
      return NextResponse.json(
        { error: 'Vehicle not found in this list' },
        { status: 404 },
      );
    }

    const itemDoc = itemsSnapshot.docs[0];
    if (!itemDoc) {
      return NextResponse.json(
        { error: 'Vehicle not found in this list' },
        { status: 404 },
      );
    }

    await itemDoc.ref.delete();

    // Decrement vehicle count on the list
    await adminDb.collection(COLLECTION).doc(listId).update({
      vehicleCount: FieldValue.increment(-1),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: { deletedId: itemDoc.id, listId, vin },
    });
  } catch (error) {
    console.error('[API] List item remove error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
