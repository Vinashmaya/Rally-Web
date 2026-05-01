// POST /api/billing/portal
// Manage portal: creates a Stripe Customer Portal session for the calling
// principal and returns the redirect URL. The CTA opens this URL in a new tab
// for self-service payment method + invoice management.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getAdminDb,
  requireRole,
  isVerifiedSession,
} from '@rally/firebase/admin';
import { createBillingPortalSession } from '@rally/infra';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    returnUrl: z.string().url().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner');
  if (!isVerifiedSession(auth)) return auth;

  const groupId = auth.groupId;
  if (!groupId) {
    return NextResponse.json(
      { error: 'No tenant context — missing groupId on session' },
      { status: 400 },
    );
  }

  let parsed;
  try {
    const raw = await request.json().catch(() => ({}));
    parsed = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const billingSnap = await db
      .collection('groups')
      .doc(groupId)
      .collection('config')
      .doc('billing')
      .get();

    const stripeCustomerId = billingSnap.exists
      ? ((billingSnap.data()?.stripeCustomerId as string | undefined) ?? null)
      : null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer is linked to this tenant yet' },
        { status: 404 },
      );
    }

    // Default return URL = the manage billing page on the request origin.
    const origin = request.nextUrl.origin;
    const returnUrl = parsed.returnUrl ?? `${origin}/billing`;

    const { url } = await createBillingPortalSession({
      customerId: stripeCustomerId,
      returnUrl,
    });

    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    console.error('[API] Manage billing portal error:', error);
    return NextResponse.json(
      { error: 'Unable to open billing portal' },
      { status: 500 },
    );
  }
}
