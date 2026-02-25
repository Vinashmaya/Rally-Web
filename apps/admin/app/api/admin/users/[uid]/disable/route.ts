import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireSuperAdmin, isVerifiedSession } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — Disable a user account (Firebase Auth + Firestore)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await requireSuperAdmin();
    if (!isVerifiedSession(auth)) return auth;

    const { uid } = await params;

    // Disable in Firebase Auth
    await adminAuth.updateUser(uid, { disabled: true });

    // Update Firestore user document status
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists) {
      await adminDb.collection('users').doc(uid).update({
        status: 'disabled',
        disabledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Write audit log
    await adminDb.collection('auditLogs').add({
      action: 'user.disabled',
      targetUid: uid,
      timestamp: new Date().toISOString(),
      actorType: 'admin',
    });

    return NextResponse.json({
      success: true,
      data: { uid, disabled: true },
    });
  } catch (error) {
    console.error('[API] User disable error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
