'use client';

import { useMemo } from 'react';
import {
  Store,
  Crown,
  Activity,
  Clock,
  Route,
  Eye,
  MapPin,
  Fuel,
  Zap,
  ThumbsUp,
  BarChart3,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Badge,
  Skeleton,
  EmptyState,
  Avatar,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import {
  useActivities,
  ACTIVITY_DISPLAY_NAME,
  type VehicleActivityState,
} from '@rally/firebase';

// ---------------------------------------------------------------------------
// Activity state display config
// ---------------------------------------------------------------------------

const ACTIVITY_STATE_CONFIG: Record<
  VehicleActivityState,
  { icon: React.ElementType; colorClass: string; bgClass: string }
> = {
  AVAILABLE: { icon: Activity, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15' },
  SHOWING: { icon: Eye, colorClass: 'text-blue-400', bgClass: 'bg-blue-500/15' },
  TEST_DRIVE: { icon: Route, colorClass: 'text-red-400', bgClass: 'bg-red-500/15' },
  OFF_LOT: { icon: MapPin, colorClass: 'text-orange-400', bgClass: 'bg-orange-500/15' },
  FUELING: { icon: Fuel, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/15' },
  CHARGING_RUNNING: { icon: Zap, colorClass: 'text-yellow-400', bgClass: 'bg-yellow-500/15' },
  SOLD: { icon: ThumbsUp, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/15' },
} as const;

// Selectable activity states (the 6 real activity types, not AVAILABLE)
const SELECTABLE_STATES: VehicleActivityState[] = [
  'TEST_DRIVE',
  'SHOWING',
  'OFF_LOT',
  'FUELING',
  'CHARGING_RUNNING',
  'SOLD',
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaderboardEntry {
  userId: string;
  name: string;
  count: number;
}

interface DayCount {
  label: string;
  count: number;
  date: Date;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PerformanceSkeleton() {
  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-40" />
      </div>
      <Skeleton variant="card" className="h-64" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton variant="card" className="h-48" />
        <Skeleton variant="card" className="h-48" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap intensity color
// ---------------------------------------------------------------------------

function getHeatmapColor(count: number, maxCount: number): string {
  if (maxCount === 0 || count === 0) return 'bg-[var(--surface-overlay)]';
  const ratio = count / maxCount;
  if (ratio > 0.75) return 'bg-red-500';
  if (ratio > 0.5) return 'bg-orange-500';
  if (ratio > 0.25) return 'bg-yellow-500';
  return 'bg-emerald-500/60';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PerformancePage() {
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const { activities, loading, error } = useActivities({
    dealershipId,
    limitCount: 500,
  });

  // -------------------------------------------------------------------------
  // Team Leaderboard — group by startedByUserId, count per user
  // -------------------------------------------------------------------------

  const leaderboard = useMemo((): LeaderboardEntry[] => {
    const map = new Map<string, { name: string; count: number }>();

    for (const a of activities) {
      if (a.state === 'AVAILABLE') continue; // skip AVAILABLE
      const existing = map.get(a.startedByUserId);
      if (existing) {
        existing.count++;
      } else {
        map.set(a.startedByUserId, { name: a.startedByName, count: 1 });
      }
    }

    return Array.from(map.entries())
      .map(([userId, data]) => ({ userId, name: data.name, count: data.count }))
      .sort((a, b) => b.count - a.count);
  }, [activities]);

  const maxActivityCount = leaderboard.length > 0 ? leaderboard[0]?.count ?? 0 : 0;

  // -------------------------------------------------------------------------
  // Activity Breakdown — count per VehicleActivityState
  // -------------------------------------------------------------------------

  const activityBreakdown = useMemo(() => {
    const counts: Record<VehicleActivityState, number> = {
      AVAILABLE: 0,
      SHOWING: 0,
      TEST_DRIVE: 0,
      OFF_LOT: 0,
      FUELING: 0,
      CHARGING_RUNNING: 0,
      SOLD: 0,
    };
    for (const a of activities) {
      counts[a.state] = (counts[a.state] ?? 0) + 1;
    }
    return counts;
  }, [activities]);

  // -------------------------------------------------------------------------
  // Activity Timeline — group by day (last 7 days)
  // -------------------------------------------------------------------------

  const timeline = useMemo((): DayCount[] => {
    const now = new Date();
    const days: DayCount[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = activities.filter((a) => {
        const started = a.startedAt instanceof Date ? a.startedAt : new Date(a.startedAt);
        return started >= date && started < nextDay && a.state !== 'AVAILABLE';
      }).length;

      days.push({ label: dayLabel, count, date });
    }

    return days;
  }, [activities]);

  const maxTimelineCount = useMemo(
    () => Math.max(...timeline.map((d) => d.count), 1),
    [timeline],
  );

  // -------------------------------------------------------------------------
  // Peak Hours — group activities by hour of day
  // -------------------------------------------------------------------------

  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, () => 0);

    for (const a of activities) {
      if (a.state === 'AVAILABLE') continue;
      const started = a.startedAt instanceof Date ? a.startedAt : new Date(a.startedAt);
      const hour = started.getHours();
      hours[hour] = (hours[hour] ?? 0) + 1;
    }

    return hours;
  }, [activities]);

  const maxHourCount = useMemo(() => Math.max(...peakHours, 1), [peakHours]);

  // -------------------------------------------------------------------------
  // Guard: no active store
  // -------------------------------------------------------------------------

  if (!activeStore) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Store}
          title="Select a store"
          description="Choose a store from the sidebar to view performance analytics."
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return <PerformanceSkeleton />;
  }

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  if (activities.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Activity}
          title="No activity data"
          description="Performance analytics will appear here once your team starts logging activities."
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* ----------------------------------------------------------------- */}
      {/* Page Header */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Performance
          </h1>
          <Badge variant="default" size="sm">
            {activities.length} events
          </Badge>
        </div>
        <Badge variant="gold" size="sm">
          Last 30 Days
        </Badge>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Team Leaderboard */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-[var(--rally-gold)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Team Leaderboard
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
              No team activity yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, index) => {
                const isTop = index === 0;
                const barWidth =
                  maxActivityCount > 0
                    ? (entry.count / maxActivityCount) * 100
                    : 0;

                return (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-3"
                  >
                    {/* Rank */}
                    <span
                      className={`w-6 text-sm font-bold tabular-nums text-right ${
                        isTop
                          ? 'text-[var(--rally-gold)]'
                          : 'text-[var(--text-tertiary)]'
                      }`}
                    >
                      {index + 1}
                    </span>

                    {/* Avatar */}
                    <Avatar name={entry.name} size="sm" />

                    {/* Name + badge */}
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {entry.name}
                      </span>
                      {isTop && (
                        <Badge variant="gold" size="sm">
                          Top Performer
                        </Badge>
                      )}
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-5 rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] overflow-hidden">
                      <div
                        className={`h-full rounded-[var(--radius-rally)] transition-all duration-500 ${
                          isTop
                            ? 'bg-[var(--rally-gold)]'
                            : 'bg-[var(--rally-gold)]/40'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>

                    {/* Count */}
                    <span className="text-sm font-bold tabular-nums text-[var(--text-primary)] min-w-[32px] text-right">
                      {entry.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Activity Breakdown */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Activity Breakdown
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SELECTABLE_STATES.map((state) => {
              const config = ACTIVITY_STATE_CONFIG[state];
              const Icon = config.icon;
              const count = activityBreakdown[state];

              return (
                <div
                  key={state}
                  className={`flex flex-col gap-2 rounded-[var(--radius-rally-lg)] ${config.bgClass} border border-transparent p-3`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.colorClass}`} />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {ACTIVITY_DISPLAY_NAME[state]}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${config.colorClass}`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Activity Timeline + Peak Hours */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Activity Timeline — last 7 days bar chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Activity Timeline
              </h2>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              Last 7 days
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {timeline.map((day) => {
                const heightPct =
                  maxTimelineCount > 0
                    ? (day.count / maxTimelineCount) * 100
                    : 0;

                return (
                  <div
                    key={day.label}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                  >
                    {/* Count label */}
                    <span className="text-[10px] font-medium tabular-nums text-[var(--text-secondary)]">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    {/* Bar */}
                    <div
                      className="w-full rounded-t-[var(--radius-rally)] bg-[var(--rally-gold)] transition-all duration-500 min-h-[2px]"
                      style={{ height: `${Math.max(heightPct, 2)}%` }}
                    />
                    {/* Day label */}
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours — heatmap */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--text-tertiary)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Peak Hours
              </h2>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              Activity by hour of day
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {/* Heatmap grid */}
              <div className="grid grid-cols-12 gap-1">
                {peakHours.map((count, hour) => (
                  <div
                    key={hour}
                    className={`aspect-square rounded-[3px] ${getHeatmapColor(count, maxHourCount)} transition-colors relative group`}
                    title={`${hour}:00 — ${count} activities`}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex items-center px-2 py-1 rounded bg-[var(--surface-raised)] border border-[var(--surface-border)] shadow-lg z-10 whitespace-nowrap">
                      <span className="text-[10px] text-[var(--text-primary)]">
                        {hour.toString().padStart(2, '0')}:00 &mdash; {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hour labels */}
              <div className="grid grid-cols-12 gap-1">
                {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
                  <span
                    key={h}
                    className="text-[9px] text-[var(--text-tertiary)] text-center tabular-nums"
                  >
                    {h.toString().padStart(2, '0')}
                  </span>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-[var(--text-tertiary)]">Low</span>
                <div className="flex gap-0.5">
                  <div className="h-3 w-3 rounded-[2px] bg-[var(--surface-overlay)]" />
                  <div className="h-3 w-3 rounded-[2px] bg-emerald-500/60" />
                  <div className="h-3 w-3 rounded-[2px] bg-yellow-500" />
                  <div className="h-3 w-3 rounded-[2px] bg-orange-500" />
                  <div className="h-3 w-3 rounded-[2px] bg-red-500" />
                </div>
                <span className="text-[10px] text-[var(--text-tertiary)]">High</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
