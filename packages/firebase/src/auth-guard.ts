// Server-only auth verification for API route handlers
// Uses the lazy-init Firebase Admin SDK from ./admin.ts
// Never imported in client components — guarded by 'server-only'
//
// Dual-auth strategy:
//   1. Try __session cookie (set via /api/auth/session POST)
//   2. Fall back to Authorization: Bearer <idToken> header
// The bearer fallback ensures API routes work even when Cloudflare's
// proxy strips Set-Cookie headers from origin responses.
//
// All guard functions accept a NextRequest parameter so that cookies and
// headers are read directly from the request object — no dynamic imports
// of 'next/headers' needed (which can fail in shared workspace packages).

import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAdminAuth } from './admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UserRole } from './types/user';
import { USER_ROLE_VALUES } from './types/user';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedSession {
  token: DecodedIdToken;
  uid: string;
  role: UserRole | null;
  groupId: string | null;
  dealershipId: string | null;
  isSuperAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Core: verify session via cookie OR bearer token → decoded token + claims
//
// Reads __session cookie and Authorization header directly from the request.
// Priority: session cookie (verifySessionCookie) > bearer (verifyIdToken)
// ---------------------------------------------------------------------------

export async function verifySession(request: NextRequest): Promise<VerifiedSession | null> {
  // --- Attempt 1: session cookie ---
  const sessionCookie = request.cookies.get('__session')?.value;
  if (sessionCookie) {
    try {
      const token = await getAdminAuth().verifySessionCookie(sessionCookie, true);
      return buildSession(token);
    } catch (err) {
      console.error('[auth-guard] session cookie verification failed:', err instanceof Error ? err.message : err);
    }
  }

  // --- Attempt 2: Authorization bearer token ---
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = await getAdminAuth().verifyIdToken(authHeader.slice(7), true);
      return buildSession(token);
    } catch (err) {
      console.error('[auth-guard] bearer token verification failed:', err instanceof Error ? err.message : err);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shared: build VerifiedSession from a decoded token
// ---------------------------------------------------------------------------

function buildSession(token: DecodedIdToken): VerifiedSession {
  const claims = token as DecodedIdToken & {
    groupId?: string;
    dealershipId?: string;
    role?: string;
  };

  const role = claims.role && (USER_ROLE_VALUES as readonly string[]).includes(claims.role)
    ? (claims.role as UserRole)
    : null;

  const superAdminUids = (process.env.SUPER_ADMIN_UIDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    token,
    uid: token.uid,
    role,
    groupId: claims.groupId ?? null,
    dealershipId: claims.dealershipId ?? null,
    isSuperAdmin: superAdminUids.includes(token.uid),
  };
}

// ---------------------------------------------------------------------------
// Guards — use at the top of API route handlers
// ---------------------------------------------------------------------------

/** Require any authenticated user. Returns 401 if no valid session. */
export async function requireAuth(request: NextRequest): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

/** Require specific role(s). Super admins pass all role checks. */
export async function requireRole(
  request: NextRequest,
  ...allowedRoles: UserRole[]
): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.isSuperAdmin) return session;
  if (!session.role || !allowedRoles.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return session;
}

/** Require super admin (UID-based). Returns 401/403 on failure. */
export async function requireSuperAdmin(request: NextRequest): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden: super admin required' }, { status: 403 });
  }
  return session;
}

// ---------------------------------------------------------------------------
// Type guard — use after calling a guard function
// ---------------------------------------------------------------------------

export function isVerifiedSession(
  result: VerifiedSession | NextResponse,
): result is VerifiedSession {
  return !(result instanceof NextResponse);
}
