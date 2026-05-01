// GET /api/admin/billing/subscriptions
// Super-admin-only: lists every Rally tenant + the latest Stripe subscription
// for tenants that have a Stripe customer linked at
// groups/{groupId}/config/billing.stripeCustomerId.
//
// Tenants without a customer return `subscription: null` so the UI can show
// a "Not yet billed" state.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminDb,
  requireSuperAdmin,
  isVerifiedSession,
} from '@rally/firebase/admin';
import { getLatestSubscription, isStripeTestMode } from '@rally/infra';

export const dynamic = 'force-dynamic';

interface TenantBillingRow {
  groupId: string;
  slug: string;
  name: string;
  stripeCustomerId: string | null;
  subscription: {
    id: string;
    status: string;
    plan: string;
    amount: number;
    currency: string;
    interval: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  error?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  try {
    const db = getAdminDb();
    const groupsSnapshot = await db.collection('groups').orderBy('name').get();

    const tenants: TenantBillingRow[] = await Promise.all(
      groupsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const groupId = doc.id;
        const name = (data.name as string | undefined) ?? '';
        const slug = (data.slug as string | undefined) ?? '';

        // Read billing config (may not exist for older tenants)
        let stripeCustomerId: string | null = null;
        try {
          const billingDoc = await db
            .collection('groups')
            .doc(groupId)
            .collection('config')
            .doc('billing')
            .get();
          if (billingDoc.exists) {
            const billing = billingDoc.data();
            stripeCustomerId =
              (billing?.stripeCustomerId as string | undefined) ?? null;
          }
        } catch {
          // Non-fatal — render as "Not yet billed"
        }

        if (!stripeCustomerId) {
          return {
            groupId,
            slug,
            name,
            stripeCustomerId: null,
            subscription: null,
          };
        }

        try {
          const sub = await getLatestSubscription(stripeCustomerId);
          return {
            groupId,
            slug,
            name,
            stripeCustomerId,
            subscription: sub
              ? {
                  id: sub.id,
                  status: sub.status,
                  plan: sub.plan,
                  amount: sub.amount,
                  currency: sub.currency,
                  interval: sub.interval,
                  periodEnd: sub.periodEnd,
                  cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
                }
              : null,
          };
        } catch (err) {
          console.error(
            `[admin/billing] Stripe fetch failed for ${groupId}:`,
            err instanceof Error ? err.message : err,
          );
          return {
            groupId,
            slug,
            name,
            stripeCustomerId,
            subscription: null,
            error: 'stripe_unavailable',
          };
        }
      }),
    );

    return NextResponse.json({
      success: true,
      data: { tenants, testMode: isStripeTestMode() },
    });
  } catch (error) {
    console.error('[API] Admin billing subscriptions error:', error);
    return NextResponse.json(
      { error: 'Failed to load billing subscriptions' },
      { status: 500 },
    );
  }
}
