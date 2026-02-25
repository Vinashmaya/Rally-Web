import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Lightweight JWT payload decoder — no firebase-admin dependency.
// Decodes the session cookie to check expiry and extract claims.
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

  // Public routes that don't require auth
  const publicRoutes = ['/login', '/api/health', '/api/auth'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth session cookie
  const session = request.cookies.get('__session')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode and validate the session cookie (lightweight — no server call)
  const payload = decodeSessionPayload(session);
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    // Cookie is malformed or expired — clear it and redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('__session', '', { maxAge: 0, path: '/' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
