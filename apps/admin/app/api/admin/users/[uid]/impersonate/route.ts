import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminAuth,
  getAdminDb,
  requireSuperAdmin,
  isVerifiedSession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';

// Custom token TTL — Firebase ID tokens are 1h max
const IMPERSONATION_EXPIRES_IN_SECONDS = 60 * 60;

interface ImpersonationResponse {
  customToken: string;
  expiresIn: number;
  target: {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: string | null;
    groupId: string | null;
    dealershipId: string | null;
  };
  /** Where the calling client should redirect (handoff via ?ic= param). */
  redirectHost: string;
}

// Map a target user's role to the portal subdomain that should receive them.
// Falls back to staff app for any role we don't have explicit routing for.
function resolveRedirectHost(role: string | null): string {
  switch (role) {
    case 'owner':
    case 'general_manager':
    case 'sales_manager':
    case 'service_manager':
    case 'finance_manager':
    case 'desk_manager':
      return process.env.NEXT_PUBLIC_MANAGE_HOST ?? 'https://manage.rally.vin';
    case 'salesperson':
    case 'bdc_agent':
    case 'service_advisor':
    case 'technician':
    case 'porter':
    case 'detailer':
    case 'parts':
    default:
      return process.env.NEXT_PUBLIC_STAFF_HOST ?? 'https://app.rally.vin';
  }
}

// POST — Mint a short-lived custom token for impersonation.
// Super-admin only. Records an audit log entry.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!isVerifiedSession(auth)) return auth;

    const { uid: targetUid } = await params;

    if (!targetUid) {
      return NextResponse.json({ error: 'Missing target uid' }, { status: 400 });
    }

    if (targetUid === auth.uid) {
      return NextResponse.json(
        { error: 'Cannot impersonate yourself' },
        { status: 400 },
      );
    }

    // Refuse to impersonate other super admins — defense in depth.
    const superAdminUids = (process.env.SUPER_ADMIN_UIDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (superAdminUids.includes(targetUid)) {
      return NextResponse.json(
        { error: 'Cannot impersonate another super admin' },
        { status: 403 },
      );
    }

    // Look up the target user in Firebase Auth + Firestore so we can echo
    // their identity back to the client and seed claims correctly.
    const targetUser = await getAdminAuth()
      .getUser(targetUid)
      .catch(() => null);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const userDoc = await getAdminDb().collection('users').doc(targetUid).get();
    const userData = userDoc.exists ? userDoc.data() ?? {} : {};

    const role = (userData.role as string | undefined) ?? null;
    const groupId = (userData.groupId as string | undefined) ?? null;
    const dealershipId =
      (userData.dealershipId as string | undefined) ??
      (userData.storeId as string | undefined) ??
      null;

    const impersonationStartMs = Date.now();

    // Custom claims attached to the minted token.
    // - `role`, `groupId`, `dealershipId` make the impersonated session pass
    //   role-based guards in the destination portal.
    // - `actAs` / `actor` / `impersonationStart` are the breadcrumbs the
    //   client uses to render the impersonation banner and the end endpoint
    //   uses to validate that this is in fact an impersonation session.
    const claims = {
      role,
      groupId,
      dealershipId,
      actAs: targetUid,
      actor: auth.uid,
      impersonationStart: impersonationStartMs,
    } as const;

    const customToken = await getAdminAuth().createCustomToken(targetUid, claims);

    // Audit log — best-effort, do not block on failure.
    await getAdminDb()
      .collection('auditLogs')
      .add({
        actor: auth.uid,
        action: 'impersonate.start',
        target: targetUid,
        timestamp: new Date(impersonationStartMs).toISOString(),
        actorType: 'super_admin',
        targetRole: role,
        groupId,
        dealershipId,
      })
      .catch((err) => {
        console.error('[impersonate] audit log write failed:', err);
      });

    const payload: ImpersonationResponse = {
      customToken,
      expiresIn: IMPERSONATION_EXPIRES_IN_SECONDS,
      target: {
        uid: targetUid,
        email: targetUser.email ?? null,
        displayName: targetUser.displayName ?? null,
        role,
        groupId,
        dealershipId,
      },
      redirectHost: resolveRedirectHost(role),
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    console.error('[API] Impersonate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}
