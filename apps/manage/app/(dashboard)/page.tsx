'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Car,
  TrendingUp,
  FileBarChart,
  Calendar,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Skeleton,
  ActivityFeedItem,
  StatChart,
  type StatChartDataPoint,
} from '@rally/ui';
import type { VehicleActivity as UIVehicleActivity } from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import { useVehicles, useActivities, useUsers } from '@rally/firebase';
import type { VehicleActivity } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Quick Links
// ---------------------------------------------------------------------------

const QUICK_LINKS = [
  { label: 'Users', href: '/users', icon: Users, color: 'text-status-info' },
  { label: 'Inventory', href: '/inventory', icon: Car, color: 'text-status-success' },
  { label: 'Performance', href: '/performance', icon: TrendingUp, color: 'text-rally-gold' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, color: 'text-status-warning' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build sparkline data from activities over the last 7 days.
 * Each point = activity count for that day.
 */
function buildActivitySparkline(activities: VehicleActivity[]): StatChartDataPoint[] {
  const now = new Date();
  const points: StatChartDataPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const dayStr = day.toISOString().split('T')[0] ?? '';
    const dayLabel = day.toLocaleDateString('en-US', { weekday: 'short' });

    const count = activities.filter((a) => {
      const aDate = a.startedAt instanceof Date ? a.startedAt : new Date(a.startedAt);
      return aDate.toISOString().split('T')[0] === dayStr;
    }).length;

    points.push({ value: count, label: dayLabel });
  }

  return points;
}

/**
 * Calculate average days on lot.
 * Uses the precomputed `daysOnLot` field if available, otherwise
 * falls back to calculating from `addedToInventoryAt`.
 */
function calcAvgDaysOnLot(vehicles: { daysOnLot?: number; addedToInventoryAt?: Date }[]): number {
  if (vehicles.length === 0) return 0;

  const now = Date.now();
  let total = 0;
  let count = 0;

  for (const v of vehicles) {
    if (typeof v.daysOnLot === 'number') {
      total += v.daysOnLot;
      count++;
    } else if (v.addedToInventoryAt) {
      const added = v.addedToInventoryAt instanceof Date
        ? v.addedToInventoryAt.getTime()
        : Date.now();
      total += (now - added) / (1000 * 60 * 60 * 24);
      count++;
    }
  }

  return count > 0 ? Math.round(total / count) : 0;
}

/**
 * Count vehicles sold this month.
 */
function countSoldThisMonth(activities: VehicleActivity[]): number {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return activities.filter((a) => {
    if (a.state !== 'SOLD') return false;
    const date = a.startedAt instanceof Date ? a.startedAt : new Date(a.startedAt);
    return date >= firstOfMonth;
  }).length;
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton variant="text" className="h-7 w-64" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton variant="text" className="h-3 w-20" />
            </CardHeader>
            <CardContent>
              <Skeleton variant="text" className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sparkline skeleton */}
      <Card>
        <CardHeader>
          <Skeleton variant="text" className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton variant="card" className="h-12 w-full" />
        </CardContent>
      </Card>

      {/* Activity skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function ManageDashboardPage() {
  const router = useRouter();
  const dealerUser = useAuthStore((s) => s.dealerUser);
  const activeStore = useTenantStore((s) => s.activeStore);

  const dealershipId = activeStore?.id ?? dealerUser?.dealershipId ?? '';

  // ── Data hooks ─────────────────────────────────────────────────
  const { users, loading: usersLoading } = useUsers({ dealershipId });
  const { vehicles, loading: vehiclesLoading } = useVehicles({ dealershipId });
  const { activities, loading: activitiesLoading } = useActivities({
    dealershipId,
    limitCount: 100,
  });

  const isLoading = usersLoading || vehiclesLoading || activitiesLoading;

  // ── Computed stats ─────────────────────────────────────────────
  const activeStaffCount = users.length;
  const totalVehicles = vehicles.length;
  const avgDaysOnLot = useMemo(() => calcAvgDaysOnLot(vehicles), [vehicles]);
  const soldThisMonth = useMemo(() => countSoldThisMonth(activities), [activities]);

  const activitySparkline = useMemo(
    () => buildActivitySparkline(activities),
    [activities],
  );

  const recentActivities = useMemo(
    () => activities.slice(0, 5),
    [activities],
  );

  // ── Stat cards config ──────────────────────────────────────────
  const statCards = [
    {
      label: 'Active Staff',
      value: activeStaffCount.toLocaleString(),
      icon: Users,
      color: 'text-status-info',
    },
    {
      label: 'Total Vehicles',
      value: totalVehicles.toLocaleString(),
      icon: Car,
      color: 'text-status-success',
    },
    {
      label: 'Avg Days on Lot',
      value: avgDaysOnLot.toLocaleString(),
      icon: Clock,
      color: 'text-status-warning',
    },
    {
      label: 'Sold This Month',
      value: soldThisMonth.toLocaleString(),
      icon: ShoppingCart,
      color: 'text-rally-gold',
    },
  ] as const;

  // ── Loading guard ──────────────────────────────────────────────
  if (!dealerUser || isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Greeting ───────────────────────────────────────────────────
  const firstName = dealerUser.displayName?.split(' ')[0] ?? 'Manager';
  const storeName = activeStore?.name ?? 'your dealership';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Management Console &mdash; {storeName}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                    {stat.label}
                  </p>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Sparkline */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-rally-gold" />
            <p className="text-sm font-medium text-text-primary">
              Activity &mdash; Last 7 Days
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <StatChart data={activitySparkline} height={64} />
        </CardContent>
      </Card>

      {/* Two-column bottom: Recent Activity + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-1">
          <h2 className="text-sm font-medium uppercase tracking-wider text-text-secondary mb-3">
            Recent Activity
          </h2>
          {recentActivities.length > 0 ? (
            <div className="rounded-rally-lg border border-surface-border overflow-hidden">
              {recentActivities.map((activity) => (
                <ActivityFeedItem
                  key={activity.id}
                  userName={activity.startedByName}
                  vehicleStockNumber={activity.stockNumber}
                  vehicleYMM={activity.yearMakeModel}
                  activity={activity.state as UIVehicleActivity}
                  startedAt={
                    activity.startedAt instanceof Date
                      ? activity.startedAt
                      : new Date(activity.startedAt)
                  }
                  endedAt={
                    activity.endedAt instanceof Date
                      ? activity.endedAt
                      : activity.endedAt
                        ? new Date(activity.endedAt)
                        : undefined
                  }
                  onVehicleClick={() => router.push(`/inventory?vin=${activity.vin}`)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <p className="text-sm text-text-tertiary text-center py-8">
                  No recent activity
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Links */}
        <div className="space-y-1">
          <h2 className="text-sm font-medium uppercase tracking-wider text-text-secondary mb-3">
            Quick Links
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Card
                  key={link.label}
                  variant="interactive"
                  onClick={() => router.push(link.href)}
                >
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="rounded-rally bg-surface-overlay p-2">
                        <Icon className={`h-5 w-5 ${link.color}`} />
                      </div>
                      <span className="text-sm font-medium text-text-primary">
                        {link.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
