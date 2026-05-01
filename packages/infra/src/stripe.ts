// @rally/infra/stripe — Stripe SDK wrapper for Rally tenant billing.
//
// All server-only. Never import from a client component.
//
// Test/Live mode is controlled by the secret key:
//   STRIPE_SECRET_KEY=sk_test_...   → test mode
//   STRIPE_SECRET_KEY=sk_live_...   → live mode
// Swap this single env var to flip modes — no code changes required.
//
// One Rally tenant (groups/{groupId}) maps 1:1 to one Stripe Customer.
// We persist the customer id at:
//   groups/{groupId}/config/billing.stripeCustomerId
//
// Subscriptions, invoices, and payment methods live in Stripe — Rally
// reads them on demand. Webhook ingestion is intentionally out of scope
// for this milestone (TODO).

import 'server-only';

import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Singleton — lazy init so missing env vars don't break `next build`
// ---------------------------------------------------------------------------

let _client: Stripe | undefined;

export function getStripe(): Stripe {
  if (_client) return _client;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to .env.local (sk_test_... for test mode).',
    );
  }

  _client = new Stripe(secretKey, {
    // Pin the API version Rally is built against. Bump deliberately.
    // Tracks the version expected by the installed Stripe Node SDK types.
    apiVersion: '2025-02-24.acacia',
    typescript: true,
    appInfo: {
      name: 'Rally Web',
      version: '0.1.0',
      url: 'https://rally.vin',
    },
  });

  return _client;
}

/**
 * Whether the configured key is a test-mode key.
 * Used to render a "Test Mode" badge in the admin/manage billing UIs.
 */
export function isStripeTestMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  return key.startsWith('sk_test_');
}

// ---------------------------------------------------------------------------
// Customer helpers
// ---------------------------------------------------------------------------

export interface CreateStripeCustomerInput {
  groupId: string;
  groupName: string;
  slug: string;
  /** Optional billing email — defaults to undefined (set later via portal) */
  email?: string;
}

/**
 * Create a Stripe Customer for a Rally tenant.
 * Metadata embeds the Rally identifiers so that Stripe dashboards / webhooks
 * can correlate back to a specific group.
 */
export async function createStripeCustomer(
  input: CreateStripeCustomerInput,
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    name: input.groupName,
    ...(input.email ? { email: input.email } : {}),
    metadata: {
      rallyGroupId: input.groupId,
      rallySlug: input.slug,
      rallyGroupName: input.groupName,
    },
  });
}

/**
 * Delete a Stripe Customer (used by the provision rollback path).
 * Best-effort — never throws so it can be chained into rollback flows.
 */
export async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    const stripe = getStripe();
    await stripe.customers.del(customerId);
  } catch (err) {
    // Best-effort cleanup. The caller is rolling back; do not mask the
    // original error.
    console.error(
      `[stripe] deleteStripeCustomer(${customerId}) failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Read helpers — used by admin + manage billing pages
// ---------------------------------------------------------------------------

export interface SubscriptionSummary {
  id: string;
  status: Stripe.Subscription.Status;
  /** Cents per recurring interval. 0 for trialing/free. */
  amount: number;
  currency: string;
  interval: Stripe.Price.Recurring.Interval | null;
  /** Display name of the price/product (best-effort) */
  plan: string;
  /** ISO timestamp of the current period end (next invoice) */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Get the most recent subscription for a customer (regardless of status).
 * Returns null when the customer has none.
 */
export async function getLatestSubscription(
  customerId: string,
): Promise<SubscriptionSummary | null> {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
    expand: ['data.items.data.price.product'],
  });

  const sub = subs.data[0];
  if (!sub) return null;

  const item = sub.items.data[0];
  const price = item?.price;
  const product = price?.product;

  return {
    id: sub.id,
    status: sub.status,
    amount: price?.unit_amount ?? 0,
    currency: price?.currency ?? 'usd',
    interval: price?.recurring?.interval ?? null,
    plan:
      typeof product === 'object' && product && 'name' in product
        ? (product as Stripe.Product).name
        : (price?.nickname ?? 'Custom'),
    periodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: Stripe.Invoice.Status | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  created: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

/** List paid invoices for a customer (most recent first). */
export async function listPaidInvoices(
  customerId: string,
  limit = 12,
): Promise<InvoiceSummary[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: customerId,
    status: 'paid',
    limit,
  });
  return invoices.data.map(toInvoiceSummary);
}

/** List recent invoices for a customer (any status). */
export async function listRecentInvoices(
  customerId: string,
  limit = 10,
): Promise<InvoiceSummary[]> {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data.map(toInvoiceSummary);
}

/**
 * List ALL paid invoices created on/after `sinceUnix` for ANY customer.
 * Used by the admin revenue chart to aggregate MRR across tenants.
 * Uses auto-pagination internally via the list iterator.
 */
export async function listAllPaidInvoicesSince(
  sinceUnix: number,
): Promise<InvoiceSummary[]> {
  const stripe = getStripe();
  const out: InvoiceSummary[] = [];
  for await (const inv of stripe.invoices.list({
    status: 'paid',
    created: { gte: sinceUnix },
    limit: 100,
  })) {
    out.push(toInvoiceSummary(inv));
  }
  return out;
}

function toInvoiceSummary(inv: Stripe.Invoice): InvoiceSummary {
  return {
    id: inv.id,
    number: inv.number ?? null,
    status: inv.status ?? null,
    amountPaid: inv.amount_paid ?? 0,
    amountDue: inv.amount_due ?? 0,
    currency: inv.currency ?? 'usd',
    created: new Date((inv.created ?? 0) * 1000).toISOString(),
    paidAt: inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
      : null,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    invoicePdf: inv.invoice_pdf ?? null,
  };
}

// ---------------------------------------------------------------------------
// Payment method (default) summary
// ---------------------------------------------------------------------------

export interface PaymentMethodSummary {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

export async function getDefaultPaymentMethod(
  customerId: string,
): Promise<PaymentMethodSummary | null> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ['invoice_settings.default_payment_method'],
  });

  if (customer.deleted) return null;

  const pm = (customer as Stripe.Customer).invoice_settings
    ?.default_payment_method;
  if (!pm || typeof pm === 'string' || !pm.card) return null;

  return {
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
  };
}

// ---------------------------------------------------------------------------
// Customer Portal — self-service for principals
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Customer Portal session and return the redirect URL.
 * The principal can manage payment methods + view invoices there.
 */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return { url: session.url };
}
