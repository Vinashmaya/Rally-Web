import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

// TEMPORARY debug endpoint — returns auth diagnostic info
// DELETE THIS BEFORE PRODUCTION
export async function GET(request: NextRequest) {
  const diagnostics: Record<string, unknown> = {};

  // 1. Check env vars
  diagnostics.projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? '(not set)';
  diagnostics.clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL ?? '(not set)';
  diagnostics.privateKeyLength = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.length ?? 0;
  diagnostics.privateKeyStart = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.substring(0, 30) ?? '(not set)';
  diagnostics.superAdminUids = process.env.SUPER_ADMIN_UIDS ?? '(not set)';
  diagnostics.nodeEnv = process.env.NODE_ENV;

  // 2. Check cookies
  const sessionCookie = request.cookies.get('__session');
  diagnostics.hasSessionCookie = !!sessionCookie;
  diagnostics.sessionCookieLength = sessionCookie?.value?.length ?? 0;

  // 3. Check Authorization header
  const authHeader = request.headers.get('authorization');
  diagnostics.hasAuthHeader = !!authHeader;
  diagnostics.authHeaderPreview = authHeader ? authHeader.substring(0, 30) + '...' : '(none)';

  // 4. Try Admin SDK init
  try {
    const { getAdminAuth } = await import('@rally/firebase/admin');
    const auth = getAdminAuth();
    diagnostics.adminSdkInit = 'OK';

    // 5. Try verifying bearer token if present
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const decoded = await auth.verifyIdToken(token, true);
        diagnostics.bearerVerify = `OK: uid=${decoded.uid}, email=${decoded.email}`;
      } catch (err) {
        diagnostics.bearerVerify = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // 6. Try verifying session cookie if present
    if (sessionCookie?.value) {
      try {
        const decoded = await auth.verifySessionCookie(sessionCookie.value, true);
        diagnostics.cookieVerify = `OK: uid=${decoded.uid}, email=${decoded.email}`;
      } catch (err) {
        diagnostics.cookieVerify = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  } catch (err) {
    diagnostics.adminSdkInit = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(diagnostics);
}
