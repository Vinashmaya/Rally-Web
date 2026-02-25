import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Suspend a tenant group (disable all member accounts)
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
    if (groupData?.status === 'suspended') {
      return NextResponse.json({ error: 'Group is already suspended' }, { status: 409 });
    }

    // Update group status to suspended
    const now = new Date().toISOString();
    await adminDb.collection('groups').doc(groupId).update({
      status: 'suspended',
      suspendedAt: now,
      updatedAt: now,
    });

    // Disable all member accounts
    const membersSnapshot = await adminDb
      .collection('groups')
      .doc(groupId)
      .collection('members')
      .get();

    let disabledCount = 0;
    const errors: string[] = [];

    for (const memberDoc of membersSnapshot.docs) {
      const memberData = memberDoc.data();
      if (memberData.uid) {
        try {
          await adminAuth.updateUser(memberData.uid, { disabled: true });
          disabledCount++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Failed to disable ${memberData.uid}: ${msg}`);
        }
      }
    }

    // Write audit log
    await adminDb.collection('auditLog').add({
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
