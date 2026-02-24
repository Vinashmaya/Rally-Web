'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { Camera, Clock, Lock } from 'lucide-react';
import { cn } from './utils';
import { StockHero } from './StockHero';
import { StatusBadge, type VehicleStatus } from './StatusBadge';
import { ActivityBadge, type VehicleActivity } from './ActivityBadge';
import { Badge } from './Badge';

export interface VehicleCardProps extends HTMLAttributes<HTMLDivElement> {
  stockNumber: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  status: VehicleStatus;
  activity?: VehicleActivity;
  exteriorColor?: string;
  internetPrice?: number;
  primaryPhotoUrl?: string;
  daysOnLot?: number;
  holdInfo?: { userName: string };
  onPress?: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents);
}

function getDaysOnLotVariant(days: number): 'warning' | 'error' | null {
  if (days > 60) return 'error';
  if (days > 30) return 'warning';
  return null;
}

/**
 * VehicleCard — the primary inventory card.
 *
 * Photo, stock number (StockHero compact), YMM, price, badges.
 * The single most-used card in the entire platform.
 * Designed for speed: find the car in 3 seconds on hot asphalt.
 */
const VehicleCard = forwardRef<HTMLDivElement, VehicleCardProps>(
  (
    {
      className,
      stockNumber,
      vin,
      year,
      make,
      model,
      trim,
      status,
      activity,
      exteriorColor,
      internetPrice,
      primaryPhotoUrl,
      daysOnLot,
      holdInfo,
      onPress,
      ...props
    },
    ref
  ) => {
    const ymm = `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`;
    const daysVariant = daysOnLot != null ? getDaysOnLotVariant(daysOnLot) : null;

    return (
      <div
        ref={ref}
        role={onPress ? 'button' : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={(e) => {
          if (onPress && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPress();
          }
        }}
        className={cn(
          'group relative rounded-rally-lg overflow-hidden',
          'bg-surface-raised border border-surface-border',
          'transition-all duration-150',
          onPress && [
            'cursor-pointer',
            'hover:border-rally-gold/50 hover:shadow-rally',
            'active:scale-[0.98]',
          ],
          className
        )}
        {...props}
      >
        {/* Photo area */}
        <div className="relative aspect-video bg-surface-overlay overflow-hidden">
          {primaryPhotoUrl ? (
            <img
              src={primaryPhotoUrl}
              alt={ymm}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Camera className="h-8 w-8 text-text-disabled" strokeWidth={1.5} />
            </div>
          )}

          {/* Hold indicator overlay */}
          {holdInfo && (
            <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-status-warning/90 px-3 py-1.5">
              <Lock className="h-3 w-3 text-text-inverse" />
              <span className="text-xs font-medium text-text-inverse truncate">
                Hold &mdash; {holdInfo.userName}
              </span>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex flex-col gap-2 p-4">
          {/* Stock number — compact StockHero */}
          <StockHero
            stockNumber={stockNumber}
            className="text-xl"
          />

          {/* YMM line */}
          <p className="text-sm text-text-secondary truncate" title={ymm}>
            {ymm}
          </p>

          {/* Price */}
          {internetPrice != null && (
            <p className="text-lg font-semibold text-text-primary tabular-nums">
              {formatPrice(internetPrice)}
            </p>
          )}

          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <StatusBadge status={status} size="sm" />

            {activity && <ActivityBadge activity={activity} size="sm" />}

            {daysOnLot != null && daysVariant && (
              <Badge
                variant={daysVariant}
                size="sm"
              >
                <Clock className="h-3 w-3" />
                {daysOnLot}d
              </Badge>
            )}

            {exteriorColor && (
              <Badge size="sm">
                {exteriorColor}
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }
);

VehicleCard.displayName = 'VehicleCard';

export { VehicleCard };
