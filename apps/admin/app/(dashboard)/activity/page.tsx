'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  Badge,
  Input,
  Skeleton,
  EmptyState,
  FilterBar,
  ActivityFeedItem,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { VehicleActivity as VehicleActivityUIType } from '@rally/ui';
import { useAllActivities } from '@rally/firebase';
import type { VehicleActivity } from '@rally/firebase';
import {
  Activity,
  Search,
  Radio,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemActivity {
  id: string;
  vehicleId: string;
  stockNumber: string;
  yearMakeModel: string;
  state: VehicleActivityUIType;
  isActive: boolean;
  startedAt: Date;
  endedAt?: Date;
  startedByUserId: string;
  startedByName: string;
  startedByAvatarUrl?: string;
  customerName?: string;
  tenantName: string;
  tenantSlug: string;
  dealershipId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVITY_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'TEST_DRIVE', label: 'Test Drive' },
  { value: 'SHOWING', label: 'Showing' },
  { value: 'OFF_LOT', label: 'Off Lot' },
  { value: 'FUELING', label: 'Fueling' },
  { value: 'AVAILABLE', label: 'Available' },
] as const;

const TENANT_COLORS: Record<string, string> = {
  'gallatin-cdjr': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'music-city-toyota': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'franklin-chevrolet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'hendersonville-ford': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
} as const;

// ---------------------------------------------------------------------------
// Helper: map VehicleActivity → SystemActivity
// ---------------------------------------------------------------------------

function mapFirestoreActivity(activity: VehicleActivity): SystemActivity {
  const startedAt = activity.startedAt instanceof Date
    ? activity.startedAt
    : new Date(activity.startedAt);
  const endedAt = activity.endedAt
    ? (activity.endedAt instanceof Date ? activity.endedAt : new Date(activity.endedAt))
    : undefined;

  return {
    id: activity.id ?? `${activity.vin}-${startedAt.getTime()}`,
    vehicleId: activity.vin,
    stockNumber: activity.stockNumber,
    yearMakeModel: activity.yearMakeModel,
    state: activity.state as VehicleActivityUIType,
    isActive: activity.isActive,
    startedAt,
    endedAt,
    startedByUserId: activity.startedByUserId,
    startedByName: activity.startedByName,
    tenantName: activity.dealershipId,
    tenantSlug: activity.dealershipId,
    dealershipId: activity.dealershipId,
  };
}

// ---------------------------------------------------------------------------
// Helpers -- date grouping
// ---------------------------------------------------------------------------

type DateGroup = 'Active Now' | 'Today' | 'Yesterday' | 'Earlier This Week' | 'Older';

function getDateGroup(activity: SystemActivity): DateGroup {
  if (activity.isActive) return 'Active Now';

  const timestamp = activity.endedAt ?? activity.startedAt;
  const now = Date.now();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  if (timestamp >= todayStart) return 'Today';
  if (timestamp >= yesterdayStart) return 'Yesterday';
  if (timestamp >= weekStart) return 'Earlier This Week';
  return 'Older';
}

const DATE_GROUP_ORDER: Record<DateGroup, number> = {
  'Active Now': 0,
  'Today': 1,
  'Yesterday': 2,
  'Earlier This Week': 3,
  'Older': 4,
} as const;

// ---------------------------------------------------------------------------
// Activity Card Component
// ---------------------------------------------------------------------------

function ActivityCard({ activity }: { activity: SystemActivity }) {
  const tenantColorClass = TENANT_COLORS[activity.tenantSlug] ?? 'bg-surface-overlay text-text-secondary border-surface-border';

  return (
    <div className="relative">
      {/* Tenant badge -- top right corner */}
      <div className="absolute top-3 right-3 z-10">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${tenantColorClass}`}>
          {activity.tenantName}
        </span>
      </div>

      <ActivityFeedItem
        userName={activity.startedByName}
        userAvatarUrl={activity.startedByAvatarUrl}
        vehicleStockNumber={activity.stockNumber}
        vehicleYMM={activity.yearMakeModel}
        activity={activity.state}
        startedAt={activity.startedAt}
        endedAt={activity.endedAt}
        customerName={activity.customerName}
        className="rounded-rally-lg border border-surface-border pr-36"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start gap-3">
            <Skeleton variant="circle" className="h-8 w-8 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" className="h-4 w-3/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
            </div>
            <Skeleton variant="text" className="h-3 w-16 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SystemActivityPage() {
  const [activityFilter, setActivityFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Real Firestore data via useAllActivities for cross-tenant activities
  const { allActivities: rawActivities, loading, error } = useAllActivities({ limitCount: 50 });

  // Map VehicleActivity[] → SystemActivity[]
  const activities: SystemActivity[] = useMemo(
    () => rawActivities.map(mapFirestoreActivity),
    [rawActivities],
  );

  // Derive tenant filter options from actual data
  const tenantFilterOptions: FilterOption[] = useMemo(() => {
    const tenantSlugs = new Set(activities.map((a) => a.tenantSlug));
    const tenantOptions: FilterOption[] = [
      { value: 'all', label: 'All Tenants' },
    ];
    for (const slug of tenantSlugs) {
      tenantOptions.push({ value: slug, label: slug });
    }
    return tenantOptions;
  }, [activities]);

  // Compute filter counts
  const activityFilterWithCounts: FilterOption[] = useMemo(() => {
    return ACTIVITY_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? activities.length
          : activities.filter((a) => a.state === opt.value).length,
    }));
  }, [activities]);

  const tenantFilterWithCounts: FilterOption[] = useMemo(() => {
    return tenantFilterOptions.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? activities.length
          : activities.filter((a) => a.tenantSlug === opt.value).length,
    }));
  }, [activities, tenantFilterOptions]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];

    // Activity type filter
    if (activityFilter !== 'all') {
      result = result.filter((a) => a.state === activityFilter);
    }

    // Tenant filter
    if (tenantFilter !== 'all') {
      result = result.filter((a) => a.tenantSlug === tenantFilter);
    }

    // Search
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.stockNumber.toLowerCase().includes(query) ||
          a.yearMakeModel.toLowerCase().includes(query) ||
          a.startedByName.toLowerCase().includes(query) ||
          (a.customerName?.toLowerCase().includes(query) ?? false),
      );
    }

    // Sort: active first, then by most recent
    result.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return b.startedAt.getTime() - a.startedAt.getTime();
    });

    return result;
  }, [activities, activityFilter, tenantFilter, search]);

  // Group by date
  const groupedActivities = useMemo(() => {
    const groups = new Map<DateGroup, SystemActivity[]>();

    for (const activity of filteredActivities) {
      const group = getDateGroup(activity);
      const existing = groups.get(group) ?? [];
      existing.push(activity);
      groups.set(group, existing);
    }

    // Sort groups by order
    const sortedEntries = [...groups.entries()].sort(
      ([a], [b]) => (DATE_GROUP_ORDER[a] ?? 99) - (DATE_GROUP_ORDER[b] ?? 99),
    );

    return sortedEntries;
  }, [filteredActivities]);

  // Count active activities
  const activeCount = useMemo(
    () => filteredActivities.filter((a) => a.isActive).length,
    [filteredActivities],
  );

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-status-error shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Failed to load activity feed</p>
              <p className="text-xs text-text-tertiary mt-1">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-rally-gold" />
          <h1 className="text-2xl font-bold text-text-primary">
            System Activity
          </h1>
          <Badge variant="default" size="md">
            {filteredActivities.length}
          </Badge>
          {activeCount > 0 && (
            <Badge variant="success" size="sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-rally-pulse mr-1" />
              {activeCount} active
            </Badge>
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary">
        Real-time activity feed across all tenants. Monitor test drives, showings, and vehicle movements system-wide.
      </p>

      {/* Activity Type Filter */}
      <div className="space-y-3">
        <FilterBar
          options={activityFilterWithCounts}
          selected={activityFilter}
          onSelect={setActivityFilter}
        />

        {/* Tenant Filter */}
        <FilterBar
          options={tenantFilterWithCounts}
          selected={tenantFilter}
          onSelect={setTenantFilter}
        />
      </div>

      {/* Search */}
      <Input
        placeholder="Search by stock #, vehicle, user, or customer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        startIcon={<Search className="h-4 w-4" />}
      />

      {/* Loading State */}
      {loading && <ActivityFeedSkeleton />}

      {/* Empty State */}
      {!loading && filteredActivities.length === 0 && (
        <EmptyState
          icon={Radio}
          title="No activity found"
          description={
            search
              ? `No activity matches "${search}". Try a different search term.`
              : 'No activity matches the current filters. Try broadening your selection.'
          }
        />
      )}

      {/* Grouped Activity Feed */}
      {!loading && groupedActivities.length > 0 && (
        <div className="space-y-6">
          {groupedActivities.map(([group, items]) => (
            <div key={group}>
              {/* Date Group Header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {group}
                </h2>
                {group === 'Active Now' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-status-success animate-rally-pulse" />
                    <span className="text-xs text-status-success">Live</span>
                  </span>
                )}
                <div className="flex-1 border-t border-surface-border" />
                <span className="text-xs text-text-tertiary tabular-nums">
                  {items.length} {items.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {/* Activity Cards */}
              <div className="space-y-2">
                {items.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
