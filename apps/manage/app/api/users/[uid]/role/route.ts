import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireRole, isVerifiedSession } from '@rally/firebase/admin';
import { USER_ROLE_VALUES } from '@rally/firebase';

export const dynamic = 'force-dynamic';

// PUT — Update a user's role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await requireRole('owner', 'general_manager');
    if (!isVerifiedSession(auth)) return auth;

    const { uid } = await params;
    const body = await request.json();

    const { role } = body as { role: string };

    if (!role) {
      return NextResponse.json(
        { error: 'Missing required field: role' },
        { status: 400 },
      );
    }

    // Validate role
    const validRoles = USER_ROLE_VALUES;
    if (!validRoles.includes(role as typeof validRoles[number])) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    // Verify user exists in Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Tenant isolation: can only change roles for users in your own group
    if (auth.groupId && userData?.groupId && auth.groupId !== userData.groupId) {
      return NextResponse.json(
        { error: 'Forbidden: cannot modify users from a different tenant' },
        { status: 403 },
      );
    }

    const previousRole = userData?.role as string;

    // Update custom claims in Firebase Auth
    const currentUser = await adminAuth.getUser(uid);
    const existingClaims = currentUser.customClaims ?? {};
    await adminAuth.setCustomUserClaims(uid, {
      ...existingClaims,
      role,
    });

    // Update Firestore user document
    const now = new Date().toISOString();
    await adminDb.collection('users').doc(uid).update({
      role,
      updatedAt: now,
    });

    // Update membership documents if dealershipId exists
    if (userData?.dealershipId) {
      const membershipRef = adminDb
        .collection('employees')
        .doc(uid)
        .collection('memberships')
        .doc(userData.dealershipId as string);

      const membershipDoc = await membershipRef.get();
      if (membershipDoc.exists) {
        await membershipRef.update({ role, updatedAt: now });
      }
    }

    // Write audit log
    await adminDb.collection('auditLogs').add({
      action: 'user.role_changed',
      targetUid: uid,
      actorUid: auth.uid,
      previousRole,
      newRole: role,
      timestamp: now,
      actorType: 'manager',
    });

    return NextResponse.json({
      success: true,
      data: { uid, role, previousRole },
    });
  } catch (error) {
    console.error('[API] User role update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
