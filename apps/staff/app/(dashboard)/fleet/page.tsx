'use client';

import { useState } from 'react';
import {
  MapPin,
  RefreshCw,
  Radio,
  Car,
  BatteryMedium,
  Clock,
  Wifi,
  WifiOff,
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VehicleTrackingStatus = 'moving' | 'parked' | 'offline';

interface TrackedVehicle {
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  location: string;
  batteryPercent: number;
  lastPing: string;
  status: VehicleTrackingStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_VEHICLES: TrackedVehicle[] = [
  {
    stockNumber: 'R1234',
    year: 2024,
    make: 'Jeep',
    model: 'Wrangler',
    location: 'Main Lot, Row C',
    batteryPercent: 92,
    lastPing: '2 min ago',
    status: 'moving',
  },
  {
    stockNumber: 'R2345',
    year: 2023,
    make: 'Ram',
    model: '1500',
    location: 'Service Bay 3',
    batteryPercent: 85,
    lastPing: '5 min ago',
    status: 'parked',
  },
  {
    stockNumber: 'R3456',
    year: 2024,
    make: 'Dodge',
    model: 'Charger',
    location: 'Test Drive Route',
    batteryPercent: 78,
    lastPing: '1 min ago',
    status: 'moving',
  },
  {
    stockNumber: 'R4567',
    year: 2023,
    make: 'Chrysler',
    model: '300',
    location: 'Off-site',
    batteryPercent: 15,
    lastPing: '3 hrs ago',
    status: 'parked',
  },
  {
    stockNumber: 'R5678',
    year: 2024,
    make: 'Jeep',
    model: 'Grand Cherokee',
    location: 'Unknown',
    batteryPercent: 0,
    lastPing: 'Never',
    status: 'offline',
  },
] as const;

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
  vehicle: TrackedVehicle;
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
          {vehicle.year} {vehicle.make} {vehicle.model}
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
// Page
// ---------------------------------------------------------------------------

export default function FleetPage() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const movingCount = MOCK_VEHICLES.filter((v) => v.status === 'moving').length;
  const parkedCount = MOCK_VEHICLES.filter((v) => v.status === 'parked').length;
  const offlineCount = MOCK_VEHICLES.filter((v) => v.status === 'offline').length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    // TODO: Refresh real GPS data from Ghost/Kahu trackers
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        type: 'info',
        title: 'Fleet data refreshed',
        description: 'All tracker positions updated.',
      });
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Fleet Tracker</h1>
          <Badge variant="gold" size="sm">
            {MOCK_VEHICLES.length} tracked
          </Badge>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={isRefreshing}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FleetStat
          label="Total Tracked"
          value={MOCK_VEHICLES.length}
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
        {/* Map placeholder */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {/* TODO: Integrate Mapbox GL JS — render vehicle positions as markers */}
            {/* TODO: Use mapboxgl.Map with style 'mapbox://styles/mapbox/dark-v11' */}
            {/* TODO: Add real-time marker updates via Firestore snapshot listener */}
            <div className="relative flex h-[400px] items-center justify-center rounded-[var(--radius-rally)] bg-[var(--surface-overlay)]">
              {/* Faux grid lines for map feel */}
              <div className="absolute inset-0 opacity-5">
                <div className="h-full w-full" style={{
                  backgroundImage: 'linear-gradient(var(--text-tertiary) 1px, transparent 1px), linear-gradient(90deg, var(--text-tertiary) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }} />
              </div>

              {/* Center content */}
              <div className="relative z-10 flex flex-col items-center gap-3 text-center">
                <div className="rounded-full bg-[var(--rally-gold-muted)] p-4">
                  <MapPin className="h-8 w-8 text-[var(--rally-gold)]" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Mapbox GL JS map will render here
                </p>
                <p className="text-xs text-[var(--text-tertiary)] max-w-xs">
                  Vehicle positions from Ghost OBD2 trackers will display as real-time markers on the map.
                </p>
              </div>

              {/* Mock map dots */}
              <div className="absolute top-[30%] left-[25%] h-3 w-3 rounded-full bg-[var(--status-success)] opacity-60 animate-pulse" />
              <div className="absolute top-[50%] left-[60%] h-3 w-3 rounded-full bg-[var(--status-success)] opacity-60 animate-pulse" />
              <div className="absolute top-[70%] left-[40%] h-3 w-3 rounded-full bg-[var(--text-disabled)] opacity-40" />
              <div className="absolute top-[20%] right-[20%] h-3 w-3 rounded-full bg-[var(--text-disabled)] opacity-40" />
              <div className="absolute bottom-[25%] right-[30%] h-3 w-3 rounded-full bg-[var(--status-error)] opacity-40" />
            </div>
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
              {MOCK_VEHICLES.map((vehicle) => (
                <VehicleTrackingCard key={vehicle.stockNumber} vehicle={vehicle} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
