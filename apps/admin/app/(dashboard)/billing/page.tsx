'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@rally/firebase';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Skeleton,
  DataTable,
  RallyBarChart,
  EmptyState,
  useToast,
} from '@rally/ui';
import type { BadgeProps } from '@rally/ui';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  ArrowRight,
  CreditCard,
  AlertTriangle,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// API response types
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

interface TenantBillingRow {
  groupId: string;
  slug: string;
  name: string;
  stripeCustomerId: string | null;
  subscription: SubscriptionApi | null;
  error?: string;
}

interface SubscriptionsResponse {
  success: boolean;
  data: { tenants: TenantBillingRow[]; testMode: boolean };
}

interface RevenuePoint {
  month: string;
  label: string;
  revenue: number;
}

interface RevenueResponse {
  success: boolean;
  data: {
    months: RevenuePoint[];
    totalCents: number;
    testMode: boolean;
    stripeAvailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDateIso(iso: string | null): string {
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

function isMrrEligible(status: StripeStatus | undefined): boolean {
  return status === 'active' || status === 'trialing';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [tenants, setTenants] = useState<TenantBillingRow[]>([]);
  const [revenue, setRevenue] = useState<RevenuePoint[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stripeAvailable, setStripeAvailable] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [subsRes, revRes] = await Promise.all([
        authFetch('/api/admin/billing/subscriptions'),
        authFetch('/api/admin/billing/revenue'),
      ]);

      if (!subsRes.ok) {
        throw new Error(`Subscriptions request failed: ${subsRes.status}`);
      }
      if (!revRes.ok) {
        throw new Error(`Revenue request failed: ${revRes.status}`);
      }

      const subsJson = (await subsRes.json()) as SubscriptionsResponse;
      const revJson = (await revRes.json()) as RevenueResponse;

      setTenants(subsJson.data.tenants);
      setRevenue(revJson.data.months);
      setTestMode(subsJson.data.testMode || revJson.data.testMode);
      setStripeAvailable(revJson.data.stripeAvailable);
    } catch (err) {
      console.error('[BillingPage] fetch failed', err);
      toast({
        type: 'error',
        title: 'Failed to load billing data',
        description: 'Check your Stripe configuration and try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // ── KPIs ────────────────────────────────────────────────────────
  const mrr = useMemo(() => {
    return tenants.reduce((acc, t) => {
      if (!t.subscription) return acc;
      if (!isMrrEligible(t.subscription.status)) return acc;
      const amt = t.subscription.amount ?? 0;
      // Normalize yearly → monthly
      if (t.subscription.interval === 'year') return acc + Math.round(amt / 12);
      return acc + amt;
    }, 0);
  }, [tenants]);

  const arr = mrr * 12;

  const statusCounts = useMemo(() => {
    const counts = {
      active: 0,
      trialing: 0,
      past_due: 0,
      canceled: 0,
      none: 0,
    };
    for (const t of tenants) {
      if (!t.subscription) {
        counts.none += 1;
        continue;
      }
      const s = t.subscription.status;
      if (s === 'active') counts.active += 1;
      else if (s === 'trialing') counts.trialing += 1;
      else if (s === 'past_due') counts.past_due += 1;
      else if (s === 'canceled') counts.canceled += 1;
    }
    return counts;
  }, [tenants]);

  // ── Chart ───────────────────────────────────────────────────────
  const chartData = useMemo(
    () =>
      revenue.map((d) => ({
        label: d.label,
        revenue: Math.round(d.revenue / 100),
      })),
    [revenue],
  );

  const chartBars = useMemo(
    () => [
      { dataKey: 'revenue', color: 'var(--rally-gold)', label: 'Revenue ($)' },
    ],
    [],
  );

  // ── Columns ─────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<TenantBillingRow, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Tenant',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {row.original.name || '—'}
            </p>
            <p className="text-[10px] text-text-tertiary font-[family-name:var(--font-geist-mono)]">
              {row.original.slug || row.original.groupId}
            </p>
          </div>
        ),
      },
      {
        id: 'plan',
        header: 'Plan',
        cell: ({ row }) => {
          const sub = row.original.subscription;
          if (!sub) {
            return (
              <Badge variant="default" size="sm">
                Not yet billed
              </Badge>
            );
          }
          return (
            <Badge variant="gold" size="sm">
              {sub.plan}
            </Badge>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const sub = row.original.subscription;
          if (!sub) {
            return (
              <span className="text-xs text-text-tertiary">No subscription</span>
            );
          }
          return (
            <Badge variant={STATUS_BADGE_MAP[sub.status] ?? 'default'} size="sm">
              {statusLabel(sub.status)}
            </Badge>
          );
        },
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => {
          const sub = row.original.subscription;
          if (!sub) return <span className="text-text-tertiary">—</span>;
          const suffix =
            sub.interval === 'year'
              ? '/yr'
              : sub.interval === 'month'
                ? '/mo'
                : '';
          return (
            <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
              {formatCents(sub.amount)}
              {suffix}
            </span>
          );
        },
      },
      {
        id: 'periodEnd',
        header: 'Next Billing',
        cell: ({ row }) => (
          <span className="text-text-secondary text-sm">
            {formatDateIso(row.original.subscription?.periodEnd ?? null)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/tenants/${row.original.groupId}`)}
            aria-label={`View tenant ${row.original.name}`}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [router],
  );

  // ── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-24" />
          ))}
        </div>
        <Skeleton variant="card" className="h-80" />
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Billing & Revenue
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            System-wide subscriptions, MRR, and invoice history across every Rally tenant.
          </p>
        </div>
        {testMode ? (
          <Badge variant="warning" size="sm">
            Stripe Test Mode
          </Badge>
        ) : null}
      </div>

      {!stripeAvailable ? (
        <div className="rounded-rally-lg border border-status-warning/30 bg-status-warning/10 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-status-warning">
              Stripe is not reachable
            </p>
            <p className="text-xs text-text-secondary">
              Confirm STRIPE_SECRET_KEY is set on the server. Subscriptions and
              revenue data will appear once the connection is restored.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-rally-goldMuted p-2.5">
              <DollarSign className="h-4 w-4 text-rally-gold" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                MRR
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {formatCents(mrr)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-status-success/15 p-2.5">
              <TrendingUp className="h-4 w-4 text-status-success" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                ARR
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {formatCents(arr)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
              <CreditCard className="h-4 w-4 text-status-info" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Active
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {statusCounts.active}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-status-warning/15 p-2.5">
              <Activity className="h-4 w-4 text-status-warning" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Trialing
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {statusCounts.trialing}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Status breakdown ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Past Due
            </p>
            <p className="text-lg font-bold text-status-error font-[family-name:var(--font-geist-mono)]">
              {statusCounts.past_due}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Canceled
            </p>
            <p className="text-lg font-bold text-text-secondary font-[family-name:var(--font-geist-mono)]">
              {statusCounts.canceled}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Not Yet Billed
            </p>
            <p className="text-lg font-bold text-text-tertiary font-[family-name:var(--font-geist-mono)]">
              {statusCounts.none}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Total Tenants
            </p>
            <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
              {tenants.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
              With Stripe
            </p>
            <p className="text-lg font-bold text-rally-gold font-[family-name:var(--font-geist-mono)]">
              {tenants.filter((t) => t.stripeCustomerId).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-rally-gold" />
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Paid Revenue — Last 12 Months
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No revenue yet"
              description="Once tenants pay invoices in Stripe they'll appear here."
            />
          ) : (
            <RallyBarChart
              data={chartData}
              bars={chartBars}
              xAxisKey="label"
              height={280}
            />
          )}
        </CardContent>
      </Card>

      {/* ── Subscriptions Table ────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Subscriptions
        </h2>
        <DataTable<TenantBillingRow>
          columns={columns}
          data={tenants}
          emptyMessage="No tenants"
          emptyDescription="No tenants have been provisioned yet."
          emptyIcon={Users}
        />
      </div>
    </div>
  );
}
