import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { deprovisionTenant } from '@rally/infra';
import { adminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Deprovision a tenant (soft delete with 30-day recovery window)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await params;
    const body = await request.json();

    const { reason, actorId } = body as { reason: string; actorId: string };

    if (!reason || !actorId) {
      return NextResponse.json(
        { error: 'Missing required fields: reason, actorId' },
        { status: 400 },
      );
    }

    // Look up the group slug from Firestore
    const groupDoc = await adminDb.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupData = groupDoc.data();
    const slug = groupData?.slug as string;
    if (!slug) {
      return NextResponse.json({ error: 'Group has no slug' }, { status: 422 });
    }

    const result = await deprovisionTenant({ slug, groupId, reason, actorId });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, steps: result.steps },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[API] Tenant deprovision error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
