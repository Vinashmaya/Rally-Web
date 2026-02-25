import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Activate (un-suspend) a tenant group
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
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

    // Update group status to active
    const now = new Date().toISOString();
    await adminDb.collection('groups').doc(groupId).update({
      status: 'active',
      suspendedAt: null,
      activatedAt: now,
      updatedAt: now,
    });

    // Re-enable all member accounts
    const membersSnapshot = await adminDb
      .collection('groups')
      .doc(groupId)
      .collection('members')
      .get();

    let enabledCount = 0;
    const errors: string[] = [];

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      if (memberData.uid) {
        try {
          await adminAuth.updateUser(memberData.uid, { disabled: false });
          enabledCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Failed to enable ${memberData.uid}: ${msg}`);
        }
      }
    }

    // Write audit log
    await adminDb.collection('auditLog').add({
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
