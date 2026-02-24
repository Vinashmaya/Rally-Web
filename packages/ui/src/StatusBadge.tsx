import { forwardRef, type HTMLAttributes } from 'react';
import { Badge, type BadgeProps } from './Badge';
import { cn } from './utils';

/**
 * Vehicle pipeline statuses and their visual mappings.
 */
const VEHICLE_STATUS_MAP = {
  incoming: { label: 'Incoming', classes: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  intake: { label: 'Intake', classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  prep: { label: 'Prep', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  frontline: { label: 'Frontline', classes: 'bg-status-success/15 text-status-success border-status-success/30' },
  service: { label: 'Service', classes: 'bg-status-error/15 text-status-error border-status-error/30' },
  sold: { label: 'Sold', classes: 'bg-status-info/15 text-status-info border-status-info/30' },
  delivery: { label: 'Delivery', classes: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  offsite: { label: 'Offsite', classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  archived: { label: 'Archived', classes: 'bg-surface-overlay text-text-secondary border-surface-border' },
} as const;

export type VehicleStatus = keyof typeof VEHICLE_STATUS_MAP;

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  status: VehicleStatus;
  size?: BadgeProps['size'];
}

/**
 * StatusBadge — Vehicle pipeline status badge.
 * Maps VehicleStatus to the correct color and label automatically.
 */
const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, size, ...props }, ref) => {
    const config = VEHICLE_STATUS_MAP[status];

    return (
      <Badge
        ref={ref}
        size={size}
        className={cn(config.classes, className)}
        {...props}
      >
        {config.label}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, VEHICLE_STATUS_MAP };
