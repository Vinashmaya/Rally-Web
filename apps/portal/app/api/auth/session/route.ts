import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// 14-day session — matches Firebase session cookie max (14 days)
const SESSION_EXPIRY_SECONDS = 60 * 60 * 24 * 14;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_SECONDS * 1000;

// POST — Create a Firebase session cookie after client sign-in.
// Portal-specific: validates that the user has a membership in the group
// identified by the subdomain slug. This prevents cross-tenant portal access.
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify the ID token to get the user's UID
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    const { uid } = decodedToken;

    // Tenant guard: validate user belongs to the subdomain's group
    const tenantSlug = request.headers.get('x-tenant-slug');
    if (tenantSlug && tenantSlug !== 'demo') {
      const groupSnapshot = await getAdminDb()
        .collection('groups')
        .where('slug', '==', tenantSlug)
        .limit(1)
        .get();

      if (!groupSnapshot.empty) {
        const groupId = groupSnapshot.docs[0]!.id;

        // Check if user has an active membership in this group
        const membershipSnapshot = await getAdminDb()
          .collection('employees')
          .doc(uid)
          .collection('memberships')
          .where('groupId', '==', groupId)
          .where('status', '==', 'active')
          .limit(1)
          .get();

        if (membershipSnapshot.empty) {
          return NextResponse.json(
            { error: 'You do not have access to this dealership portal' },
            { status: 403 },
          );
        }
      }
      // If group not found by slug, allow login — the user will just see their own stores
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}

// DELETE — Clear session cookie on sign-out
export async function DELETE() {
  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set('__session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
