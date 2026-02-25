import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Lightweight JWT payload decoder — no firebase-admin dependency.
// Full cryptographic verification happens in API routes via auth-guard.ts.
// ---------------------------------------------------------------------------
function decodeSessionPayload(
  cookie: string,
): { sub: string; exp: number; role?: string; groupId?: string } | null {
  try {
    const parts = cookie.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload.sub || !payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicRoutes = ['/login', '/api/health', '/api/auth'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Auth check — session cookie set by /api/auth/session after Firebase sign-in
  const session = request.cookies.get('__session')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode and validate the session cookie
  const payload = decodeSessionPayload(session);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('__session', '', { maxAge: 0, path: '/' });
    return response;
  }

  // Super admin gate — only UIDs in SUPER_ADMIN_UIDS can access the admin app
  const superAdminUids = (process.env.SUPER_ADMIN_UIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!superAdminUids.includes(payload.sub)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'not_super_admin');
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('__session', '', { maxAge: 0, path: '/' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
