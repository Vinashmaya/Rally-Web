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
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // Extract slug from subdomain: {slug}.rally.vin
  const slug = extractSlug(host);

  // If no valid slug, show 404 / unknown tenant page
  if (!slug) {
    return NextResponse.next();
  }

  // Pass tenant slug to Server Components via request headers
  // (response headers are NOT readable by Server Components — must use request headers)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-slug', slug);

  // Public routes
  const publicRoutes = ['/login', '/api/health', '/api/auth'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Auth check
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

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function extractSlug(host: string): string | null {
  // Remove port for local dev
  const hostname = host.split(':')[0] ?? '';

  // Must end with .rally.vin
  if (!hostname.endsWith('.rally.vin')) {
    // Local dev fallback
    if (hostname === 'localhost') return 'demo';
    return null;
  }

  // Extract slug: everything before .rally.vin
  const slug = hostname.replace('.rally.vin', '');

  // Don't match reserved subdomains (those are other apps)
  const reserved = ['app', 'manage', 'admin', 'api', 'www', 'messaging', 'eyes', 'me'];
  if (reserved.includes(slug)) return null;

  return slug;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
