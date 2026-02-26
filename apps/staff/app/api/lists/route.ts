import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireAuth, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'vehicleLists' as const;

// POST — Create a new vehicle list
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { name, color, icon, ownerName } = body as {
      name: string;
      color: string;
      icon: string;
      ownerName: string;
    };

    if (!name || !color || !icon || !ownerName) {
      return NextResponse.json(
        { error: 'Missing required fields: name, color, icon, ownerName' },
        { status: 400 },
      );
    }

    // Tenant isolation: dealershipId and ownerId come from the verified session,
    // never from the client body. This prevents cross-tenant list creation and
    // ownership spoofing.
    const dealershipId = auth.dealershipId;
    if (!dealershipId) {
      return NextResponse.json(
        { error: 'Session missing dealershipId claim' },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();

    const listRef = adminDb.collection(COLLECTION).doc();
    const listData = {
      name,
      color,
      icon,
      dealershipId,
      ownerId: auth.uid,
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
