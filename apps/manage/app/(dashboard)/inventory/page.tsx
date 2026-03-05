'use client';

import { useMemo } from 'react';
import {
  Store,
  AlertTriangle,
  Camera,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Badge,
  Skeleton,
  EmptyState,
  StatusBadge,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import {
  useVehicles,
  VEHICLE_STATUS_VALUES,
  VEHICLE_STATUS_DISPLAY,
  type VehicleStatus,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Status Pipeline colors — maps to Tailwind bg classes
// ---------------------------------------------------------------------------

const PIPELINE_COLORS: Record<VehicleStatus, string> = {
  incoming: 'bg-purple-500',
  intake: 'bg-orange-500',
  prep: 'bg-yellow-500',
  frontline: 'bg-emerald-500',
  service: 'bg-red-500',
  sold: 'bg-blue-500',
  delivery: 'bg-teal-500',
  offsite: 'bg-gray-500',
  archived: 'bg-gray-700',
} as const;

// ---------------------------------------------------------------------------
// Aging color helpers
// ---------------------------------------------------------------------------

function getAgingColor(days: number): string {
  if (days >= 90) return 'text-status-error';
  if (days >= 60) return 'text-orange-400';
  if (days >= 30) return 'text-status-warning';
  return 'text-status-success';
}

// ---------------------------------------------------------------------------
// Format currency
// ---------------------------------------------------------------------------

function formatPrice(price: number | undefined): string {
  if (price == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

// ---------------------------------------------------------------------------
// Format date
// ---------------------------------------------------------------------------

function formatDate(date: Date | undefined): string {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date instanceof Date ? date : new Date(date));
}

// ---------------------------------------------------------------------------
// Compute hold age in days
// ---------------------------------------------------------------------------

function holdAgeDays(createdAt: Date): number {
  const now = new Date();
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InventoryOversightSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>
      <Skeleton variant="card" className="h-24" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-64" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton variant="card" className="h-48" />
        <Skeleton variant="card" className="h-48" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InventoryOversightPage() {
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const { vehicles, loading, error } = useVehicles({ dealershipId });

  // -------------------------------------------------------------------------
  // Status Pipeline — count per status
  // -------------------------------------------------------------------------

  const statusCounts = useMemo(() => {
    const counts: Record<VehicleStatus, number> = {
      incoming: 0,
      intake: 0,
      prep: 0,
      frontline: 0,
      service: 0,
      sold: 0,
      delivery: 0,
      offsite: 0,
      archived: 0,
    };
    for (const v of vehicles) {
      counts[v.status] = (counts[v.status] ?? 0) + 1;
    }
    return counts;
  }, [vehicles]);

  const totalVehicles = vehicles.length;

  // -------------------------------------------------------------------------
  // Aging Analysis — buckets based on daysOnLot
  // -------------------------------------------------------------------------

  const agingAnalysis = useMemo(() => {
    const frontlineVehicles = vehicles.filter((v) => v.status === 'frontline');
    const total = frontlineVehicles.length;
    let under30 = 0;
    let from30to60 = 0;
    let from60to90 = 0;
    let over90 = 0;

    for (const v of frontlineVehicles) {
      const days = v.daysOnLot ?? 0;
      if (days < 30) under30++;
      else if (days < 60) from30to60++;
      else if (days < 90) from60to90++;
      else over90++;
    }

    return { total, under30, from30to60, from60to90, over90 };
  }, [vehicles]);

  // -------------------------------------------------------------------------
  // Stale Vehicles — daysOnLot > 60
  // -------------------------------------------------------------------------

  const staleVehicles = useMemo(
    () =>
      vehicles
        .filter((v) => (v.daysOnLot ?? 0) > 60)
        .sort((a, b) => (b.daysOnLot ?? 0) - (a.daysOnLot ?? 0)),
    [vehicles],
  );

  // -------------------------------------------------------------------------
  // Vehicles Without Photos
  // -------------------------------------------------------------------------

  const vehiclesWithoutPhotos = useMemo(
    () =>
      vehicles.filter(
        (v) => !v.primaryPhotoUrl && (!v.photos || v.photos.length === 0),
      ),
    [vehicles],
  );

  // -------------------------------------------------------------------------
  // Vehicles On Hold
  // -------------------------------------------------------------------------

  const vehiclesOnHold = useMemo(
    () => vehicles.filter((v) => v.holdInfo != null),
    [vehicles],
  );

  // -------------------------------------------------------------------------
  // Guard: no active store
  // -------------------------------------------------------------------------

  if (!activeStore) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Select a store"
          description="Choose a store from the sidebar to view inventory oversight."
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return <InventoryOversightSkeleton />;
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">
          Inventory Oversight
        </h1>
        <Badge variant="default" size="sm">
          {totalVehicles} vehicles
        </Badge>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Status Pipeline */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Status Pipeline
          </h2>
        </CardHeader>
        <CardContent>
          {/* Stacked bar */}
          {totalVehicles > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex h-8 w-full overflow-hidden rounded-rally">
                {VEHICLE_STATUS_VALUES.map((status) => {
                  const count = statusCounts[status];
                  if (count === 0) return null;
                  const pct = (count / totalVehicles) * 100;
                  return (
                    <div
                      key={status}
                      className={`${PIPELINE_COLORS[status]} relative flex items-center justify-center transition-all duration-300`}
                      style={{ width: `${pct}%`, minWidth: pct > 3 ? undefined : '12px' }}
                      title={`${VEHICLE_STATUS_DISPLAY[status].displayName}: ${count}`}
                    >
                      {pct > 8 && (
                        <span className="text-[10px] font-bold text-white/90 truncate px-1">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {VEHICLE_STATUS_VALUES.map((status) => {
                  const count = statusCounts[status];
                  if (count === 0) return null;
                  return (
                    <div key={status} className="flex items-center gap-1.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${PIPELINE_COLORS[status]}`}
                      />
                      <span className="text-xs text-text-secondary">
                        {VEHICLE_STATUS_DISPLAY[status].displayName}
                      </span>
                      <span className="text-xs font-medium text-text-primary tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              No vehicles in inventory.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Aging Analysis */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-text-primary">
            Aging Analysis
          </h2>
          <p className="text-xs text-text-tertiary">
            Frontline vehicles grouped by days on lot
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {/* Total Frontline */}
            <div className="flex flex-col gap-1 rounded-rally bg-surface-overlay p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Total Frontline
              </span>
              <span className="text-2xl font-bold text-text-primary tabular-nums">
                {agingAnalysis.total}
              </span>
            </div>
            {/* Under 30 Days */}
            <div className="flex flex-col gap-1 rounded-rally bg-surface-overlay p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                Under 30 Days
              </span>
              <span className="text-2xl font-bold text-status-success tabular-nums">
                {agingAnalysis.under30}
              </span>
              <div className="mt-1 h-1 w-full rounded-full bg-surface-border">
                <div
                  className="h-1 rounded-full bg-status-success transition-all"
                  style={{
                    width: agingAnalysis.total > 0
                      ? `${(agingAnalysis.under30 / agingAnalysis.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            {/* 30-60 Days */}
            <div className="flex flex-col gap-1 rounded-rally bg-surface-overlay p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                30-60 Days
              </span>
              <span className="text-2xl font-bold text-status-warning tabular-nums">
                {agingAnalysis.from30to60}
              </span>
              <div className="mt-1 h-1 w-full rounded-full bg-surface-border">
                <div
                  className="h-1 rounded-full bg-status-warning transition-all"
                  style={{
                    width: agingAnalysis.total > 0
                      ? `${(agingAnalysis.from30to60 / agingAnalysis.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            {/* 60-90 Days */}
            <div className="flex flex-col gap-1 rounded-rally bg-surface-overlay p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                60-90 Days
              </span>
              <span className="text-2xl font-bold text-orange-400 tabular-nums">
                {agingAnalysis.from60to90}
              </span>
              <div className="mt-1 h-1 w-full rounded-full bg-surface-border">
                <div
                  className="h-1 rounded-full bg-orange-500 transition-all"
                  style={{
                    width: agingAnalysis.total > 0
                      ? `${(agingAnalysis.from60to90 / agingAnalysis.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            {/* 90+ Days */}
            <div className="flex flex-col gap-1 rounded-rally bg-surface-overlay p-3">
              <span className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                90+ Days
              </span>
              <span className="text-2xl font-bold text-status-error tabular-nums">
                {agingAnalysis.over90}
              </span>
              <div className="mt-1 h-1 w-full rounded-full bg-surface-border">
                <div
                  className="h-1 rounded-full bg-status-error transition-all"
                  style={{
                    width: agingAnalysis.total > 0
                      ? `${(agingAnalysis.over90 / agingAnalysis.total) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Stale Vehicles */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-text-primary">
              Stale Vehicles
            </h2>
            <Badge variant="warning" size="sm">
              {staleVehicles.length}
            </Badge>
          </div>
          <p className="text-xs text-text-tertiary">
            Vehicles with more than 60 days on lot
          </p>
        </CardHeader>
        <CardContent>
          {staleVehicles.length === 0 ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <CheckCircle2 className="h-5 w-5 text-status-success" />
              <span className="text-sm text-text-secondary">
                No aging inventory issues
              </span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-surface-border">
              {staleVehicles.map((v) => (
                <div
                  key={v.id ?? v.vin}
                  className="flex items-center gap-3 py-2.5"
                >
                  {/* Stock number */}
                  <span className="font-mono text-sm font-bold text-rally-gold min-w-[72px]">
                    {v.stockNumber}
                  </span>

                  {/* YMM */}
                  <span className="flex-1 text-sm text-text-primary truncate">
                    {v.year} {v.make} {v.model}
                  </span>

                  {/* Days on lot */}
                  <span
                    className={`text-sm font-bold tabular-nums ${getAgingColor(v.daysOnLot ?? 0)}`}
                  >
                    {v.daysOnLot ?? 0}d
                  </span>

                  {/* Status badge */}
                  <StatusBadge status={v.status} size="sm" />

                  {/* Price */}
                  <span className="text-sm text-text-secondary tabular-nums min-w-[80px] text-right">
                    {formatPrice(v.internetPrice)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Bottom row: No Photos + On Hold */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Vehicles Without Photos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Missing Photos
              </h2>
              {vehiclesWithoutPhotos.length > 0 && (
                <Badge variant="error" size="sm">
                  {vehiclesWithoutPhotos.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              Vehicles with no primary photo or gallery
            </p>
          </CardHeader>
          <CardContent>
            {vehiclesWithoutPhotos.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <CheckCircle2 className="h-5 w-5 text-status-success" />
                <span className="text-sm text-text-secondary">
                  All vehicles have photos
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {vehiclesWithoutPhotos.slice(0, 20).map((v) => (
                  <span
                    key={v.id ?? v.vin}
                    className="inline-flex items-center rounded-rally bg-surface-overlay px-2.5 py-1 font-mono text-xs font-medium text-rally-gold"
                  >
                    {v.stockNumber}
                  </span>
                ))}
                {vehiclesWithoutPhotos.length > 20 && (
                  <span className="inline-flex items-center rounded-rally bg-surface-overlay px-2.5 py-1 text-xs text-text-tertiary">
                    +{vehiclesWithoutPhotos.length - 20} more
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* On Hold */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-text-tertiary" />
              <h2 className="text-sm font-semibold text-text-primary">
                On Hold
              </h2>
              {vehiclesOnHold.length > 0 && (
                <Badge variant="gold" size="sm">
                  {vehiclesOnHold.length}
                </Badge>
              )}
            </div>
            <p className="text-xs text-text-tertiary">
              Vehicles currently held for customers
            </p>
          </CardHeader>
          <CardContent>
            {vehiclesOnHold.length === 0 ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <span className="text-sm text-text-secondary">
                  No vehicles on hold
                </span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-surface-border">
                {vehiclesOnHold.map((v) => {
                  const hold = v.holdInfo;
                  if (!hold) return null;
                  const age = holdAgeDays(hold.createdAt);
                  const expiresAt = hold.expiresAt
                    ? formatDate(hold.expiresAt)
                    : 'No expiration';
                  const isExpired =
                    hold.expiresAt != null &&
                    new Date(hold.expiresAt).getTime() < Date.now();

                  return (
                    <div
                      key={v.id ?? v.vin}
                      className="flex items-center gap-3 py-2.5"
                    >
                      {/* Stock number */}
                      <span className="font-mono text-sm font-bold text-rally-gold min-w-[72px]">
                        {v.stockNumber}
                      </span>

                      {/* Customer info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">
                          {hold.customerName ?? 'Unknown Customer'}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          Expires: {expiresAt}
                          {isExpired && (
                            <span className="ml-1 text-status-error font-medium">
                              EXPIRED
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Hold age */}
                      <span className={`text-xs tabular-nums ${age > 3 ? 'text-status-warning' : 'text-text-secondary'}`}>
                        {age}d held
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
