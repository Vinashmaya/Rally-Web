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
import type { VehicleActivity } from '@rally/ui';
import {
  Activity,
  Search,
  Radio,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemActivity {
  id: string;
  vehicleId: string;
  stockNumber: string;
  yearMakeModel: string;
  state: VehicleActivity;
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

const TENANT_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Tenants' },
  { value: 'gallatin-cdjr', label: 'Gallatin CDJR' },
  { value: 'music-city-toyota', label: 'Music City Toyota' },
  { value: 'franklin-chevrolet', label: 'Franklin Chevrolet' },
  { value: 'hendersonville-ford', label: 'Hendersonville Ford' },
] as const;

const TENANT_COLORS: Record<string, string> = {
  'gallatin-cdjr': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'music-city-toyota': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'franklin-chevrolet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'hendersonville-ford': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
} as const;

// ---------------------------------------------------------------------------
// Mock Data — 20 activities across 4 tenants
// ---------------------------------------------------------------------------

const now = Date.now();
const HOUR = 1000 * 60 * 60;
const MINUTE = 1000 * 60;

const MOCK_ACTIVITIES: SystemActivity[] = [
  // Active - happening right now
  { id: 'a-001', vehicleId: 'v-002', stockNumber: 'G2402', yearMakeModel: '2024 Dodge Charger', state: 'TEST_DRIVE', isActive: true, startedAt: new Date(now - 15 * MINUTE), startedByUserId: 'u-004', startedByName: 'Jessica Turner', customerName: 'Mike Robinson', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },
  { id: 'a-002', vehicleId: 'v-006', stockNumber: 'G2406', yearMakeModel: '2024 Jeep Wrangler', state: 'SHOWING', isActive: true, startedAt: new Date(now - 8 * MINUTE), startedByUserId: 'u-003', startedByName: 'Marcus Williams', customerName: 'Sarah & Tom Baker', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },
  { id: 'a-003', vehicleId: 'v-009', stockNumber: 'MC3003', yearMakeModel: '2025 Toyota Prius', state: 'TEST_DRIVE', isActive: true, startedAt: new Date(now - 22 * MINUTE), startedByUserId: 'u-009', startedByName: 'Tyler Brooks', customerName: 'Jennifer Lopez', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', dealershipId: 'music-city-toyota' },
  { id: 'a-004', vehicleId: 'v-012', stockNumber: 'MC3006', yearMakeModel: '2025 Toyota 4Runner', state: 'SHOWING', isActive: true, startedAt: new Date(now - 5 * MINUTE), startedByUserId: 'u-008', startedByName: 'Angela Rivera', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', dealershipId: 'music-city-toyota' },
  { id: 'a-005', vehicleId: 'v-014', stockNumber: 'FC5502', yearMakeModel: '2025 Chevrolet Silverado', state: 'TEST_DRIVE', isActive: true, startedAt: new Date(now - 35 * MINUTE), startedByUserId: 'u-013', startedByName: 'Nathan Park', customerName: 'Dave Wilson', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', dealershipId: 'franklin-chevrolet' },
  { id: 'a-006', vehicleId: 'v-004', stockNumber: 'G2404', yearMakeModel: '2024 Ram 2500', state: 'OFF_LOT', isActive: true, startedAt: new Date(now - 2 * HOUR), startedByUserId: 'u-005', startedByName: 'Derek Coleman', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },
  { id: 'a-007', vehicleId: 'v-020', stockNumber: 'HF7702', yearMakeModel: '2025 Ford Explorer', state: 'TEST_DRIVE', isActive: true, startedAt: new Date(now - 12 * MINUTE), startedByUserId: 'u-017', startedByName: 'Chris Nguyen', customerName: 'Emily Chen', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', dealershipId: 'hendersonville-ford' },

  // Today — completed
  { id: 'a-008', vehicleId: 'v-001', stockNumber: 'G2401', yearMakeModel: '2024 Jeep Grand Cherokee', state: 'TEST_DRIVE', isActive: false, startedAt: new Date(now - 3 * HOUR), endedAt: new Date(now - 2.5 * HOUR), startedByUserId: 'u-004', startedByName: 'Jessica Turner', customerName: 'Paul Martinez', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },
  { id: 'a-009', vehicleId: 'v-007', stockNumber: 'MC3001', yearMakeModel: '2025 Toyota Camry', state: 'SHOWING', isActive: false, startedAt: new Date(now - 4 * HOUR), endedAt: new Date(now - 3.5 * HOUR), startedByUserId: 'u-009', startedByName: 'Tyler Brooks', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', dealershipId: 'music-city-toyota' },
  { id: 'a-010', vehicleId: 'v-022', stockNumber: 'HF7704', yearMakeModel: '2025 Ford Expedition', state: 'SHOWING', isActive: false, startedAt: new Date(now - 5 * HOUR), endedAt: new Date(now - 4.5 * HOUR), startedByUserId: 'u-016', startedByName: 'Amanda Cruz', customerName: 'Robert & Lisa Young', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', dealershipId: 'hendersonville-ford' },
  { id: 'a-011', vehicleId: 'v-016', stockNumber: 'FC5504', yearMakeModel: '2025 Chevrolet Tahoe', state: 'OFF_LOT', isActive: false, startedAt: new Date(now - 6 * HOUR), endedAt: new Date(now - 4 * HOUR), startedByUserId: 'u-012', startedByName: 'Megan Foster', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', dealershipId: 'franklin-chevrolet' },
  { id: 'a-012', vehicleId: 'v-003', stockNumber: 'G2403', yearMakeModel: '2024 Ram 1500', state: 'FUELING', isActive: false, startedAt: new Date(now - 7 * HOUR), endedAt: new Date(now - 6.75 * HOUR), startedByUserId: 'u-005', startedByName: 'Derek Coleman', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },

  // Yesterday
  { id: 'a-013', vehicleId: 'v-019', stockNumber: 'HF7701', yearMakeModel: '2025 Ford F-150', state: 'TEST_DRIVE', isActive: false, startedAt: new Date(now - 26 * HOUR), endedAt: new Date(now - 25.5 * HOUR), startedByUserId: 'u-017', startedByName: 'Chris Nguyen', customerName: 'James Walker', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', dealershipId: 'hendersonville-ford' },
  { id: 'a-014', vehicleId: 'v-013', stockNumber: 'FC5501', yearMakeModel: '2025 Chevrolet Corvette', state: 'SHOWING', isActive: false, startedAt: new Date(now - 28 * HOUR), endedAt: new Date(now - 27 * HOUR), startedByUserId: 'u-012', startedByName: 'Megan Foster', customerName: 'Kevin Thomas', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', dealershipId: 'franklin-chevrolet' },
  { id: 'a-015', vehicleId: 'v-010', stockNumber: 'MC3004', yearMakeModel: '2025 Toyota Tundra', state: 'TEST_DRIVE', isActive: false, startedAt: new Date(now - 30 * HOUR), endedAt: new Date(now - 29.5 * HOUR), startedByUserId: 'u-008', startedByName: 'Angela Rivera', customerName: 'Mark Anderson', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', dealershipId: 'music-city-toyota' },
  { id: 'a-016', vehicleId: 'v-023', stockNumber: 'HF7705', yearMakeModel: '2025 Ford Mustang', state: 'OFF_LOT', isActive: false, startedAt: new Date(now - 32 * HOUR), endedAt: new Date(now - 28 * HOUR), startedByUserId: 'u-018', startedByName: 'Olivia Grant', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', dealershipId: 'hendersonville-ford' },

  // Earlier this week
  { id: 'a-017', vehicleId: 'v-005', stockNumber: 'G2405', yearMakeModel: '2024 Chrysler Pacifica', state: 'AVAILABLE', isActive: false, startedAt: new Date(now - 72 * HOUR), startedByUserId: 'u-003', startedByName: 'Marcus Williams', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', dealershipId: 'gallatin-cdjr' },
  { id: 'a-018', vehicleId: 'v-011', stockNumber: 'MC3005', yearMakeModel: '2025 Toyota Corolla', state: 'AVAILABLE', isActive: false, startedAt: new Date(now - 96 * HOUR), startedByUserId: 'u-007', startedByName: 'James Patel', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota', dealershipId: 'music-city-toyota' },
  { id: 'a-019', vehicleId: 'v-015', stockNumber: 'FC5503', yearMakeModel: '2025 Chevrolet Camaro', state: 'TEST_DRIVE', isActive: false, startedAt: new Date(now - 100 * HOUR), endedAt: new Date(now - 99.5 * HOUR), startedByUserId: 'u-013', startedByName: 'Nathan Park', customerName: 'Brian Davis', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet', dealershipId: 'franklin-chevrolet' },
  { id: 'a-020', vehicleId: 'v-021', stockNumber: 'HF7703', yearMakeModel: '2025 Ford Bronco Sport', state: 'FUELING', isActive: false, startedAt: new Date(now - 120 * HOUR), endedAt: new Date(now - 119.75 * HOUR), startedByUserId: 'u-018', startedByName: 'Olivia Grant', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford', dealershipId: 'hendersonville-ford' },
] as const;

// ---------------------------------------------------------------------------
// Helpers — date grouping
// ---------------------------------------------------------------------------

type DateGroup = 'Active Now' | 'Today' | 'Yesterday' | 'Earlier This Week' | 'Older';

function getDateGroup(activity: SystemActivity): DateGroup {
  if (activity.isActive) return 'Active Now';

  const timestamp = activity.endedAt ?? activity.startedAt;
  const diffMs = now - timestamp.getTime();
  const diffHours = diffMs / HOUR;

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
      {/* Tenant badge — top right corner */}
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
        className="rounded-[var(--radius-rally-lg)] border border-[var(--surface-border)] pr-36"
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
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real Firestore collectionGroup('activities') snapshot listener
  const activities = MOCK_ACTIVITIES as unknown as SystemActivity[];

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
    return TENANT_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? activities.length
          : activities.filter((a) => a.tenantSlug === opt.value).length,
    }));
  }, [activities]);

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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-[var(--rally-gold)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
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

      <p className="text-sm text-[var(--text-secondary)]">
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
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {group}
                </h2>
                {group === 'Active Now' && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-[var(--status-success)] animate-rally-pulse" />
                    <span className="text-xs text-[var(--status-success)]">Live</span>
                  </span>
                )}
                <div className="flex-1 border-t border-[var(--surface-border)]" />
                <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
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
