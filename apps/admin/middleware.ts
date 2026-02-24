import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  const publicRoutes = ['/login', '/api/health'];
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Auth check — session cookie from Firebase
  const session = request.cookies.get('__session')?.value;
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // TODO: Super admin UID check will be enforced server-side.
  // The admin app is restricted to UIDs in the SUPER_ADMIN_UIDS env var.
  // This will be validated via Firebase Admin SDK in route handlers
  // and server components, not just in middleware.

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
