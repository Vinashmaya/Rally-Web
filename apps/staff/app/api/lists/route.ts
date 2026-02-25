import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireAuth, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'vehicleLists' as const;

// POST — Create a new vehicle list
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { name, color, icon, dealershipId, ownerId, ownerName } = body as {
      name: string;
      color: string;
      icon: string;
      dealershipId: string;
      ownerId: string;
      ownerName: string;
    };

    if (!name || !color || !icon || !dealershipId || !ownerId || !ownerName) {
      return NextResponse.json(
        { error: 'Missing required fields: name, color, icon, dealershipId, ownerId, ownerName' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const listRef = adminDb.collection(COLLECTION).doc();
    const listData = {
      name,
      color,
      icon,
      dealershipId,
      ownerId,
      ownerName,
      vehicleCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await listRef.set(listData);

    return NextResponse.json({
      success: true,
      data: { id: listRef.id, ...listData },
    });
  } catch (error) {
    console.error('[API] List create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
