import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminAuth,
  getAdminDb,
  verifySession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// POST — End an active impersonation session.
//
// The caller is the impersonator's *current* session (still authenticated as
// the impersonated user via custom token). We:
//   1. Verify the session has the `actAs` / `actor` claims
//   2. Revoke refresh tokens on the impersonated UID so the custom-token
//      session can't be reused
//   3. Write an audit log entry
//
// The client then signs out and re-authenticates as the original (super
// admin) user. The original user's `__session` cookie may still be valid —
// the client re-mints a fresh ID token and re-POSTs `/api/auth/session`.
export async function POST(request: NextRequest) {
  try {
    const session = await verifySession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pull impersonation breadcrumbs out of the decoded token.
    const claims = session.token as typeof session.token & {
      actAs?: string;
      actor?: string;
      impersonationStart?: number;
    };

    const targetUid = claims.actAs;
    const actorUid = claims.actor;

    if (!targetUid || !actorUid || targetUid === actorUid) {
      return NextResponse.json(
        { error: 'Not an impersonation session' },
        { status: 400 },
      );
    }

    // Revoke refresh tokens on the impersonated user so the existing ID
    // token can't be refreshed — the client must sign out and re-auth.
    await getAdminAuth()
      .revokeRefreshTokens(targetUid)
      .catch((err) => {
        console.error('[end-impersonation] revokeRefreshTokens failed:', err);
      });

    await getAdminDb()
      .collection('auditLogs')
      .add({
        actor: actorUid,
        action: 'impersonate.end',
        target: targetUid,
        timestamp: new Date().toISOString(),
        actorType: 'super_admin',
        durationMs:
          typeof claims.impersonationStart === 'number'
            ? Date.now() - claims.impersonationStart
            : null,
      })
      .catch((err) => {
        console.error('[end-impersonation] audit log write failed:', err);
      });

    // Best-effort: clear the __session cookie so the client lands clean.
    const response = NextResponse.json({
      success: true,
      data: { actor: actorUid, target: targetUid },
    });
    response.cookies.set('__session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error('[API] End impersonation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
