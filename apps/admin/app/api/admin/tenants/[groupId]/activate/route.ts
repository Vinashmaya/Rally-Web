import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Activate (un-suspend) a tenant group
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const auth = await requireSuperAdmin();
    if (!isVerifiedSession(auth)) return auth;

    const { groupId } = await params;

    // Verify group exists
    const groupDoc = await adminDb.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const groupData = groupDoc.data();
    if (groupData?.status === 'active') {
      return NextResponse.json({ error: 'Group is already active' }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Re-enable all member accounts FIRST — only update group status if all succeed
    const membersSnapshot = await adminDb
      .collection('groups')
      .doc(groupId)
      .collection('members')
      .get();

    const memberUids = membersSnapshot.docs
      .map((doc) => doc.data().uid as string | undefined)
      .filter((uid): uid is string => Boolean(uid));

    const results = await Promise.allSettled(
      memberUids.map((uid) => adminAuth.updateUser(uid, { disabled: false })),
    );

    const errors: string[] = [];
    let enabledCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        enabledCount++;
      } else {
        errors.push(result.reason?.message ?? 'Unknown error');
      }
    }

    if (errors.length > 0 && enabledCount === 0) {
      return NextResponse.json(
        { error: 'Failed to enable any member accounts', errors },
        { status: 500 },
      );
    }

    await adminDb.collection('groups').doc(groupId).update({
      status: 'active',
      suspendedAt: null,
      activatedAt: now,
      updatedAt: now,
    });

    // Write audit log
    await adminDb.collection('auditLogs').add({
      action: 'tenant.activated',
      groupId,
      enabledCount,
      timestamp: now,
      actorType: 'admin',
    });

    return NextResponse.json({
      success: true,
      data: { groupId, status: 'active', enabledCount, errors },
    });
  } catch (error) {
    console.error('[API] Tenant activate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
