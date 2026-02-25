'use client';

import { useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin,
  RefreshCw,
  Radio,
  Car,
  BatteryMedium,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Skeleton,
} from '@rally/ui';
import { useToast } from '@rally/ui';
import { useFleetVehicles } from '@rally/firebase';
import { useTenantStore } from '@rally/services';
import type { FleetVehicle, FleetVehicleStatus } from '@rally/firebase';

// Mapbox GL requires browser APIs — dynamic import with SSR disabled
const FleetMap = dynamic(() => import('./FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded-[var(--radius-rally)] bg-[var(--surface-overlay)]">
      <Skeleton variant="card" className="h-full w-full" />
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Date to a human-readable relative time string */
function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

/** Convert optional batteryPercentage to a display value (0-100) */
function displayBatteryPercent(vehicle: FleetVehicle): number {
  return vehicle.batteryPercentage ?? 0;
}

/** Build a location label from lat/lng or fallback */
function locationLabel(vehicle: FleetVehicle): string {
  if (vehicle.latitude === 0 && vehicle.longitude === 0) return 'Unknown';
  return `${vehicle.latitude.toFixed(4)}, ${vehicle.longitude.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Display type — maps FleetVehicle to what the cards need
// ---------------------------------------------------------------------------

interface TrackedVehicleDisplay {
  id: string;
  stockNumber: string;
  label: string;
  location: string;
  batteryPercent: number;
  lastPing: string;
  status: FleetVehicleStatus;
}

function mapFleetVehicle(v: FleetVehicle): TrackedVehicleDisplay {
  return {
    id: v.id,
    stockNumber: v.stockNumber,
    label: `${v.year} ${v.make} ${v.model}`,
    location: locationLabel(v),
    batteryPercent: displayBatteryPercent(v),
    lastPing: relativeTime(v.lastUpdate),
    status: v.status,
  };
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  moving: {
    label: 'Moving',
    variant: 'success' as const,
    pulse: true,
  },
  parked: {
    label: 'Parked',
    variant: 'default' as const,
    pulse: false,
  },
  offline: {
    label: 'Offline',
    variant: 'error' as const,
    pulse: false,
  },
} as const;

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface FleetStatProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function FleetStat({ label, value, icon: Icon, color }: FleetStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] px-4 py-3">
      <div className={`rounded-lg p-2 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{value}</p>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vehicle tracking card
// ---------------------------------------------------------------------------

interface VehicleTrackingCardProps {
  vehicle: TrackedVehicleDisplay;
}

function VehicleTrackingCard({ vehicle }: VehicleTrackingCardProps) {
  const config = STATUS_CONFIG[vehicle.status];
  const batteryColor =
    vehicle.batteryPercent > 50
      ? 'text-[var(--status-success)]'
      : vehicle.batteryPercent > 20
        ? 'text-[var(--status-warning)]'
        : 'text-[var(--status-error)]';

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] p-3">
      {/* Status indicator */}
      <div className="mt-1 flex items-center">
        {config.pulse ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-success)] opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--status-success)]" />
          </span>
        ) : (
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              vehicle.status === 'offline'
                ? 'bg-[var(--status-error)]'
                : 'bg-[var(--text-disabled)]'
            }`}
          />
        )}
      </div>

      {/* Vehicle info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-[var(--rally-gold)]">
            {vehicle.stockNumber}
          </span>
          <Badge variant={config.variant} size="sm">
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-[var(--text-primary)] mt-0.5">
          {vehicle.label}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <MapPin className="h-3 w-3 text-[var(--text-tertiary)]" />
          <span className="text-xs text-[var(--text-secondary)]">{vehicle.location}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1">
            <BatteryMedium className={`h-3 w-3 ${batteryColor}`} />
            <span className={`text-xs font-medium tabular-nums ${batteryColor}`}>
              {vehicle.batteryPercent}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-[var(--text-tertiary)]" />
            <span className="text-xs text-[var(--text-tertiary)]">{vehicle.lastPing}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function FleetSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="h-10 w-24" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton variant="card" className="h-80 lg:col-span-2" />
        <Skeleton variant="card" className="h-80" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function FleetError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="rounded-full bg-[var(--status-error)]/15 p-4">
        <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load fleet data</p>
      <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FleetPage() {
  const { toast } = useToast();
  const dealershipId = useTenantStore((s) => s.activeStore?.id ?? '');

  const { fleetVehicles, loading, error } = useFleetVehicles({ dealershipId });

  // Map FleetVehicle[] to display type
  const displayVehicles = useMemo(
    () => fleetVehicles.map(mapFleetVehicle),
    [fleetVehicles],
  );

  const movingCount = useMemo(
    () => fleetVehicles.filter((v) => v.status === 'moving').length,
    [fleetVehicles],
  );
  const parkedCount = useMemo(
    () => fleetVehicles.filter((v) => v.status === 'parked').length,
    [fleetVehicles],
  );
  const offlineCount = useMemo(
    () => fleetVehicles.filter((v) => v.status === 'offline').length,
    [fleetVehicles],
  );

  const handleVehicleClick = useCallback(
    (vehicle: FleetVehicle) => {
      toast({
        type: 'info',
        title: vehicle.stockNumber,
        description: `${vehicle.year} ${vehicle.make} ${vehicle.model} — ${vehicle.status}`,
      });
    },
    [toast],
  );

  const handleRefresh = () => {
    // Data is real-time via Firestore snapshot listener — no manual refresh needed
    toast({
      type: 'info',
      title: 'Fleet data is live',
      description: 'Tracker positions update automatically via real-time sync.',
    });
  };

  // Loading state
  if (loading) return <FleetSkeleton />;

  // Error state
  if (error) return <FleetError message={error.message} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Fleet Tracker</h1>
          <Badge variant="gold" size="sm">
            {fleetVehicles.length} tracked
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FleetStat
          label="Total Tracked"
          value={fleetVehicles.length}
          icon={Radio}
          color="bg-[var(--rally-gold-muted)] text-[var(--rally-gold)]"
        />
        <FleetStat
          label="Moving Now"
          value={movingCount}
          icon={Car}
          color="bg-[var(--status-success)]/15 text-[var(--status-success)]"
        />
        <FleetStat
          label="Parked"
          value={parkedCount}
          icon={Wifi}
          color="bg-[var(--surface-border)] text-[var(--text-secondary)]"
        />
        <FleetStat
          label="Offline"
          value={offlineCount}
          icon={WifiOff}
          color="bg-[var(--status-error)]/15 text-[var(--status-error)]"
        />
      </div>

      {/* Map + Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Live Mapbox GL map */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0 overflow-hidden rounded-[var(--radius-rally)]">
            <FleetMap
              vehicles={fleetVehicles}
              onVehicleClick={handleVehicleClick}
              className="h-[400px]"
            />
          </CardContent>
        </Card>

        {/* Tracked Vehicles sidebar */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[var(--rally-gold)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Tracked Vehicles
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {displayVehicles.length > 0 ? (
                displayVehicles.map((vehicle) => (
                  <VehicleTrackingCard key={vehicle.id} vehicle={vehicle} />
                ))
              ) : (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-8">
                  No tracked vehicles found for this dealership.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
