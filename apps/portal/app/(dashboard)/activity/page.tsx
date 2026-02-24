'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Skeleton,
  EmptyState,
  FilterBar,
  ActivityFeedItem,
  ActivityBadge,
  Avatar,
  Badge,
  RelativeTime,
  type FilterOption,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import {
  useActivities,
  ACTIVITY_DISPLAY_NAME,
  type VehicleActivity,
  type VehicleActivityState,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'SHOWING', label: 'Show / Video' },
  { value: 'TEST_DRIVE', label: 'Test Drive' },
  { value: 'OFF_LOT', label: 'Off Lot' },
  { value: 'FUELING', label: 'Fueling' },
  { value: 'CHARGING_RUNNING', label: 'Charging' },
  { value: 'SOLD', label: 'Sold' },
] as const;

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton variant="circle" className="h-8 w-8" />
          <div className="flex-1 flex flex-col gap-1">
            <Skeleton variant="text" className="h-4 w-3/4" />
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
          <Skeleton variant="text" className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Now section — pulsing indicator for real-time activities
// ---------------------------------------------------------------------------

interface ActiveNowProps {
  activities: VehicleActivity[];
  onVehicleClick: (vin: string) => void;
}

function ActiveNowSection({ activities, onVehicleClick }: ActiveNowProps) {
  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-success opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-success" />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">
            Active Now
          </h2>
          <Badge variant="gold" size="sm">
            {activities.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {activities.map((activity) => (
          <div
            key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
            className="flex items-center gap-3 rounded-rally bg-surface-overlay px-3 py-2"
          >
            <Avatar name={activity.startedByName} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">
                  {activity.startedByName}
                </span>
                <ActivityBadge activity={activity.state} size="sm" />
              </div>
              <button
                type="button"
                onClick={() => onVehicleClick(activity.vin)}
                className="font-mono text-xs font-medium text-rally-gold hover:text-rally-goldLight transition-colors cursor-pointer"
              >
                {activity.stockNumber}
              </button>
              <span className="text-xs text-text-tertiary">
                {' '}&mdash; {activity.yearMakeModel}
              </span>
            </div>
            <RelativeTime date={activity.startedAt} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Date grouping helpers
// ---------------------------------------------------------------------------

function getDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (activityDate.getTime() === today.getTime()) return 'Today';
  if (activityDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const diffDays = Math.floor((today.getTime() - activityDate.getTime()) / 86400000);
  if (diffDays < 7) return 'This Week';

  return activityDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: activityDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function groupActivitiesByDate(
  activities: VehicleActivity[],
): Array<{ label: string; activities: VehicleActivity[] }> {
  const groups: Map<string, VehicleActivity[]> = new Map();

  for (const activity of activities) {
    const label = getDateGroup(activity.startedAt);
    const existing = groups.get(label);
    if (existing) {
      existing.push(activity);
    } else {
      groups.set(label, [activity]);
    }
  }

  return Array.from(groups.entries()).map(([label, acts]) => ({
    label,
    activities: acts,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalActivityPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const [filter, setFilter] = useState('all');

  const dealershipId = activeStore?.id ?? '';
  const { activities, loading, error } = useActivities({
    dealershipId,
    limitCount: 100,
  });

  // Split into active vs all
  const activeActivities = useMemo(
    () => activities.filter((a) => a.isActive && a.state !== 'AVAILABLE'),
    [activities],
  );

  // Apply filter
  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((a) => a.state === filter);
  }, [activities, filter]);

  // Group by date
  const groupedActivities = useMemo(
    () => groupActivitiesByDate(filteredActivities),
    [filteredActivities],
  );

  // Filter counts for the filter bar
  const filterOptionsWithCounts = useMemo((): FilterOption[] => {
    return ACTIVITY_FILTER_OPTIONS.map((opt) => {
      if (opt.value === 'all') {
        return { ...opt, count: activities.length };
      }
      return {
        ...opt,
        count: activities.filter((a) => a.state === opt.value).length,
      };
    });
  }, [activities]);

  const handleVehicleClick = (vin: string) => {
    router.push(`/inventory/${vin}`);
  };

  // Waiting for tenant context
  if (!activeStore) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" className="h-8 w-48" />
        <ActivitySkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Activity</h1>
          {!loading && (
            <Badge variant="default" size="sm">
              {activities.length} events
            </Badge>
          )}
        </div>
      </div>

      {/* Active Now */}
      {!loading && (
        <ActiveNowSection
          activities={activeActivities}
          onVehicleClick={handleVehicleClick}
        />
      )}

      {/* Filter tabs */}
      <FilterBar
        options={filterOptionsWithCounts}
        selected={filter}
        onSelect={setFilter}
      />

      {/* Feed */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <ActivitySkeleton />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-status-error">
                Failed to load activities
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description={
            filter === 'all'
              ? 'Vehicle interactions will appear here in real-time as your team works the lot.'
              : `No ${ACTIVITY_DISPLAY_NAME[filter as VehicleActivityState] ?? filter} activities found.`
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groupedActivities.map((group) => (
            <div key={group.label}>
              {/* Date group header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-surface-border" />
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="flex flex-col divide-y divide-surface-border">
                    {group.activities.map((activity) => (
                      <ActivityFeedItem
                        key={activity.id ?? `${activity.vin}-${activity.startedAt.getTime()}`}
                        userName={activity.startedByName}
                        vehicleStockNumber={activity.stockNumber}
                        vehicleYMM={activity.yearMakeModel}
                        activity={activity.state}
                        startedAt={activity.startedAt}
                        endedAt={activity.endedAt}
                        onVehicleClick={() => handleVehicleClick(activity.vin)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
