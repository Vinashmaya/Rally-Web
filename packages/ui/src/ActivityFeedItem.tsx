'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './utils';
import { Avatar } from './Avatar';
import { RelativeTime } from './RelativeTime';
import { ACTIVITY_MAP, type VehicleActivity } from './ActivityBadge';

export interface ActivityFeedItemProps extends HTMLAttributes<HTMLDivElement> {
  userName: string;
  userAvatarUrl?: string;
  vehicleStockNumber: string;
  vehicleYMM: string;
  activity: VehicleActivity;
  startedAt: Date;
  endedAt?: Date;
  customerName?: string;
  onVehicleClick?: () => void;
  onUserClick?: () => void;
}

/**
 * Border color mapping for activity types.
 * Matches the ActivityBadge dot colors for visual consistency.
 */
const ACTIVITY_BORDER_CLASSES: Record<VehicleActivity, string> = {
  AVAILABLE: 'border-l-status-success',
  SHOWING: 'border-l-activity-showVideo',
  TEST_DRIVE: 'border-l-activity-testDrive',
  OFF_LOT: 'border-l-activity-offLot',
  FUELING: 'border-l-activity-fueling',
  CHARGING_RUNNING: 'border-l-activity-runCharge',
  SOLD: 'border-l-activity-sold',
} as const;

/**
 * ActivityFeedItem — single row in the real-time activity feed.
 *
 * "[userName] started [activity] on [stockNumber] — [YMM]"
 * Activity-colored left border. Clickable stock number (gold, monospace).
 */
const ActivityFeedItem = forwardRef<HTMLDivElement, ActivityFeedItemProps>(
  (
    {
      className,
      userName,
      userAvatarUrl,
      vehicleStockNumber,
      vehicleYMM,
      activity,
      startedAt,
      endedAt,
      customerName,
      onVehicleClick,
      onUserClick,
      ...props
    },
    ref
  ) => {
    const activityConfig = ACTIVITY_MAP[activity];
    const activityLabel = activityConfig.label.toLowerCase();
    const borderClass = ACTIVITY_BORDER_CLASSES[activity];

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 px-4 py-3',
          'border-l-[3px] bg-surface-raised',
          'transition-colors duration-150',
          'hover:bg-surface-overlay',
          borderClass,
          className
        )}
        {...props}
      >
        {/* Avatar */}
        <button
          type="button"
          onClick={onUserClick}
          className={cn(
            'shrink-0 rounded-full',
            onUserClick && 'cursor-pointer hover:ring-2 hover:ring-rally-gold/50 transition-shadow'
          )}
          disabled={!onUserClick}
          tabIndex={onUserClick ? 0 : -1}
        >
          <Avatar
            name={userName}
            src={userAvatarUrl}
            size="sm"
          />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary leading-relaxed">
            <span className="font-medium">{userName}</span>
            <span className="text-text-secondary">
              {' '}
              {endedAt ? 'ended' : 'started'} {activityLabel} on{' '}
            </span>
            <button
              type="button"
              onClick={onVehicleClick}
              className={cn(
                'font-mono font-medium',
                onVehicleClick
                  ? 'text-rally-gold hover:text-rally-goldLight cursor-pointer transition-colors'
                  : 'text-rally-gold'
              )}
              disabled={!onVehicleClick}
              tabIndex={onVehicleClick ? 0 : -1}
            >
              {vehicleStockNumber}
            </button>
            <span className="text-text-tertiary">
              {' '}&mdash; {vehicleYMM}
            </span>
          </p>

          {customerName && (
            <p className="text-xs text-text-tertiary mt-0.5">
              with {customerName}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <RelativeTime date={endedAt ?? startedAt} className="shrink-0 mt-0.5" />
      </div>
    );
  }
);

ActivityFeedItem.displayName = 'ActivityFeedItem';

export { ActivityFeedItem };
