import { forwardRef, type HTMLAttributes } from 'react';
import { Badge, type BadgeProps } from './Badge';
import { cn } from './utils';

/**
 * Vehicle activity states.
 * Active states (anything except AVAILABLE) get a pulsing dot.
 */
const ACTIVITY_MAP = {
  AVAILABLE: { label: 'Available', dotClass: 'bg-status-success', badgeClass: 'bg-status-success/15 text-status-success border-status-success/30', active: false },
  SHOWING: { label: 'Showing', dotClass: 'bg-activity-showVideo', badgeClass: 'bg-activity-showVideo/15 text-activity-showVideo border-activity-showVideo/30', active: true },
  TEST_DRIVE: { label: 'Test Drive', dotClass: 'bg-activity-testDrive', badgeClass: 'bg-activity-testDrive/15 text-activity-testDrive border-activity-testDrive/30', active: true },
  OFF_LOT: { label: 'Off Lot', dotClass: 'bg-activity-offLot', badgeClass: 'bg-activity-offLot/15 text-activity-offLot border-activity-offLot/30', active: true },
  FUELING: { label: 'Fueling', dotClass: 'bg-activity-fueling', badgeClass: 'bg-activity-fueling/15 text-activity-fueling border-activity-fueling/30', active: true },
  CHARGING_RUNNING: { label: 'Charging', dotClass: 'bg-activity-runCharge', badgeClass: 'bg-activity-runCharge/15 text-activity-runCharge border-activity-runCharge/30', active: true },
  SOLD: { label: 'Sold', dotClass: 'bg-activity-sold', badgeClass: 'bg-activity-sold/15 text-activity-sold border-activity-sold/30', active: true },
} as const;

export type VehicleActivity = keyof typeof ACTIVITY_MAP;

export interface ActivityBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  activity: VehicleActivity;
  size?: BadgeProps['size'];
}

/**
 * ActivityBadge — Real-time vehicle activity indicator.
 * Active states get a pulsing dot animation.
 */
const ActivityBadge = forwardRef<HTMLSpanElement, ActivityBadgeProps>(
  ({ className, activity, size, ...props }, ref) => {
    const config = ACTIVITY_MAP[activity];

    return (
      <Badge
        ref={ref}
        size={size}
        className={cn(config.badgeClass, 'gap-1.5', className)}
        {...props}
      >
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            config.dotClass,
            config.active && 'animate-rally-pulse'
          )}
          aria-hidden="true"
        />
        {config.label}
      </Badge>
    );
  }
);

ActivityBadge.displayName = 'ActivityBadge';

export { ActivityBadge, ACTIVITY_MAP };
