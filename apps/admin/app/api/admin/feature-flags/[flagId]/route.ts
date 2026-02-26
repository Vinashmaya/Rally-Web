import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

const COLLECTION = 'featureFlags' as const;

// PUT — Update a specific feature flag
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const { flagId } = await params;
    const body = await request.json();

    const { name, enabled, description, rolloutPercentage, tenantOverrides } = body as {
      name?: string;
      enabled?: boolean;
      description?: string;
      rolloutPercentage?: number;
      tenantOverrides?: Record<string, boolean>;
    };

    // Verify flag exists
    const flagDoc = await adminDb.collection(COLLECTION).doc(flagId).get();
    if (!flagDoc.exists) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    const updateData: Record<string, string | boolean | number | Record<string, boolean>> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (typeof enabled === 'boolean') updateData.enabled = enabled;
    if (description !== undefined) updateData.description = description;
    if (typeof rolloutPercentage === 'number') updateData.rolloutPercentage = rolloutPercentage;
    if (tenantOverrides !== undefined) updateData.tenantOverrides = tenantOverrides;

    await adminDb.collection(COLLECTION).doc(flagId).update(updateData);

    return NextResponse.json({
      success: true,
      data: { id: flagId, ...updateData },
    });
  } catch (error) {
    console.error('[API] Feature flag update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

// DELETE — Delete a specific feature flag
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const { flagId } = await params;

    // Verify flag exists
    const flagDoc = await adminDb.collection(COLLECTION).doc(flagId).get();
    if (!flagDoc.exists) {
      return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 });
    }

    await adminDb.collection(COLLECTION).doc(flagId).delete();

    return NextResponse.json({
      success: true,
      data: { deletedId: flagId },
    });
  } catch (error) {
    console.error('[API] Feature flag delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
