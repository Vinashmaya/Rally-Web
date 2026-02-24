import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const { pathname } = request.nextUrl;

  // Extract slug from subdomain: {slug}.rally.vin
  const slug = extractSlug(host);

  // If no valid slug, show 404 / unknown tenant page
  if (!slug) {
    // Reserved subdomains are handled by other apps
    return NextResponse.next();
  }

  // Set tenant slug as header for downstream use
  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', slug);

  // Public routes
  const publicRoutes = ['/login', '/api/health', '/api/auth'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return response;
  }

  // Auth check
  const session = request.cookies.get('__session')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
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
  const reserved = ['app', 'manage', 'admin', 'api', 'www'];
  if (reserved.includes(slug)) return null;

  return slug;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
