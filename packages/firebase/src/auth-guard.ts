// Server-only auth verification for API route handlers
// Uses the lazy-init Firebase Admin SDK from ./admin.ts
// Never imported in client components — guarded by 'server-only'

import 'server-only';

import { NextResponse } from 'next/server';
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
// Cookie extraction — dynamic import to avoid TS resolution issues
// in shared packages that don't directly depend on 'next'
// ---------------------------------------------------------------------------

async function getSessionCookie(): Promise<string | undefined> {
  try {
    // Dynamic import — resolved at runtime by the Next.js app, not at
    // package type-check time. This avoids "Cannot find module 'next/headers'"
    // errors when building from the shared @rally/firebase package.
    const { cookies } = await import(/* webpackIgnore: true */ 'next/headers');
    const cookieStore = await cookies();
    return cookieStore.get('__session')?.value;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Core: verify __session cookie → decoded token + claims
// ---------------------------------------------------------------------------

export async function verifySession(): Promise<VerifiedSession | null> {
  try {
    const sessionCookie = await getSessionCookie();

    if (!sessionCookie) return null;

    const token = await getAdminAuth().verifyIdToken(sessionCookie, true);

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
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Guards — use at the top of API route handlers
// ---------------------------------------------------------------------------

/** Require any authenticated user. Returns 401 if no valid session. */
export async function requireAuth(): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

/** Require specific role(s). Super admins pass all role checks. */
export async function requireRole(
  ...allowedRoles: UserRole[]
): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession();
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
export async function requireSuperAdmin(): Promise<VerifiedSession | NextResponse> {
  const session = await verifySession();
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
