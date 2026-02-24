'use client';

import Image from 'next/image';
import { Camera, Clock } from 'lucide-react';
import { Card, StatusBadge, Skeleton } from '@rally/ui';
import type { Vehicle, VehicleStatus } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VehicleGridProps {
  vehicles: Vehicle[];
  loading: boolean;
  onVehicleClick: (vin: string) => void;
}

// ---------------------------------------------------------------------------
// Inline Vehicle Card (no dependency on @rally/ui VehicleCard)
// ---------------------------------------------------------------------------

function VehicleGridCard({
  vehicle,
  onClick,
}: {
  vehicle: Vehicle;
  onClick: () => void;
}) {
  const ymm = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const daysOnLot = vehicle.daysOnLot ?? 0;

  // Days-on-lot severity: green < 45, yellow 45-89, red 90+
  const dolColor =
    daysOnLot >= 90
      ? 'text-status-error'
      : daysOnLot >= 45
        ? 'text-status-warning'
        : 'text-text-tertiary';

  return (
    <Card
      variant="interactive"
      className="overflow-hidden"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Photo area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-overlay">
        {vehicle.primaryPhotoUrl ? (
          <Image
            src={vehicle.primaryPhotoUrl}
            alt={`${ymm} - Stock ${vehicle.stockNumber}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Camera className="h-8 w-8 text-text-tertiary" strokeWidth={1.5} />
          </div>
        )}

        {/* Status badge overlay (top-left) */}
        <div className="absolute left-2 top-2">
          <StatusBadge status={vehicle.status as VehicleStatus} size="sm" />
        </div>

        {/* Condition badge overlay (top-right) */}
        {vehicle.condition && (
          <div className="absolute right-2 top-2">
            <span className="inline-flex items-center rounded-full bg-surface-base/80 px-2 py-0.5 text-[10px] font-medium text-text-secondary backdrop-blur-sm">
              {vehicle.condition === 'certified' ? 'CPO' : vehicle.condition.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-1.5 p-3">
        {/* Stock number — the hero element */}
        <span className="text-lg font-extrabold font-mono text-rally-gold leading-none tracking-tight">
          {vehicle.stockNumber}
        </span>

        {/* Year Make Model */}
        <p className="text-sm font-medium text-text-primary truncate">{ymm}</p>

        {/* Trim line (if available) */}
        {vehicle.trim && (
          <p className="text-xs text-text-secondary truncate">{vehicle.trim}</p>
        )}

        {/* Bottom row: price + days on lot */}
        <div className="mt-1 flex items-center justify-between">
          {vehicle.internetPrice != null ? (
            <span className="text-sm font-semibold text-text-primary">
              ${vehicle.internetPrice.toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-text-disabled">No price</span>
          )}

          <span className={`inline-flex items-center gap-1 text-xs ${dolColor}`}>
            <Clock className="h-3 w-3" />
            {daysOnLot}d
          </span>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Cards for Loading State
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <Skeleton variant="card" className="aspect-[16/10] h-auto w-full" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-40" />
        <div className="mt-1 flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Vehicle Grid
// ---------------------------------------------------------------------------

export function VehicleGrid({ vehicles, loading, onVehicleClick }: VehicleGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <VehicleGridCard
          key={vehicle.vin}
          vehicle={vehicle}
          onClick={() => onVehicleClick(vehicle.vin)}
        />
      ))}
    </div>
  );
}
