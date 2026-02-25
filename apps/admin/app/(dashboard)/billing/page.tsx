'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Skeleton,
  DataTable,
  RallyBarChart,
  DateRangePicker,
  useToast,
} from '@rally/ui';
import type { BadgeProps } from '@rally/ui';
import { type ColumnDef } from '@tanstack/react-table';
import {
  DollarSign,
  TrendingUp,
  Users,
  BarChart3,
  MoreHorizontal,
  ArrowDownCircle,
  CreditCard,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Subscription {
  id: string;
  tenantName: string;
  tenantSlug: string;
  plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'past_due' | 'cancelled' | 'trial';
  amountCents: number;
  nextBillingDate: string;
  startDate: string;
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const SUBSCRIPTIONS: Subscription[] = [
  { id: 'sub-001', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', plan: 'enterprise', status: 'active', amountCents: 299900, nextBillingDate: '2026-03-15', startDate: '2025-06-01' },
  { id: 'sub-002', tenantName: 'Acme Motors', tenantSlug: 'acme-motors', plan: 'pro', status: 'active', amountCents: 149900, nextBillingDate: '2026-03-01', startDate: '2025-08-15' },
  { id: 'sub-003', tenantName: 'Sunset Auto Group', tenantSlug: 'sunset-auto', plan: 'pro', status: 'active', amountCents: 149900, nextBillingDate: '2026-03-10', startDate: '2025-09-01' },
  { id: 'sub-004', tenantName: 'Heritage Ford', tenantSlug: 'heritage-ford', plan: 'starter', status: 'active', amountCents: 79900, nextBillingDate: '2026-03-05', startDate: '2025-11-01' },
  { id: 'sub-005', tenantName: 'Premier Honda', tenantSlug: 'premier-honda', plan: 'pro', status: 'active', amountCents: 149900, nextBillingDate: '2026-03-20', startDate: '2025-10-15' },
  { id: 'sub-006', tenantName: 'Metro Toyota', tenantSlug: 'metro-toyota', plan: 'enterprise', status: 'active', amountCents: 299900, nextBillingDate: '2026-03-12', startDate: '2025-07-01' },
  { id: 'sub-007', tenantName: 'Valley Chevy', tenantSlug: 'valley-chevy', plan: 'starter', status: 'active', amountCents: 79900, nextBillingDate: '2026-03-08', startDate: '2025-12-01' },
  { id: 'sub-008', tenantName: 'Lakeside BMW', tenantSlug: 'lakeside-bmw', plan: 'pro', status: 'active', amountCents: 149900, nextBillingDate: '2026-03-18', startDate: '2026-01-01' },
  { id: 'sub-009', tenantName: 'Mountain Nissan', tenantSlug: 'mountain-nissan', plan: 'trial', status: 'trial', amountCents: 0, nextBillingDate: '2026-03-10', startDate: '2026-02-10' },
  { id: 'sub-010', tenantName: 'Coastal Hyundai', tenantSlug: 'coastal-hyundai', plan: 'trial', status: 'trial', amountCents: 0, nextBillingDate: '2026-03-15', startDate: '2026-02-15' },
] as const;

const MONTHLY_REVENUE = [
  { month: 'Sep', revenue: 10990 },
  { month: 'Oct', revenue: 11790 },
  { month: 'Nov', revenue: 12590 },
  { month: 'Dec', revenue: 13390 },
  { month: 'Jan', revenue: 14000 },
  { month: 'Feb', revenue: 14800 },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const PLAN_BADGE_MAP: Record<Subscription['plan'], BadgeProps['variant']> = {
  trial: 'warning',
  starter: 'default',
  pro: 'gold',
  enterprise: 'info',
} as const;

const STATUS_BADGE_MAP: Record<Subscription['status'], BadgeProps['variant']> = {
  active: 'success',
  past_due: 'error',
  cancelled: 'error',
  trial: 'warning',
} as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const { toast } = useToast();
  const [loading] = useState(false);

  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().split('T')[0] ?? '',
  );
  const [endDate, setEndDate] = useState(
    today.toISOString().split('T')[0] ?? '',
  );

  const handleDateChange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Compute KPIs from mock data
  const mrr = useMemo(() => {
    return SUBSCRIPTIONS.reduce((acc, sub) => acc + sub.amountCents, 0);
  }, []);

  const activeSubscriptions = useMemo(() => {
    return SUBSCRIPTIONS.filter(
      (s) => s.status === 'active' || s.status === 'trial',
    ).length;
  }, []);

  const avgRevenuePerTenant = useMemo(() => {
    const paying = SUBSCRIPTIONS.filter((s) => s.amountCents > 0);
    if (paying.length === 0) return 0;
    return Math.round(
      paying.reduce((acc, s) => acc + s.amountCents, 0) / paying.length,
    );
  }, []);

  const chartData = useMemo(
    () => MONTHLY_REVENUE.map((d) => ({ month: d.month, revenue: d.revenue })),
    [],
  );

  const chartBars = useMemo(
    () => [{ dataKey: 'revenue', color: 'var(--rally-gold)', label: 'Revenue ($)' }],
    [],
  );

  // Column definitions
  const columns = useMemo<ColumnDef<Subscription, unknown>[]>(
    () => [
      {
        accessorKey: 'tenantName',
        header: 'Tenant',
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-text-primary">
              {row.original.tenantName}
            </p>
            <p className="text-[10px] text-text-tertiary font-[family-name:var(--font-geist-mono)]">
              {row.original.tenantSlug}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'plan',
        header: 'Plan',
        cell: ({ row }) => (
          <Badge variant={PLAN_BADGE_MAP[row.original.plan]} size="sm">
            {row.original.plan.charAt(0).toUpperCase() + row.original.plan.slice(1)}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={STATUS_BADGE_MAP[row.original.status]} size="sm">
            {row.original.status === 'past_due'
              ? 'Past Due'
              : row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
          </Badge>
        ),
      },
      {
        accessorKey: 'amountCents',
        header: 'Amount/mo',
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-geist-mono)] text-text-primary">
            {row.original.amountCents === 0
              ? 'Free'
              : formatCents(row.original.amountCents)}
          </span>
        ),
      },
      {
        accessorKey: 'nextBillingDate',
        header: 'Next Billing',
        cell: ({ row }) => (
          <span className="text-text-secondary text-sm">
            {formatDate(row.original.nextBillingDate)}
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
            onClick={() =>
              toast({
                type: 'info',
                title: row.original.tenantName,
                description: 'Subscription management coming soon.',
              })
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [toast],
  );

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
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Preview Banner ──────────────────────────────────────── */}
      <div className="rounded-rally-lg border border-rally-gold/20 bg-rally-goldMuted px-4 py-3 flex items-center gap-3">
        <BarChart3 className="h-4 w-4 text-rally-gold shrink-0" />
        <div>
          <p className="text-sm font-medium text-rally-gold">Preview Mode</p>
          <p className="text-xs text-text-secondary">
            Billing data shown below is sample data. Connect a payment provider to see real revenue metrics.
          </p>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Billing & Revenue
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Revenue metrics, subscriptions, and billing management
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
        />
      </div>

      {/* ── Revenue KPIs ───────────────────────────────────────── */}
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
            <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
              <CreditCard className="h-4 w-4 text-status-info" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Active Subscriptions
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {activeSubscriptions}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-surface-overlay p-2.5">
              <Users className="h-4 w-4 text-status-warning" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Avg Revenue/Tenant
              </p>
              <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {formatCents(avgRevenuePerTenant)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="shrink-0 rounded-full bg-status-success/15 p-2.5">
              <ArrowDownCircle className="h-4 w-4 text-status-success" />
            </div>
            <div>
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Churn Rate
              </p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  0%
                </p>
                <Badge variant="success" size="sm">Healthy</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-rally-gold" />
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              Monthly Revenue — Last 6 Months
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <RallyBarChart
            data={chartData}
            bars={chartBars}
            xAxisKey="month"
            height={280}
          />
        </CardContent>
      </Card>

      {/* ── Subscriptions Table ────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-3">
          Subscriptions
        </h2>
        <DataTable<Subscription>
          columns={columns}
          data={SUBSCRIPTIONS as unknown as Subscription[]}
          emptyMessage="No subscriptions"
          emptyDescription="No subscriptions have been created yet."
          emptyIcon={CreditCard}
        />
      </div>
    </div>
  );
}
