// GET /api/admin/billing/revenue
// Super-admin-only: aggregates paid invoices over the last 12 months across
// every Stripe customer linked to a Rally tenant.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  requireSuperAdmin,
  isVerifiedSession,
} from '@rally/firebase/admin';
import { listAllPaidInvoicesSince, isStripeTestMode } from '@rally/infra';

export const dynamic = 'force-dynamic';

interface MonthlyRevenuePoint {
  /** YYYY-MM */
  month: string;
  /** Display label, e.g. "Apr" */
  label: string;
  /** Cents */
  revenue: number;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request);
  if (!isVerifiedSession(auth)) return auth;

  try {
    const now = new Date();
    // First day of the month that's 11 months ago → 12 buckets including
    // current month.
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );
    const sinceUnix = Math.floor(start.getTime() / 1000);

    // Build 12 month buckets in chronological order
    const buckets = new Map<string, MonthlyRevenuePoint>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
      );
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      });
      buckets.set(month, { month, label, revenue: 0 });
    }

    let invoices;
    try {
      invoices = await listAllPaidInvoicesSince(sinceUnix);
    } catch (err) {
      console.error(
        '[admin/billing/revenue] Stripe list failed:',
        err instanceof Error ? err.message : err,
      );
      return NextResponse.json({
        success: true,
        data: {
          months: Array.from(buckets.values()),
          totalCents: 0,
          testMode: isStripeTestMode(),
          stripeAvailable: false,
        },
      });
    }

    let total = 0;
    for (const inv of invoices) {
      const paidIso = inv.paidAt ?? inv.created;
      const paid = new Date(paidIso);
      const month = `${paid.getUTCFullYear()}-${String(paid.getUTCMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(month);
      if (bucket) {
        bucket.revenue += inv.amountPaid;
        total += inv.amountPaid;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        months: Array.from(buckets.values()),
        totalCents: total,
        testMode: isStripeTestMode(),
        stripeAvailable: true,
      },
    });
  } catch (error) {
    console.error('[API] Admin billing revenue error:', error);
    return NextResponse.json(
      { error: 'Failed to load revenue data' },
      { status: 500 },
    );
  }
}
