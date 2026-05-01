// GET /api/billing
// Manage portal: returns the calling principal's tenant billing snapshot —
// current subscription, default payment method, and recent invoices.
//
// Role gate: owner only (general managers and below cannot see billing).
// Tenant isolation: read scoped to the authed user's groupId.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminDb,
  requireRole,
  isVerifiedSession,
} from '@rally/firebase/admin';
import {
  getLatestSubscription,
  listRecentInvoices,
  getDefaultPaymentMethod,
  isStripeTestMode,
} from '@rally/infra';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'owner');
  if (!isVerifiedSession(auth)) return auth;

  const groupId = auth.groupId;
  if (!groupId) {
    return NextResponse.json(
      { error: 'No tenant context — missing groupId on session' },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();

    // Resolve tenant + billing config
    const groupSnap = await db.collection('groups').doc(groupId).get();
    if (!groupSnap.exists) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 },
      );
    }
    const groupData = groupSnap.data();

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
      return NextResponse.json({
        success: true,
        data: {
          tenantName: (groupData?.name as string | undefined) ?? '',
          stripeCustomerId: null,
          subscription: null,
          paymentMethod: null,
          invoices: [],
          testMode: isStripeTestMode(),
        },
      });
    }

    // Stripe calls are sandboxed in their own try blocks so a Stripe outage
    // doesn't break the whole page — partial data is preferable.
    const [subscription, paymentMethod, invoices] = await Promise.all([
      getLatestSubscription(stripeCustomerId).catch((err) => {
        console.error(
          '[manage/billing] subscription fetch failed:',
          err instanceof Error ? err.message : err,
        );
        return null;
      }),
      getDefaultPaymentMethod(stripeCustomerId).catch((err) => {
        console.error(
          '[manage/billing] payment method fetch failed:',
          err instanceof Error ? err.message : err,
        );
        return null;
      }),
      listRecentInvoices(stripeCustomerId, 10).catch((err) => {
        console.error(
          '[manage/billing] invoices fetch failed:',
          err instanceof Error ? err.message : err,
        );
        return [];
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tenantName: (groupData?.name as string | undefined) ?? '',
        stripeCustomerId,
        subscription,
        paymentMethod,
        invoices,
        testMode: isStripeTestMode(),
      },
    });
  } catch (error) {
    console.error('[API] Manage billing error:', error);
    // Never expose Stripe error verbatim to non-admins
    return NextResponse.json(
      { error: 'Unable to load billing information' },
      { status: 500 },
    );
  }
}
