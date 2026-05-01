// Apple Wallet pass generation for staff business cards
// POST /api/cards/wallet
//
// Creates a `.pkpass` for the authed user (or a uid override if provided)
// using `passkit-generator`. Pass Type ID cert + key + WWDR cert must be
// configured via environment variables OR placed at well-known paths.
//
// Auth: requireAuth (any authenticated dealer user)
// Body: { uid?: string }  — defaults to the authed user
// Returns: 200 application/vnd.apple.pkpass on success
//          501 with discoverable error if cert is missing
//          400/401/404/500 for the usual failures

import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  getAdminDb,
  requireAuth,
  isVerifiedSession,
} from '@rally/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const bodySchema = z
  .object({
    uid: z.string().min(1).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Cert discovery — env first, then well-known disk paths
// ---------------------------------------------------------------------------

interface PassCerts {
  signerCert: Buffer;
  signerKey: Buffer;
  wwdr: Buffer;
  signerKeyPassphrase?: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
}

const CERT_SETUP_HINT =
  'Pass Type ID cert not found. Set APPLE_PASS_SIGNER_CERT(_PATH), ' +
  'APPLE_PASS_SIGNER_KEY(_PATH), APPLE_PASS_WWDR(_PATH), ' +
  'APPLE_PASS_TYPE_IDENTIFIER, and APPLE_TEAM_IDENTIFIER. ' +
  'See SECRETS.rtfd for setup.';

async function readMaybe(p: string | undefined): Promise<Buffer | null> {
  if (!p) return null;
  try {
    return await fs.readFile(p);
  } catch {
    return null;
  }
}

async function loadFromCandidates(
  envInline: string | undefined,
  envPath: string | undefined,
  candidates: string[],
): Promise<Buffer | null> {
  if (envInline && envInline.trim().length > 0) {
    // Inline PEM (with literal \n) — normalize newlines
    return Buffer.from(envInline.replace(/\\n/g, '\n'), 'utf8');
  }
  const direct = await readMaybe(envPath);
  if (direct) return direct;
  for (const candidate of candidates) {
    const buf = await readMaybe(candidate);
    if (buf) return buf;
  }
  return null;
}

async function loadCerts(): Promise<PassCerts | null> {
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_IDENTIFIER;
  const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER;

  // Discover at: app-local /certs/, repo-root /certs/, /etc/rally/certs/
  const appCertsDir = path.join(process.cwd(), 'certs');
  const repoCertsDir = path.join(process.cwd(), '..', '..', 'certs');
  const sysCertsDir = '/etc/rally/certs';

  const cands = (file: string) => [
    path.join(appCertsDir, file),
    path.join(repoCertsDir, file),
    path.join(sysCertsDir, file),
  ];

  const signerCert = await loadFromCandidates(
    process.env.APPLE_PASS_SIGNER_CERT,
    process.env.APPLE_PASS_SIGNER_CERT_PATH,
    [...cands('signerCert.pem'), ...cands('pass.pem')],
  );
  const signerKey = await loadFromCandidates(
    process.env.APPLE_PASS_SIGNER_KEY,
    process.env.APPLE_PASS_SIGNER_KEY_PATH,
    [...cands('signerKey.pem'), ...cands('pass.key')],
  );
  const wwdr = await loadFromCandidates(
    process.env.APPLE_PASS_WWDR,
    process.env.APPLE_PASS_WWDR_PATH,
    [...cands('wwdr.pem'), ...cands('AppleWWDRCAG3.pem')],
  );

  if (!signerCert || !signerKey || !wwdr || !passTypeIdentifier || !teamIdentifier) {
    return null;
  }

  return {
    signerCert,
    signerKey,
    wwdr,
    signerKeyPassphrase: process.env.APPLE_PASS_SIGNER_KEY_PASSPHRASE,
    passTypeIdentifier,
    teamIdentifier,
  };
}

// ---------------------------------------------------------------------------
// Firestore — user lookup
// ---------------------------------------------------------------------------

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: string;
  dealershipId: string;
  groupId?: string;
  dealershipName: string;
}

async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getAdminDb();
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return null;

  const data = userSnap.data() ?? {};
  const dealershipId = (data.dealershipId as string | undefined) ?? '';
  const groupId = (data.groupId as string | undefined) ?? undefined;

  let dealershipName = '';
  if (dealershipId) {
    const dealershipSnap = await db
      .collection('dealerships')
      .doc(dealershipId)
      .get();
    if (dealershipSnap.exists) {
      const d = dealershipSnap.data() ?? {};
      dealershipName = (d.name as string | undefined) ?? '';
    }
  }

  return {
    uid,
    displayName: (data.displayName as string | undefined) ?? 'Rally Staff',
    email: (data.email as string | undefined) ?? '',
    phone: (data.phone as string | undefined) ?? '',
    role: (data.role as string | undefined) ?? 'salesperson',
    dealershipId,
    groupId,
    dealershipName,
  };
}

// ---------------------------------------------------------------------------
// Branding — optional tenant override
// ---------------------------------------------------------------------------

interface Branding {
  primaryColor: string; // rgb()
  textColor: string;
  labelColor: string;
}

async function loadBranding(groupId: string | undefined): Promise<Branding> {
  const fallback: Branding = {
    // Rally gold (#D4A017) and near-black
    primaryColor: 'rgb(14, 14, 16)',
    textColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(212, 160, 23)',
  };
  if (!groupId) return fallback;

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('groups')
      .doc(groupId)
      .collection('config')
      .doc('branding')
      .get();
    if (!snap.exists) return fallback;
    const data = snap.data() ?? {};
    return {
      primaryColor:
        (data.passBackgroundColor as string | undefined) ?? fallback.primaryColor,
      textColor: (data.passForegroundColor as string | undefined) ?? fallback.textColor,
      labelColor: (data.passLabelColor as string | undefined) ?? fallback.labelColor,
    };
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!isVerifiedSession(auth)) return auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const targetUid = parsed.data.uid ?? auth.uid;

    // Authorization: only allow uid override for super admins
    if (targetUid !== auth.uid && !auth.isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load cert FIRST so we don't waste a Firestore read if it isn't there
    const certs = await loadCerts();
    if (!certs) {
      return NextResponse.json(
        { error: CERT_SETUP_HINT },
        { status: 501 },
      );
    }

    // Load user profile
    const profile = await loadUserProfile(targetUid);
    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const branding = await loadBranding(profile.groupId);
    const shareUrl = `https://rally.vin/c/${profile.uid}`;

    // Dynamic import — passkit-generator uses Node-only deps; keep it out of
    // the build graph for any client bundles or edge runtime.
    const { PKPass } = await import('passkit-generator');

    // Build pass model in-memory. Without a model directory we still need
    // a pass.json — passkit-generator supports `PKPass.from()` with a
    // template, but for a fully programmatic pass we use the constructor.
    const pass = new PKPass(
      {},
      {
        wwdr: certs.wwdr,
        signerCert: certs.signerCert,
        signerKey: certs.signerKey,
        signerKeyPassphrase: certs.signerKeyPassphrase,
      },
      {
        formatVersion: 1,
        passTypeIdentifier: certs.passTypeIdentifier,
        teamIdentifier: certs.teamIdentifier,
        organizationName: profile.dealershipName || 'Rally',
        serialNumber: `rally-card-${profile.uid}`,
        description: `${profile.displayName} — Rally Business Card`,
        backgroundColor: branding.primaryColor,
        foregroundColor: branding.textColor,
        labelColor: branding.labelColor,
      },
    );

    pass.type = 'generic';

    // Front fields
    pass.headerFields.push({
      key: 'role',
      label: 'ROLE',
      value: profile.role.replace(/_/g, ' ').toUpperCase(),
    });
    pass.primaryFields.push({
      key: 'name',
      label: 'NAME',
      value: profile.displayName,
    });
    pass.secondaryFields.push({
      key: 'dealership',
      label: 'DEALERSHIP',
      value: profile.dealershipName || '—',
    });
    if (profile.phone) {
      pass.auxiliaryFields.push({
        key: 'phone',
        label: 'PHONE',
        value: profile.phone,
      });
    }
    if (profile.email) {
      pass.auxiliaryFields.push({
        key: 'email',
        label: 'EMAIL',
        value: profile.email,
      });
    }

    // Back fields
    pass.backFields.push(
      { key: 'website', label: 'Website', value: shareUrl },
      { key: 'about', label: 'About', value: 'Rally — the dealership operating system.' },
    );

    // Barcode → same QR URL as the cards page
    pass.setBarcodes({
      message: shareUrl,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
      altText: `rally.vin/c/${profile.uid}`,
    });

    const buffer = pass.getAsBuffer();
    // NextResponse expects BodyInit (Web Fetch types). Node Buffer extends
    // Uint8Array but TS strict mode doesn't narrow that — wrap in a
    // Uint8Array view (zero-copy) to satisfy BodyInit.
    const body = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${profile.displayName.replace(/\s+/g, '_')}_rally.pkpass"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/cards/wallet] error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    // Surface cert-init failures as 501 so the client can show the setup hint
    if (/cert|wwdr|signer/i.test(message)) {
      return NextResponse.json(
        { error: `${CERT_SETUP_HINT} (underlying: ${message})` },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
