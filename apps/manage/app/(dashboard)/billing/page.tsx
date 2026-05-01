'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  Skeleton,
  EmptyState,
  DataTable,
  useToast,
} from '@rally/ui';
import type { BadgeProps, ColumnDef } from '@rally/ui';
import { authFetch } from '@rally/firebase';
import { useAuthStore } from '@rally/services';
import {
  CreditCard,
  Receipt,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Lock,
  FileText,
  ArrowUpRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

type StripeStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

interface SubscriptionApi {
  id: string;
  status: StripeStatus;
  plan: string;
  amount: number;
  currency: string;
  interval: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface PaymentMethodApi {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

interface InvoiceApi {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  amountDue: number;
  currency: string;
  created: string;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

interface BillingResponse {
  success: boolean;
  data: {
    tenantName: string;
    stripeCustomerId: string | null;
    subscription: SubscriptionApi | null;
    paymentMethod: PaymentMethodApi | null;
    invoices: InvoiceApi[];
    testMode: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const STATUS_BADGE_MAP: Record<StripeStatus, BadgeProps['variant']> = {
  active: 'success',
  trialing: 'info',
  past_due: 'error',
  canceled: 'error',
  unpaid: 'error',
  incomplete: 'warning',
  incomplete_expired: 'warning',
  paused: 'warning',
} as const;

function statusLabel(status: StripeStatus): string {
  return status
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManageBillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const profile = useAuthStore((s) => s.dealerUser);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const isOwner = profile?.role === 'owner' || isSuperAdmin;

  const [data, setData] = useState<BillingResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/billing');
      if (res.status === 403) {
        toast({
          type: 'error',
          title: 'Access denied',
          description: 'Only the principal can view billing.',
        });
        router.replace('/');
        return;
      }
      if (!res.ok) {
        throw new Error(`Billing request failed: ${res.status}`);
      }
      const json = (await res.json()) as BillingResponse;
      setData(json.data);
    } catch (err) {
      console.error('[ManageBilling] fetch failed', err);
      toast({
        type: 'error',
        title: 'Failed to load billing',
        description: 'Please try again in a moment.',
      });
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    if (!isOwner) return;
    void fetchData();
  }, [fetchData, isOwner]);

  const handleOpenPortal = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await authFetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`Portal request failed: ${res.status}`);
      }
      const json = (await res.json()) as { data: { url: string } };
      // Open in a new tab — the portal handles its own return navigation.
      window.open(json.data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('[ManageBilling] portal failed', err);
      toast({
        type: 'error',
        title: 'Could not open billing portal',
        description: 'Try again or contact support if the issue persists.',
      });
    } finally {
      setPortalLoading(false);
    }
  }, [toast]);

  // ── Invoice table columns ───────────────────────────────────────
  const invoiceColumns = useMemo<ColumnDef<InvoiceApi, unknown>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Invoice',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
            {row.original.number ?? row.original.id.slice(0, 12)}
          </span>
        ),
      },
      {
        accessorKey: 'created',
        header: 'Date',
        cell: ({ row }) => (
          <span className="text-sm text-text-secondary">
            {formatDate(row.original.paidAt ?? row.original.created)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const s = row.original.status ?? 'unknown';
          const variant: BadgeProps['variant'] =
            s === 'paid'
              ? 'success'
              : s === 'open'
                ? 'info'
                : s === 'void' || s === 'uncollectible'
                  ? 'error'
                  : 'default';
          return (
            <Badge variant={variant} size="sm">
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'amountPaid',
        header: 'Amount',
        cell: ({ row }) => {
          const amount = row.original.amountPaid || row.original.amountDue;
          return (
            <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
              {formatCents(amount)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const url =
            row.original.hostedInvoiceUrl ?? row.original.invoicePdf;
          if (!url) return null;
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              aria-label="View invoice"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          );
        },
      },
    ],
    [],
  );

  // ── Role gate (UI layer; middleware + API also enforce) ─────────
  if (profile && !isOwner) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Lock}
          title="Billing is restricted"
          description="Only the principal owner can view billing for this tenant."
        />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-32" />
          ))}
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  // ── Empty / unbilled state ──────────────────────────────────────
  if (!data.stripeCustomerId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
            <p className="text-sm text-text-secondary mt-1">
              {data.tenantName}
            </p>
          </div>
          {data.testMode ? (
            <Badge variant="warning" size="sm">
              Stripe Test Mode
            </Badge>
          ) : null}
        </div>

        <EmptyState
          icon={Receipt}
          title="Not yet billed"
          description="A Stripe customer hasn't been linked to this tenant yet. Once your subscription is set up, your billing details will appear here."
        />
      </div>
    );
  }

  const sub = data.subscription;
  const pm = data.paymentMethod;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Billing</h1>
          <p className="text-sm text-text-secondary mt-1">{data.tenantName}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.testMode ? (
            <Badge variant="warning" size="sm">
              Stripe Test Mode
            </Badge>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenPortal}
            disabled={portalLoading}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {portalLoading ? 'Opening…' : 'Manage in Stripe'}
          </Button>
        </div>
      </div>

      {sub?.cancelAtPeriodEnd ? (
        <div className="rounded-rally-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-status-warning">
              Subscription scheduled to cancel
            </p>
            <p className="text-xs text-text-secondary">
              Your plan will end on {formatDate(sub.periodEnd)}. Use the Stripe
              portal to renew.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Summary Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Current Plan
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="space-y-2">
                <p className="text-xl font-bold text-text-primary">
                  {sub.plan}
                </p>
                <Badge
                  variant={STATUS_BADGE_MAP[sub.status] ?? 'default'}
                  size="sm"
                >
                  {statusLabel(sub.status)}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">No active subscription</p>
            )}
          </CardContent>
        </Card>

        {/* Next invoice */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Next Invoice
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {sub ? (
              <div className="space-y-1">
                <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {formatCents(sub.amount)}
                </p>
                <p className="text-xs text-text-tertiary">
                  {sub.interval === 'year'
                    ? 'Billed yearly'
                    : sub.interval === 'month'
                      ? 'Billed monthly'
                      : 'Custom interval'}{' '}
                  · Due {formatDate(sub.periodEnd)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-tertiary">—</p>
            )}
          </CardContent>
        </Card>

        {/* Payment method */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-rally-gold" />
              <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Payment Method
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {pm && pm.last4 ? (
              <div className="space-y-1">
                <p className="text-base font-medium text-text-primary capitalize">
                  {pm.brand ?? 'Card'} •••• {pm.last4}
                </p>
                <p className="text-xs text-text-tertiary">
                  Expires{' '}
                  {pm.expMonth && pm.expYear
                    ? `${String(pm.expMonth).padStart(2, '0')}/${String(pm.expYear).slice(-2)}`
                    : '—'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-text-tertiary">
                  No payment method on file
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenPortal}
                  disabled={portalLoading}
                >
                  Add a card
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Invoice History ────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Recent Invoices
        </h2>
        <DataTable<InvoiceApi>
          columns={invoiceColumns}
          data={data.invoices}
          emptyMessage="No invoices yet"
          emptyDescription="Once your first invoice is issued it will appear here."
          emptyIcon={FileText}
        />
      </div>
    </div>
  );
}
