import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb, requireRole, isVerifiedSession } from '@rally/firebase/admin';
import { USER_ROLE_VALUES } from '@rally/firebase';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

// Generate a cryptographically random temporary password
function generateTempPassword(): string {
  return crypto.randomBytes(16).toString('base64url');
}

// POST — Invite a new user (create Firebase Auth account + Firestore documents)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole('owner', 'general_manager');
    if (!isVerifiedSession(auth)) return auth;

    const body = await request.json();

    const { email, displayName, role, phone, dealershipId, groupId } = body as {
      email: string;
      displayName: string;
      role: string;
      phone?: string;
      dealershipId: string;
      groupId: string;
    };

    if (!email || !displayName || !role || !dealershipId || !groupId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, displayName, role, dealershipId, groupId' },
        { status: 400 },
      );
    }

    // Tenant isolation: caller can only invite into their own group
    if (auth.groupId && auth.groupId !== groupId) {
      return NextResponse.json(
        { error: 'Forbidden: cannot invite users into a different tenant group' },
        { status: 403 },
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

    const tempPassword = generateTempPassword();
    const now = new Date().toISOString();

    // Step 1: Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email,
      displayName,
      password: tempPassword,
      ...(phone ? { phoneNumber: phone } : {}),
    });

    const { uid } = userRecord;

    // Steps 2-5 are wrapped — if any fail, roll back the Auth user
    // to prevent orphaned accounts with known temp passwords
    try {
      // Step 2: Set custom claims for role-based access
      await adminAuth.setCustomUserClaims(uid, {
        groupId,
        dealershipId,
        role,
      });

      // Step 3: Write user document to Firestore
      await adminDb.collection('users').doc(uid).set({
        uid,
        email,
        displayName,
        role,
        phone: phone ?? null,
        dealershipId,
        groupId,
        status: 'active',
        mustResetPassword: true,
        createdAt: now,
        updatedAt: now,
      });

      // Step 4: Write membership document
      await adminDb
        .collection('employees')
        .doc(uid)
        .collection('memberships')
        .doc(dealershipId)
        .set({
          dealershipId,
          groupId,
          role,
          status: 'active',
          joinedAt: now,
        });

      // Step 5: Write audit log
      await adminDb.collection('auditLogs').add({
        action: 'user.invited',
        targetUid: uid,
        actorUid: auth.uid,
        email,
        role,
        dealershipId,
        groupId,
        timestamp: now,
        actorType: 'manager',
      });
    } catch (firestoreError) {
      // Rollback: delete the Auth user so no orphan exists
      await adminAuth.deleteUser(uid).catch(() => {});
      throw firestoreError;
    }

    // NOTE: tempPassword is intentionally NOT returned in the response.
    // Returning plaintext passwords in API responses exposes them in
    // DevTools, server logs, and monitoring. The manager sees a success
    // confirmation; the invited user receives a password-reset email.
    return NextResponse.json({
      success: true,
      data: { uid, email, mustResetPassword: true },
    });
  } catch (error) {
    console.error('[API] User invite error:', error);

    // Handle Firebase Auth duplicate email
    if (error instanceof Error && error.message.includes('email-already-exists')) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
