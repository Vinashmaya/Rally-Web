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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatteryFilter = 'all' | 'critical' | 'warning' | 'healthy';

interface BatteryVehicle {
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  batteryPercent: number;
  lastReading: string;
  trackerType: 'Ghost OBD2' | 'Kahu';
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_VEHICLES: BatteryVehicle[] = [
  { stockNumber: 'R1234', year: 2024, make: 'Jeep', model: 'Wrangler', batteryPercent: 92, lastReading: '2 min ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R2345', year: 2023, make: 'Ram', model: '1500', batteryPercent: 85, lastReading: '5 min ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R3456', year: 2024, make: 'Dodge', model: 'Charger', batteryPercent: 78, lastReading: '10 min ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R4567', year: 2023, make: 'Chrysler', model: '300', batteryPercent: 15, lastReading: '3 hrs ago', trackerType: 'Kahu' },
  { stockNumber: 'R5678', year: 2024, make: 'Jeep', model: 'Grand Cherokee', batteryPercent: 3, lastReading: '12 hrs ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R6789', year: 2024, make: 'Ram', model: '2500', batteryPercent: 45, lastReading: '15 min ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R7890', year: 2023, make: 'Dodge', model: 'Durango', batteryPercent: 32, lastReading: '1 hr ago', trackerType: 'Kahu' },
  { stockNumber: 'R8901', year: 2024, make: 'Jeep', model: 'Gladiator', batteryPercent: 67, lastReading: '8 min ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R9012', year: 2023, make: 'Chrysler', model: 'Pacifica', batteryPercent: 8, lastReading: '6 hrs ago', trackerType: 'Ghost OBD2' },
  { stockNumber: 'R0123', year: 2024, make: 'Ram', model: '1500 TRX', batteryPercent: 55, lastReading: '20 min ago', trackerType: 'Kahu' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBatteryLevel(percent: number): 'critical' | 'warning' | 'healthy' {
  if (percent < 20) return 'critical';
  if (percent <= 50) return 'warning';
  return 'healthy';
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
  vehicle: BatteryVehicle;
  onJumpStart: (stockNumber: string) => void;
}

function BatteryCard({ vehicle, onJumpStart }: BatteryCardProps) {
  const level = getBatteryLevel(vehicle.batteryPercent);
  const config = BATTERY_LEVEL_CONFIG[level];
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
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-[var(--text-primary)] mt-1">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)]">
                Last reading: {vehicle.lastReading}
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-disabled)] mt-0.5 block">
              {vehicle.trackerType}
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
        {level === 'critical' && (
          <Button
            variant="danger"
            size="sm"
            className="mt-3 w-full"
            onClick={() => onJumpStart(vehicle.stockNumber)}
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
// Page
// ---------------------------------------------------------------------------

export default function BatteryPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<BatteryFilter>('all');

  const criticalCount = MOCK_VEHICLES.filter((v) => getBatteryLevel(v.batteryPercent) === 'critical').length;
  const warningCount = MOCK_VEHICLES.filter((v) => getBatteryLevel(v.batteryPercent) === 'warning').length;
  const healthyCount = MOCK_VEHICLES.filter((v) => getBatteryLevel(v.batteryPercent) === 'healthy').length;

  const filteredVehicles = useMemo(() => {
    if (filter === 'all') return [...MOCK_VEHICLES].sort((a, b) => a.batteryPercent - b.batteryPercent);
    return MOCK_VEHICLES
      .filter((v) => getBatteryLevel(v.batteryPercent) === filter)
      .sort((a, b) => a.batteryPercent - b.batteryPercent);
  }, [filter]);

  const handleJumpStart = (stockNumber: string) => {
    // TODO: Send jump start request to porter/service team via Firestore
    toast({
      type: 'warning',
      title: `Jump start requested for ${stockNumber}`,
      description: 'A porter will be notified to jump start this vehicle.',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Battery Health</h1>
        <Badge variant="default" size="sm">
          {MOCK_VEHICLES.length} tracked
        </Badge>
      </div>

      {/* Summary cards (also serve as filters) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SummaryCard
          label="All Vehicles"
          count={MOCK_VEHICLES.length}
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
            key={vehicle.stockNumber}
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
