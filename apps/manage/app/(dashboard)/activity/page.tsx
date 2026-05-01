'use client';

// Manage Activity — GM/Principal-tier activity oversight
// Shows aggregates first (KPIs, heatmap, top performers) and the full event feed below.
// Real-time via useActivities snapshot listener scoped by storeId.

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Search, Clock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Skeleton,
  EmptyState,
  FilterBar,
  ActivityBadge,
  Avatar,
  Badge,
  RelativeTime,
  Input,
  DateRangePicker,
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
  { value: 'CHARGING_RUNNING', label: 'Run / Charge' },
  { value: 'SOLD', label: 'Sold' },
] as const;

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const ACTIVITY_STATES_SUMMARY: VehicleActivityState[] = [
  'SHOWING',
  'TEST_DRIVE',
  'OFF_LOT',
  'FUELING',
  'CHARGING_RUNNING',
  'SOLD',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0] ?? '';
}

function isoDateToDate(iso: string): Date {
  // Construct a Date at the start of the local day for the ISO string
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const [y, m, d] = parts;
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

interface HeatmapProps {
  activities: VehicleActivity[];
}

function ActivityHeatmap({ activities }: HeatmapProps) {
  const matrix = useMemo(() => {
    // 7 rows (day-of-week) x 24 cols (hour-of-day)
    const grid: number[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => 0),
    );
    let max = 0;
    for (const a of activities) {
      const dow = a.startedAt.getDay();
      const hour = a.startedAt.getHours();
      const row = grid[dow];
      if (!row) continue;
      const next = (row[hour] ?? 0) + 1;
      row[hour] = next;
      if (next > max) max = next;
    }
    return { grid, max };
  }, [activities]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Activity Heatmap
        </h2>
        <p className="text-xs text-[var(--text-tertiary)]">
          Events by hour of day &times; day of week
        </p>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)] py-6 text-center">
            No activity in the selected window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1 min-w-full">
              {/* Hour header */}
              <div className="flex items-center gap-1 pl-10">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="w-5 text-[9px] text-[var(--text-tertiary)] tabular-nums text-center"
                  >
                    {h % 3 === 0 ? h : ''}
                  </div>
                ))}
              </div>
              {/* Rows */}
              {DAYS_OF_WEEK.map((day, rowIdx) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="w-9 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] text-right pr-1">
                    {day}
                  </span>
                  {HOURS.map((h) => {
                    const count = matrix.grid[rowIdx]?.[h] ?? 0;
                    const intensity = matrix.max > 0 ? count / matrix.max : 0;
                    const opacity = count === 0 ? 0.08 : 0.2 + intensity * 0.8;
                    return (
                      <div
                        key={h}
                        className="h-5 w-5 rounded-sm transition-colors"
                        style={{
                          backgroundColor: `rgba(212, 160, 23, ${opacity})`,
                        }}
                        title={`${day} ${h}:00 — ${count} event${count === 1 ? '' : 's'}`}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-tertiary)]">Less</span>
                {[0.08, 0.3, 0.5, 0.7, 1].map((o) => (
                  <div
                    key={o}
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: `rgba(212, 160, 23, ${o})` }}
                  />
                ))}
                <span className="text-[10px] text-[var(--text-tertiary)]">More</span>
                <span className="ml-3 text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  Peak: {matrix.max} events
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ActivityPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-56" />
      <Skeleton variant="card" className="h-96" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ManageActivityPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const [filter, setFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Default: last 7 days
  const today = useMemo(() => new Date(), []);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return toISODate(d);
  });
  const [endDate, setEndDate] = useState(() => toISODate(today));

  const { activities, loading, error } = useActivities({
    dealershipId,
    limitCount: 500,
  });

  // Date filter
  const dateRangeFiltered = useMemo(() => {
    const startMs = isoDateToDate(startDate).getTime();
    const endMs = endOfDay(isoDateToDate(endDate)).getTime();
    return activities.filter((a) => {
      const ts = a.startedAt.getTime();
      return ts >= startMs && ts <= endMs;
    });
  }, [activities, startDate, endDate]);

  // Type + user + vehicle text filters
  const filtered = useMemo(() => {
    return dateRangeFiltered.filter((a) => {
      if (filter !== 'all' && a.state !== filter) return false;
      if (
        userSearch &&
        !a.startedByName.toLowerCase().includes(userSearch.toLowerCase())
      )
        return false;
      if (
        vehicleSearch &&
        !`${a.stockNumber} ${a.yearMakeModel}`
          .toLowerCase()
          .includes(vehicleSearch.toLowerCase())
      )
        return false;
      return true;
    });
  }, [dateRangeFiltered, filter, userSearch, vehicleSearch]);

  // KPIs
  const totalToday = useMemo(
    () => activities.filter((a) => isSameDay(a.startedAt, today)).length,
    [activities, today],
  );

  const avgDurations = useMemo(() => {
    const sums: Partial<Record<VehicleActivityState, { total: number; count: number }>> = {};
    for (const a of dateRangeFiltered) {
      if (!a.durationSeconds || a.durationSeconds <= 0) continue;
      const bucket = sums[a.state] ?? { total: 0, count: 0 };
      bucket.total += a.durationSeconds;
      bucket.count += 1;
      sums[a.state] = bucket;
    }
    return ACTIVITY_STATES_SUMMARY.map((state) => {
      const b = sums[state];
      const avg = b && b.count > 0 ? b.total / b.count : 0;
      return { state, avg, count: b?.count ?? 0 };
    });
  }, [dateRangeFiltered]);

  const topPerformers = useMemo(() => {
    const byUser = new Map<string, { uid: string; name: string; count: number }>();
    for (const a of dateRangeFiltered) {
      const existing = byUser.get(a.startedByUserId);
      if (existing) {
        existing.count += 1;
      } else {
        byUser.set(a.startedByUserId, {
          uid: a.startedByUserId,
          name: a.startedByName,
          count: 1,
        });
      }
    }
    return Array.from(byUser.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [dateRangeFiltered]);

  const filterOptionsWithCounts = useMemo((): FilterOption[] => {
    return ACTIVITY_FILTER_OPTIONS.map((opt) => {
      if (opt.value === 'all') {
        return { ...opt, count: dateRangeFiltered.length };
      }
      return {
        ...opt,
        count: dateRangeFiltered.filter((a) => a.state === opt.value).length,
      };
    });
  }, [dateRangeFiltered]);

  const handleVehicleClick = (vin: string) => {
    router.push(`/inventory/${vin}`);
  };

  // ---- Empty / waiting state ----
  if (!activeStore) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" className="h-8 w-48" />
        <ActivityPageSkeleton />
      </div>
    );
  }

  if (loading) {
    return <ActivityPageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Activity
          </h1>
          <Badge variant="default" size="sm">
            {filtered.length} events
          </Badge>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Total Today
                </p>
                <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums mt-1">
                  {totalToday}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--rally-gold-muted)] p-2.5 text-[var(--rally-gold)]">
                <Activity className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              Avg Duration by Type
            </h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1.5">
              {avgDurations
                .filter((d) => d.count > 0)
                .slice(0, 4)
                .map((d) => (
                  <div
                    key={d.state}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-[var(--text-secondary)]">
                      {ACTIVITY_DISPLAY_NAME[d.state]}
                    </span>
                    <span className="font-mono text-[var(--text-primary)] tabular-nums">
                      {formatDuration(d.avg)}
                    </span>
                  </div>
                ))}
              {avgDurations.every((d) => d.count === 0) && (
                <p className="text-xs text-[var(--text-tertiary)]">
                  No completed sessions in this window.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
              Top Performers
            </h2>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                No performers in this window.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {topPerformers.map((p, idx) => (
                  <button
                    key={p.uid}
                    type="button"
                    onClick={() => router.push(`/users/${p.uid}`)}
                    className="flex items-center gap-2 hover:bg-[var(--surface-overlay)] rounded-[var(--radius-rally)] px-1 py-1 -mx-1 transition-colors cursor-pointer text-left"
                  >
                    <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums w-4">
                      {idx + 1}
                    </span>
                    <Avatar size="sm" name={p.name} />
                    <span className="flex-1 text-xs text-[var(--text-primary)] truncate">
                      {p.name}
                    </span>
                    <Badge variant="gold" size="sm">
                      {p.count}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Heatmap */}
      <ActivityHeatmap activities={dateRangeFiltered} />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <FilterBar
          options={filterOptionsWithCounts}
          selected={filter}
          onSelect={setFilter}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            placeholder="Filter by user name..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            startIcon={<Search className="h-4 w-4" />}
          />
          <Input
            placeholder="Filter by stock # or vehicle..."
            value={vehicleSearch}
            onChange={(e) => setVehicleSearch(e.target.value)}
            startIcon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Feed */}
      {error ? (
        <Card>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-[var(--status-error)]">
                Failed to load activities
              </p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {error.message}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No activity matches"
          description="Try widening the date range or clearing the type filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col divide-y divide-[var(--surface-border)]">
              {filtered.slice(0, 100).map((a) => (
                <div
                  key={a.id ?? `${a.vin}-${a.startedAt.getTime()}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <Avatar size="sm" name={a.startedByName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => router.push(`/users/${a.startedByUserId}`)}
                        className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--rally-gold)] transition-colors cursor-pointer truncate"
                      >
                        {a.startedByName}
                      </button>
                      <ActivityBadge activity={a.state} size="sm" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] mt-0.5">
                      <button
                        type="button"
                        onClick={() => handleVehicleClick(a.vin)}
                        className="font-mono font-medium text-[var(--rally-gold)] hover:text-[var(--rally-gold-light)] transition-colors cursor-pointer"
                      >
                        {a.stockNumber}
                      </button>
                      <span>&mdash;</span>
                      <span className="truncate">{a.yearMakeModel}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <RelativeTime date={a.startedAt} />
                    {a.durationSeconds != null && a.durationSeconds > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        <Clock className="h-3 w-3" />
                        {formatDuration(a.durationSeconds)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filtered.length > 100 && (
              <div className="px-4 py-2 text-center text-xs text-[var(--text-tertiary)] border-t border-[var(--surface-border)]">
                Showing 100 of {filtered.length} events &mdash; refine filters to narrow.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
