import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Suspend a tenant group (disable all member accounts)
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
    if (groupData?.status === 'suspended') {
      return NextResponse.json({ error: 'Group is already suspended' }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Disable all member accounts FIRST — only update group status if all succeed
    const membersSnapshot = await adminDb
      .collectionGroup('memberships')
      .where('groupId', '==', groupId)
      .where('status', '==', 'active')
      .get();

    const memberUids = membersSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return (data.employeeUid ?? data.uid ?? doc.ref.parent.parent?.id) as string | undefined;
      })
      .filter((uid): uid is string => Boolean(uid));

    const results = await Promise.allSettled(
      memberUids.map((uid) => adminAuth.updateUser(uid, { disabled: true })),
    );

    const errors: string[] = [];
    let disabledCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        disabledCount++;
      } else {
        errors.push(result.reason?.message ?? 'Unknown error');
      }
    }

    // Only update Firestore status if all Auth operations succeeded
    if (errors.length > 0 && disabledCount === 0) {
      return NextResponse.json(
        { error: 'Failed to disable any member accounts', errors },
        { status: 500 },
      );
    }

    await adminDb.collection('groups').doc(groupId).update({
      status: 'suspended',
      suspendedAt: now,
      updatedAt: now,
    });

    // Write audit log
    await adminDb.collection('auditLogs').add({
      action: 'tenant.suspended',
      groupId,
      disabledCount,
      timestamp: now,
      actorType: 'admin',
    });

    return NextResponse.json({
      success: true,
      data: { groupId, status: 'suspended', disabledCount, errors },
    });
  } catch (error) {
    console.error('[API] Tenant suspend error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
