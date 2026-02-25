'use client';

import { useMemo, useCallback, useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Skeleton,
  DateRangePicker,
  useToast,
} from '@rally/ui';
import type { BadgeProps } from '@rally/ui';
import {
  ScrollText,
  Download,
  Search,
  Filter,
  Building2,
  User,
  Bot,
  Globe,
} from 'lucide-react';
import { useAuditLog } from '@rally/firebase';
import type { AuditLogEntry } from '@rally/firebase';

type ActionCategory = 'all' | 'tenant' | 'user' | 'vehicle' | 'config' | 'auth';

// ---------------------------------------------------------------------------
// Action Classification
// ---------------------------------------------------------------------------

interface ActionStyle {
  label: string;
  variant: BadgeProps['variant'];
  borderColor: string;
  category: ActionCategory;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  'tenant.provisioned': { label: 'Provisioned', variant: 'success', borderColor: 'border-l-status-success', category: 'tenant' },
  'tenant.deprovisioned': { label: 'Deprovisioned', variant: 'error', borderColor: 'border-l-status-error', category: 'tenant' },
  'user.created': { label: 'User Created', variant: 'success', borderColor: 'border-l-status-success', category: 'user' },
  'user.updated': { label: 'User Updated', variant: 'info', borderColor: 'border-l-status-info', category: 'user' },
  'user.role_changed': { label: 'Role Changed', variant: 'info', borderColor: 'border-l-status-info', category: 'user' },
  'user.deleted': { label: 'User Deleted', variant: 'error', borderColor: 'border-l-status-error', category: 'user' },
  'vehicle.sold': { label: 'Vehicle Sold', variant: 'success', borderColor: 'border-l-status-success', category: 'vehicle' },
  'vehicle.added': { label: 'Vehicle Added', variant: 'success', borderColor: 'border-l-status-success', category: 'vehicle' },
  'config.updated': { label: 'Config Changed', variant: 'warning', borderColor: 'border-l-status-warning', category: 'config' },
  'config.feature_flag': { label: 'Feature Flag', variant: 'warning', borderColor: 'border-l-status-warning', category: 'config' },
  'auth.login': { label: 'Login', variant: 'gold', borderColor: 'border-l-rally-gold', category: 'auth' },
  'auth.logout': { label: 'Logout', variant: 'gold', borderColor: 'border-l-rally-gold', category: 'auth' },
  'auth.failed': { label: 'Auth Failed', variant: 'error', borderColor: 'border-l-status-error', category: 'auth' },
} as const;

const DEFAULT_ACTION_STYLE: ActionStyle = {
  label: 'Unknown',
  variant: 'default',
  borderColor: 'border-l-surface-border',
  category: 'all',
};

function getActionStyle(action: string): ActionStyle {
  return ACTION_STYLES[action] ?? DEFAULT_ACTION_STYLE;
}

// ---------------------------------------------------------------------------
// Filter Options
// ---------------------------------------------------------------------------

interface FilterOption {
  value: ActionCategory;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Actions' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'user', label: 'User' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'config', label: 'Config' },
  { value: 'auth', label: 'Auth' },
] as const;

// ---------------------------------------------------------------------------
// Actor Type Icons (derived from targetType or actorName)
// ---------------------------------------------------------------------------

type ActorType = 'user' | 'system' | 'api';

function deriveActorType(entry: AuditLogEntry): ActorType {
  const name = entry.actorName?.toLowerCase() ?? '';
  if (name === 'system' || name === '') return 'system';
  if (name.includes('api') || name.includes('sync')) return 'api';
  return 'user';
}

function ActorIcon({ type }: { type: ActorType }) {
  switch (type) {
    case 'user':
      return <User className="h-3.5 w-3.5 text-text-tertiary" />;
    case 'system':
      return <Bot className="h-3.5 w-3.5 text-text-tertiary" />;
    case 'api':
      return <Globe className="h-3.5 w-3.5 text-text-tertiary" />;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date | undefined): string {
  if (!date) return '--';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatDateShort(date: Date | undefined): string {
  if (!date) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function toDateKey(date: Date | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0] ?? '';
}

function buildDescription(entry: AuditLogEntry): string {
  const parts = [entry.action.replace(/[._]/g, ' ')];
  if (entry.targetId) parts.push(`→ ${entry.targetId}`);
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditLogsPage() {
  const { toast } = useToast();
  const { auditLogs, loading } = useAuditLog({ limitCount: 200 });
  const [activeFilter, setActiveFilter] = useState<ActionCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6);

  const [startDate, setStartDate] = useState(
    sevenDaysAgo.toISOString().split('T')[0] ?? '',
  );
  const [endDate, setEndDate] = useState(
    today.toISOString().split('T')[0] ?? '',
  );

  const handleDateChange = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Category filter
      if (activeFilter !== 'all') {
        const style = getActionStyle(log.action);
        if (style.category !== activeFilter) return false;
      }

      // Date range filter
      const logDate = toDateKey(log.timestamp);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesActor = (log.actorName ?? '').toLowerCase().includes(query);
        const matchesAction = log.action.toLowerCase().includes(query);
        const matchesTenant = (log.tenantId ?? '').toLowerCase().includes(query);
        const matchesTarget = (log.targetId ?? '').toLowerCase().includes(query);
        if (!matchesActor && !matchesAction && !matchesTenant && !matchesTarget) return false;
      }

      return true;
    });
  }, [auditLogs, activeFilter, startDate, endDate, searchQuery]);

  // Group logs by day for visual separation
  const groupedLogs = useMemo(() => {
    const groups: { date: string; logs: AuditLogEntry[] }[] = [];
    let currentDate = '';

    for (const log of filteredLogs) {
      const logDate = toDateKey(log.timestamp);
      if (logDate !== currentDate) {
        currentDate = logDate;
        groups.push({ date: logDate, logs: [] });
      }
      const currentGroup = groups[groups.length - 1];
      if (currentGroup) {
        currentGroup.logs.push(log);
      }
    }

    return groups;
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton variant="text" className="h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Audit Logs
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Immutable record of all system activity
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast({
              type: 'info',
              title: 'Export',
              description: 'CSV export will be available in the next release.',
            })
          }
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4">
          {/* Action type filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-text-tertiary shrink-0" />
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveFilter(option.value)}
                className={`inline-flex items-center h-8 px-3 text-xs font-medium rounded-rally border transition-colors duration-150 select-none cursor-pointer ${
                  activeFilter === option.value
                    ? 'bg-rally-goldMuted text-rally-gold border-rally-gold/30'
                    : 'bg-transparent text-text-secondary border-surface-border hover:text-text-primary hover:bg-surface-overlay'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Search + Date Range */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by actor, description, or tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={handleDateChange}
              className="lg:max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Results Count ───────────────────────────────────────── */}
      <p className="text-xs text-text-tertiary">
        Showing {filteredLogs.length} of {auditLogs.length} log entries
      </p>

      {/* ── Timeline ────────────────────────────────────────────── */}
      {groupedLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-surface-overlay p-4">
              <ScrollText className="h-8 w-8 text-text-tertiary" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              No logs found
            </h3>
            <p className="text-sm text-text-secondary max-w-sm">
              Try adjusting your filters or date range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedLogs.map((group) => (
            <div key={group.date}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-rally-gold">
                  {formatDateShort(new Date(group.date + 'T00:00:00Z'))}
                </span>
                <div className="flex-1 h-px bg-surface-border" />
                <span className="text-[10px] text-text-tertiary">
                  {group.logs.length} {group.logs.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {/* Log entries */}
              <div className="space-y-2">
                {group.logs.map((log) => {
                  const style = getActionStyle(log.action);
                  const actorType = deriveActorType(log);
                  return (
                    <div
                      key={log.id ?? log.action}
                      className={`bg-surface-raised border border-surface-border rounded-rally-lg border-l-4 ${style.borderColor} px-4 py-3 transition-colors hover:bg-surface-overlay`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        {/* Timestamp */}
                        <span className="text-[11px] text-text-tertiary font-[family-name:var(--font-geist-mono)] shrink-0 w-36">
                          {formatTimestamp(log.timestamp)}
                        </span>

                        {/* Action badge */}
                        <Badge variant={style.variant} size="sm" className="shrink-0 w-fit">
                          {style.label}
                        </Badge>

                        {/* Description — built from action + targetId */}
                        <p className="text-sm text-text-secondary flex-1">
                          {buildDescription(log)}
                        </p>

                        {/* Actor + Tenant */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <ActorIcon type={actorType} />
                            <span className="text-xs text-text-secondary">
                              {log.actorName || 'System'}
                            </span>
                          </div>
                          {log.tenantId && (
                            <Badge variant="default" size="sm">
                              <Building2 className="h-2.5 w-2.5" />
                              {log.tenantId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
