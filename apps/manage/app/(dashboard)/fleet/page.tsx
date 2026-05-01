'use client';

// Manage Fleet — GM/Principal-tier fleet + battery oversight
// Live Mapbox map of GPS-tracked vehicles with sidebar filters and KPI strip.

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Truck,
  BatteryWarning,
  BatteryLow,
  BatteryFull,
  WifiOff,
  Search,
  AlertCircle,
  MapPin,
  Clock,
  Filter,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
  Input,
  EmptyState,
  FilterBar,
  type FilterOption,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import {
  useFleetVehicles,
  useBatteryReports,
  type FleetVehicle,
  type BatteryStatus,
} from '@rally/firebase';

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
// Constants
// ---------------------------------------------------------------------------

const SOURCE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'kahu', label: 'Kahu' },
] as const;

const LOW_BATTERY_DEFAULT = 12.0;
const STALE_HOURS = 24;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function batteryClass(voltage: number | undefined, threshold: number): {
  status: BatteryStatus;
  color: string;
  label: string;
} {
  if (voltage === undefined) {
    return { status: 'healthy', color: 'text-[var(--text-tertiary)]', label: '--' };
  }
  if (voltage < 11.5) {
    return {
      status: 'critical',
      color: 'text-[var(--status-error)]',
      label: `${voltage.toFixed(2)}V`,
    };
  }
  if (voltage < threshold) {
    return {
      status: 'warning',
      color: 'text-[var(--status-warning)]',
      label: `${voltage.toFixed(2)}V`,
    };
  }
  return {
    status: 'healthy',
    color: 'text-[var(--status-success)]',
    label: `${voltage.toFixed(2)}V`,
  };
}

// ---------------------------------------------------------------------------
// KPI Stat
// ---------------------------------------------------------------------------

interface FleetStatProps {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'gold' | 'success' | 'warning' | 'error' | 'neutral';
}

function FleetStat({ label, value, icon: Icon, tone }: FleetStatProps) {
  const toneClass = {
    gold: 'bg-[var(--rally-gold-muted)] text-[var(--rally-gold)]',
    success: 'bg-[var(--status-success)]/15 text-[var(--status-success)]',
    warning: 'bg-[var(--status-warning)]/15 text-[var(--status-warning)]',
    error: 'bg-[var(--status-error)]/15 text-[var(--status-error)]',
    neutral: 'bg-[var(--surface-border)] text-[var(--text-secondary)]',
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] px-4 py-3">
      <div className={`rounded-lg p-2 ${toneClass}`}>
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
// Sidebar list row
// ---------------------------------------------------------------------------

interface FleetListRowProps {
  vehicle: FleetVehicle;
  voltage?: number;
  threshold: number;
}

function FleetListRow({ vehicle, voltage, threshold }: FleetListRowProps) {
  const battery = batteryClass(voltage, threshold);
  const isStale = Date.now() - vehicle.lastUpdate.getTime() > STALE_HOURS * 60 * 60 * 1000;

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-[var(--rally-gold)]">
            {vehicle.stockNumber}
          </span>
          <Badge
            variant={
              vehicle.status === 'moving'
                ? 'success'
                : vehicle.status === 'offline'
                  ? 'error'
                  : 'default'
            }
            size="sm"
          >
            {vehicle.status}
          </Badge>
          <Badge variant="default" size="sm">
            {vehicle.source}
          </Badge>
        </div>
        <p className="text-sm text-[var(--text-primary)] mt-0.5 truncate">
          {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium tabular-nums ${battery.color}`}>
              {battery.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-[var(--text-tertiary)]" />
            <span
              className={`text-xs ${
                isStale ? 'text-[var(--status-warning)]' : 'text-[var(--text-tertiary)]'
              }`}
            >
              {relativeTime(vehicle.lastUpdate)}
            </span>
          </div>
          {(vehicle.latitude === 0 && vehicle.longitude === 0) && (
            <span className="flex items-center gap-1 text-xs text-[var(--status-error)]">
              <MapPin className="h-3 w-3" />
              No GPS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function FleetSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton variant="card" className="h-[500px] lg:col-span-2" />
        <Skeleton variant="card" className="h-[500px]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManageFleetPage() {
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const { fleetVehicles, loading: vLoading, error: vErr } = useFleetVehicles({
    dealershipId,
  });
  const { batteryReports, loading: bLoading, error: bErr } = useBatteryReports({
    dealershipId,
  });

  const [source, setSource] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState<number>(LOW_BATTERY_DEFAULT);
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const [showNoGps, setShowNoGps] = useState(false);

  // Build voltage map by VIN
  const voltageByVin = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of batteryReports) {
      if (!m.has(r.vin) || r.voltage > 0) {
        m.set(r.vin, r.voltage);
      }
    }
    return m;
  }, [batteryReports]);

  // Apply filters
  const filtered = useMemo(() => {
    return fleetVehicles.filter((v) => {
      if (source !== 'all' && v.source !== source) return false;
      const voltage = voltageByVin.get(v.vin);
      if (showLowOnly && (voltage === undefined || voltage >= threshold)) return false;
      if (
        showStale &&
        Date.now() - v.lastUpdate.getTime() < STALE_HOURS * 60 * 60 * 1000
      )
        return false;
      if (showNoGps && (v.latitude !== 0 || v.longitude !== 0)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${v.stockNumber} ${v.vin} ${v.make} ${v.model}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [fleetVehicles, voltageByVin, source, search, showLowOnly, showStale, showNoGps, threshold]);

  // KPI counts
  const kpis = useMemo(() => {
    const total = fleetVehicles.length;
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let stale = 0;
    let unknown = 0;
    const staleMs = STALE_HOURS * 60 * 60 * 1000;
    for (const v of fleetVehicles) {
      const voltage = voltageByVin.get(v.vin);
      if (voltage === undefined) {
        unknown += 1;
      } else if (voltage < 11.5) {
        critical += 1;
      } else if (voltage < threshold) {
        warning += 1;
      } else {
        healthy += 1;
      }
      if (Date.now() - v.lastUpdate.getTime() > staleMs) stale += 1;
    }
    return { total, healthy, warning, critical, stale, unknown };
  }, [fleetVehicles, voltageByVin, threshold]);

  const handleVehicleClick = useCallback((vehicle: FleetVehicle) => {
    // Future: open drawer or route to inventory detail by VIN
    void vehicle;
  }, []);

  if (!activeStore) {
    return <FleetSkeleton />;
  }

  if (vLoading || bLoading) {
    return <FleetSkeleton />;
  }

  if (vErr || bErr) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="rounded-full bg-[var(--status-error)]/15 p-4">
          <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Failed to load fleet data
        </p>
        <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">
          {(vErr ?? bErr)?.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Fleet</h1>
          <Badge variant="gold" size="sm">
            {kpis.total} tracked
          </Badge>
        </div>
        <FilterBar
          options={SOURCE_FILTER_OPTIONS}
          selected={source}
          onSelect={setSource}
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <FleetStat label="Total Tracked" value={kpis.total} icon={Truck} tone="gold" />
        <FleetStat label="Healthy" value={kpis.healthy} icon={BatteryFull} tone="success" />
        <FleetStat label="Warning" value={kpis.warning} icon={BatteryLow} tone="warning" />
        <FleetStat
          label="Critical"
          value={kpis.critical}
          icon={BatteryWarning}
          tone="error"
        />
        <FleetStat label={`Stale (>${STALE_HOURS}h)`} value={kpis.stale} icon={WifiOff} tone="neutral" />
      </div>

      {/* Map + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Map */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0 overflow-hidden rounded-[var(--radius-rally)]">
            {fleetVehicles.length === 0 ? (
              <div className="flex h-[500px] items-center justify-center">
                <EmptyState
                  icon={Truck}
                  title="No tracked vehicles"
                  description="Vehicles fitted with Ghost or Kahu trackers will appear here in real time."
                />
              </div>
            ) : (
              <FleetMap
                vehicles={filtered}
                voltageByVin={voltageByVin}
                onVehicleClick={handleVehicleClick}
                className="h-[500px]"
              />
            )}
          </CardContent>
        </Card>

        {/* Sidebar — filters + list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--rally-gold)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Filters
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Search stock # or VIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startIcon={<Search className="h-4 w-4" />}
              />

              {/* Threshold slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Low Battery Threshold
                  </span>
                  <span className="text-xs font-mono text-[var(--rally-gold)] tabular-nums">
                    {threshold.toFixed(1)}V
                  </span>
                </div>
                <input
                  type="range"
                  min={11.0}
                  max={13.0}
                  step={0.1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number.parseFloat(e.target.value))}
                  className="w-full accent-[var(--rally-gold)]"
                />
              </div>

              {/* Toggle filters */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLowOnly}
                    onChange={(e) => setShowLowOnly(e.target.checked)}
                    className="accent-[var(--rally-gold)]"
                  />
                  <span className="text-xs text-[var(--text-primary)]">
                    Low battery only
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStale}
                    onChange={(e) => setShowStale(e.target.checked)}
                    className="accent-[var(--rally-gold)]"
                  />
                  <span className="text-xs text-[var(--text-primary)]">
                    Last seen &gt; {STALE_HOURS}h
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showNoGps}
                    onChange={(e) => setShowNoGps(e.target.checked)}
                    className="accent-[var(--rally-gold)]"
                  />
                  <span className="text-xs text-[var(--text-primary)]">No GPS signal</span>
                </label>
              </div>

              {/* Result list */}
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-[var(--text-tertiary)] text-center py-8">
                    No vehicles match these filters.
                  </p>
                ) : (
                  filtered
                    .slice(0, 50)
                    .map((v) => (
                      <FleetListRow
                        key={v.id}
                        vehicle={v}
                        voltage={voltageByVin.get(v.vin)}
                        threshold={threshold}
                      />
                    ))
                )}
                {filtered.length > 50 && (
                  <p className="text-[10px] text-[var(--text-tertiary)] text-center pt-2">
                    Showing 50 of {filtered.length} &mdash; refine to see more.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
