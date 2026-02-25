'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Car,
  Users,
  Clock,
  Lock,
  ArrowRight,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
  Button,
  VehicleCard,
  ActivityFeedItem,
} from '@rally/ui';
import { useAuthStore, useTenantStore } from '@rally/services';
import {
  useVehicles,
  useActivities,
  type Vehicle,
  type VehicleStatus,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Stat card — compact KPI card for the portal dashboard
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: boolean;
}

function StatCard({ label, value, icon: Icon, accent }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            {label}
          </span>
          <span
            className={`text-2xl font-bold tabular-nums ${
              accent ? 'text-rally-gold' : 'text-text-primary'
            }`}
          >
            {value}
          </span>
        </div>
        <div className="rounded-lg bg-rally-goldMuted p-2.5">
          <Icon className="h-5 w-5 text-rally-gold" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-28" />
        ))}
      </div>
      <Skeleton variant="card" className="h-64" />
      <Skeleton variant="card" className="h-48" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalDashboardPage() {
  const router = useRouter();

  const user = useAuthStore((s) => s.firebaseUser);
  const authLoading = useAuthStore((s) => s.isLoading);
  const currentStore = useTenantStore((s) => s.activeStore);

  const dealershipId = currentStore?.id ?? '';

  const { vehicles, loading: vehiclesLoading } = useVehicles({ dealershipId });
  const { activities, loading: activitiesLoading } = useActivities({
    dealershipId,
    limitCount: 50,
  });

  // Derived stats
  const totalVehicles = vehicles.length;
  const activeNow = useMemo(
    () => activities.filter((a) => a.isActive && a.state !== 'AVAILABLE').length,
    [activities],
  );
  const avgDaysOnLot = useMemo(() => {
    const frontline = vehicles.filter((v) => v.status === 'frontline');
    if (frontline.length === 0) return 0;
    return Math.round(
      frontline.reduce((sum, v) => sum + (v.daysOnLot ?? 0), 0) / frontline.length,
    );
  }, [vehicles]);
  const onHold = useMemo(
    () => vehicles.filter((v) => v.holdInfo != null).length,
    [vehicles],
  );

  // Recent vehicles preview (first 6)
  const previewVehicles = useMemo(() => vehicles.slice(0, 6), [vehicles]);

  // Recent activities (first 5)
  const recentActivities = useMemo(() => activities.slice(0, 5), [activities]);

  const tenantName = currentStore?.name ?? 'Your Dealership';

  if (authLoading || vehiclesLoading || activitiesLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome to {tenantName}
        </h1>
        <p className="text-sm text-text-secondary">
          Your dealership portal overview
        </p>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Vehicles"
          value={String(totalVehicles)}
          icon={Car}
        />
        <StatCard
          label="Active Now"
          value={String(activeNow)}
          icon={Users}
          accent
        />
        <StatCard
          label="Avg Days on Lot"
          value={String(avgDaysOnLot)}
          icon={Clock}
        />
        <StatCard
          label="On Hold"
          value={String(onHold)}
          icon={Lock}
        />
      </div>

      {/* Inventory Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Inventory Preview
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/inventory')}
            >
              View All Inventory
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {previewVehicles.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              No vehicles in inventory yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {previewVehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.vin}
                  stockNumber={vehicle.stockNumber}
                  vin={vehicle.vin}
                  year={vehicle.year}
                  make={vehicle.make}
                  model={vehicle.model}
                  trim={vehicle.trim}
                  status={vehicle.status as VehicleStatus}
                  exteriorColor={vehicle.exteriorColor}
                  internetPrice={vehicle.internetPrice}
                  primaryPhotoUrl={vehicle.primaryPhotoUrl}
                  daysOnLot={vehicle.daysOnLot}
                  holdInfo={
                    vehicle.holdInfo
                      ? { userName: vehicle.holdInfo.customerName ?? 'Unknown' }
                      : undefined
                  }
                  onPress={() => router.push(`/inventory/${vehicle.vin}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeNow > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
                </span>
              )}
              <h2 className="text-sm font-semibold text-text-primary">
                Recent Activity
              </h2>
              {recentActivities.length > 0 && (
                <Badge variant="default" size="sm">
                  {activities.length} events
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/activity')}
            >
              View Activity
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivities.length === 0 ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              No recent activity to display.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-surface-border">
              {recentActivities.map((activity) => (
                <ActivityFeedItem
                  key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
                  userName={activity.startedByName}
                  vehicleStockNumber={activity.stockNumber}
                  vehicleYMM={activity.yearMakeModel}
                  activity={activity.state}
                  startedAt={activity.startedAt}
                  endedAt={activity.endedAt}
                  onVehicleClick={() => router.push(`/inventory/${activity.vin}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
