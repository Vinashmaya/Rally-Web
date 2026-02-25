import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireRole, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Deactivate a user account
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await requireRole('owner', 'general_manager');
    if (!isVerifiedSession(auth)) return auth;

    const { uid } = await params;

    // Verify user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Tenant isolation: can only deactivate users in your own group
    if (auth.groupId && userData?.groupId && auth.groupId !== userData.groupId) {
      return NextResponse.json(
        { error: 'Forbidden: cannot deactivate users from a different tenant' },
        { status: 403 },
      );
    }

    if (userData?.status === 'deactivated') {
      return NextResponse.json({ error: 'User is already deactivated' }, { status: 409 });
    }

    // Disable in Firebase Auth
    await adminAuth.updateUser(uid, { disabled: true });

    // Update Firestore user document
    const now = new Date().toISOString();
    await adminDb.collection('users').doc(uid).update({
      status: 'deactivated',
      deactivatedAt: now,
      updatedAt: now,
    });

    // Write audit log
    await adminDb.collection('auditLogs').add({
      action: 'user.deactivated',
      targetUid: uid,
      actorUid: auth.uid,
      email: userData?.email ?? 'unknown',
      timestamp: now,
      actorType: 'manager',
    });

    return NextResponse.json({
      success: true,
      data: { uid, status: 'deactivated' },
    });
  } catch (error) {
    console.error('[API] User deactivate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
