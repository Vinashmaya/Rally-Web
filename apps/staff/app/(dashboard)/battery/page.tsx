'use client';

import { useState, useMemo } from 'react';
import {
  Battery,
  BatteryWarning,
  BatteryFull,
  BatteryLow,
  Zap,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
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
import { useBatteryReports, createInteraction } from '@rally/firebase';
import { useAuthStore, useTenantStore } from '@rally/services';
import type { BatteryReport, BatteryStatus } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatteryFilter = 'all' | 'critical' | 'warning' | 'healthy';

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

/** Convert voltage to a rough percentage (12.6V = 100%, 11.8V = 0%) */
function voltageToPercent(voltage: number): number {
  const minV = 11.8;
  const maxV = 12.6;
  const clamped = Math.max(minV, Math.min(maxV, voltage));
  return Math.round(((clamped - minV) / (maxV - minV)) * 100);
}

const BATTERY_LEVEL_CONFIG = {
  critical: {
    barColor: 'bg-[var(--status-error)]',
    textColor: 'text-[var(--status-error)]',
    icon: BatteryLow,
    badgeVariant: 'error' as const,
  },
  warning: {
    barColor: 'bg-[var(--status-warning)]',
    textColor: 'text-[var(--status-warning)]',
    icon: BatteryWarning,
    badgeVariant: 'warning' as const,
  },
  healthy: {
    barColor: 'bg-[var(--status-success)]',
    textColor: 'text-[var(--status-success)]',
    icon: BatteryFull,
    badgeVariant: 'success' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Display type — maps BatteryReport to what the cards need
// ---------------------------------------------------------------------------

interface BatteryVehicleDisplay {
  id: string;
  stockNumber: string;
  label: string;
  batteryPercent: number;
  voltage: number;
  batteryStatus: BatteryStatus;
  lastReading: string;
  deviceId: string;
}

function mapBatteryReport(r: BatteryReport): BatteryVehicleDisplay {
  return {
    id: r.id,
    stockNumber: r.stockNumber,
    label: `${r.year} ${r.make} ${r.model}`,
    batteryPercent: voltageToPercent(r.voltage),
    voltage: r.voltage,
    batteryStatus: r.batteryStatus,
    lastReading: relativeTime(r.lastEventTime),
    deviceId: r.deviceId,
  };
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

interface SummaryCardProps {
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  active: boolean;
  onClick: () => void;
}

function SummaryCard({ label, count, icon: Icon, color, bgColor, active, onClick }: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-[var(--radius-rally-lg)] p-4 transition-all duration-150 cursor-pointer ${
        active
          ? 'bg-[var(--rally-gold-muted)] ring-1 ring-[var(--rally-gold)]/30'
          : 'bg-[var(--surface-overlay)] hover:bg-[var(--surface-border)]'
      }`}
    >
      <div className={`rounded-lg p-2 ${bgColor}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="text-left">
        <p className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{count}</p>
        <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Battery vehicle card
// ---------------------------------------------------------------------------

interface BatteryCardProps {
  vehicle: BatteryVehicleDisplay;
  onJumpStart: (vehicle: BatteryVehicleDisplay) => void;
}

function BatteryCard({ vehicle, onJumpStart }: BatteryCardProps) {
  const config = BATTERY_LEVEL_CONFIG[vehicle.batteryStatus];
  const LevelIcon = config.icon;

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[var(--rally-gold)]">
                {vehicle.stockNumber}
              </span>
              <Badge variant={config.badgeVariant} size="sm">
                {vehicle.batteryStatus.charAt(0).toUpperCase() + vehicle.batteryStatus.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-primary)] mt-1">
              {vehicle.label}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">
                Last reading: {vehicle.lastReading}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-disabled)] mt-0.5 block">
              {vehicle.voltage.toFixed(1)}V &middot; {vehicle.deviceId}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <LevelIcon className={`h-5 w-5 ${config.textColor}`} />
              <span className={`text-lg font-bold tabular-nums ${config.textColor}`}>
                {vehicle.batteryPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Battery bar */}
        <div className="mt-3 h-2 w-full rounded-full bg-[var(--surface-border)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${config.barColor}`}
            style={{ width: `${vehicle.batteryPercent}%` }}
          />
        </div>

        {/* Jump start button for critical */}
        {vehicle.batteryStatus === 'critical' && (
          <Button
            variant="danger"
            size="sm"
            className="mt-3 w-full"
            onClick={() => onJumpStart(vehicle)}
          >
            <Zap className="h-3.5 w-3.5" />
            Request Jump Start
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function BatterySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-36" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function BatteryError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <div className="rounded-full bg-[var(--status-error)]/15 p-4">
        <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)]">Failed to load battery data</p>
      <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BatteryPage() {
  const { toast } = useToast();
  const dealershipId = useTenantStore((s) => s.activeStore?.id ?? '');
  const userId = useAuthStore((s) => s.firebaseUser?.uid ?? '');

  const [filter, setFilter] = useState<BatteryFilter>('all');

  const { batteryReports, loading, error } = useBatteryReports({ dealershipId });

  // Map BatteryReport[] to display type
  const displayVehicles = useMemo(
    () => batteryReports.map(mapBatteryReport),
    [batteryReports],
  );

  const criticalCount = useMemo(
    () => batteryReports.filter((r) => r.batteryStatus === 'critical').length,
    [batteryReports],
  );
  const warningCount = useMemo(
    () => batteryReports.filter((r) => r.batteryStatus === 'warning').length,
    [batteryReports],
  );
  const healthyCount = useMemo(
    () => batteryReports.filter((r) => r.batteryStatus === 'healthy').length,
    [batteryReports],
  );

  const filteredVehicles = useMemo(() => {
    const sorted = [...displayVehicles].sort((a, b) => a.batteryPercent - b.batteryPercent);
    if (filter === 'all') return sorted;
    return sorted.filter((v) => v.batteryStatus === filter);
  }, [displayVehicles, filter]);

  const handleJumpStart = async (vehicle: BatteryVehicleDisplay) => {
    try {
      await createInteraction({
        type: 'JUMP_START_REQUEST',
        vehicleId: vehicle.id,
        userId,
        dealershipId,
        notes: `Jump start requested for ${vehicle.stockNumber} (${vehicle.voltage.toFixed(1)}V)`,
        metadata: {
          stockNumber: vehicle.stockNumber,
          voltage: vehicle.voltage,
          batteryPercent: vehicle.batteryPercent,
        },
      });
      toast({
        type: 'warning',
        title: `Jump start requested for ${vehicle.stockNumber}`,
        description: 'A porter will be notified to jump start this vehicle.',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to request jump start',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    }
  };

  // Loading state
  if (loading) return <BatterySkeleton />;

  // Error state
  if (error) return <BatteryError message={error.message} />;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Battery Health</h1>
        <Badge variant="default" size="sm">
          {batteryReports.length} tracked
        </Badge>
      </div>

      {/* Summary cards (also serve as filters) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="All Vehicles"
          count={batteryReports.length}
          icon={Battery}
          color="text-[var(--rally-gold)]"
          bgColor="bg-[var(--rally-gold-muted)]"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <SummaryCard
          label="Healthy"
          count={healthyCount}
          icon={CheckCircle2}
          color="text-[var(--status-success)]"
          bgColor="bg-[var(--status-success)]/15"
          active={filter === 'healthy'}
          onClick={() => setFilter('healthy')}
        />
        <SummaryCard
          label="Warning"
          count={warningCount}
          icon={AlertTriangle}
          color="text-[var(--status-warning)]"
          bgColor="bg-[var(--status-warning)]/15"
          active={filter === 'warning'}
          onClick={() => setFilter('warning')}
        />
        <SummaryCard
          label="Critical"
          count={criticalCount}
          icon={BatteryLow}
          color="text-[var(--status-error)]"
          bgColor="bg-[var(--status-error)]/15"
          active={filter === 'critical'}
          onClick={() => setFilter('critical')}
        />
      </div>

      {/* Vehicle cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filteredVehicles.map((vehicle) => (
          <BatteryCard
            key={vehicle.id}
            vehicle={vehicle}
            onJumpStart={handleJumpStart}
          />
        ))}
      </div>

      {filteredVehicles.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Battery className="h-8 w-8 text-[var(--text-tertiary)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--text-secondary)]">
              No vehicles in this category
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
