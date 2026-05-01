'use client';

// Manage Lists — GM/Principal-tier oversight of all vehicleLists at the dealership.
// Unlike the staff list view, this surfaces every owner's lists for visibility.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListChecks,
  Search,
  Users as UsersIcon,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Skeleton,
  Input,
  EmptyState,
  DataTable,
  RelativeTime,
  type ColumnDef,
} from '@rally/ui';
import { useTenantStore } from '@rally/services';
import { useAllVehicleLists, type VehicleList } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Color map (mirrors staff lists page)
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#22C55E',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  teal: '#14B8A6',
  indigo: '#6366F1',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function daysSince(date: Date | undefined): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: number;
  hint?: string;
  tone?: 'gold' | 'success' | 'warning';
}

function KpiCard({ label, value, hint, tone = 'gold' }: KpiCardProps) {
  const valueClass = {
    gold: 'text-[var(--text-primary)]',
    success: 'text-[var(--status-success)]',
    warning: 'text-[var(--status-warning)]',
  }[tone];
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </p>
        <p className={`text-3xl font-bold tabular-nums mt-1 ${valueClass}`}>{value}</p>
        {hint && <p className="text-xs text-[var(--text-tertiary)] mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ListsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton variant="text" className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>
      <Skeleton variant="card" className="h-96" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

type ShareFilter = 'all' | 'shared_dealership' | 'shared_users' | 'private';
type RecencyFilter = 'all' | '7' | '30';

interface FilterState {
  share: ShareFilter;
  recency: RecencyFilter;
  ownerId: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface ListRow extends VehicleList {
  ownerDisplay: string;
  sharedWithDisplay: string;
  createdAtDisplay: string;
}

export default function ManageListsPage() {
  const router = useRouter();
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  const { lists, loading, error } = useAllVehicleLists({ dealershipId });

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterState>({
    share: 'all',
    recency: 'all',
    ownerId: 'all',
  });

  // Owner pick options derived from lists
  const owners = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lists) {
      if (!m.has(l.ownerId)) {
        m.set(l.ownerId, l.ownerName);
      }
    }
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [lists]);

  // Apply filters
  const filtered = useMemo(() => {
    return lists.filter((l) => {
      if (filter.ownerId !== 'all' && l.ownerId !== filter.ownerId) return false;

      if (filter.share === 'shared_dealership' && !l.isShared) return false;
      if (
        filter.share === 'shared_users' &&
        (!l.sharedWith || l.sharedWith.length === 0 || l.isShared)
      )
        return false;
      if (
        filter.share === 'private' &&
        (l.isShared || (l.sharedWith && l.sharedWith.length > 0))
      )
        return false;

      if (filter.recency !== 'all') {
        const days = Number.parseInt(filter.recency, 10);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const updatedMs = l.updatedAt?.getTime() ?? 0;
        const createdMs = l.createdAt?.getTime() ?? 0;
        if (Math.max(updatedMs, createdMs) < cutoff) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        if (!`${l.name} ${l.ownerName}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [lists, filter, search]);

  // Build display rows
  const rows: ListRow[] = useMemo(() => {
    return filtered.map((l) => ({
      ...l,
      ownerDisplay: l.ownerName,
      sharedWithDisplay: l.isShared
        ? 'Entire dealership'
        : l.sharedWith && l.sharedWith.length > 0
          ? `${l.sharedWith.length} ${l.sharedWith.length === 1 ? 'user' : 'users'}`
          : 'Private',
      createdAtDisplay: formatDate(l.createdAt),
    }));
  }, [filtered]);

  // KPIs over all lists (not filtered)
  const kpis = useMemo(() => {
    const total = lists.length;
    const shared = lists.filter(
      (l) => l.isShared || (l.sharedWith && l.sharedWith.length > 0),
    ).length;
    const stale30 = lists.filter((l) => {
      const recency = Math.max(
        l.updatedAt?.getTime() ?? 0,
        l.createdAt?.getTime() ?? 0,
      );
      const days = recency > 0 ? Math.floor((Date.now() - recency) / (1000 * 60 * 60 * 24)) : 999;
      return days > 30;
    }).length;
    return { total, shared, stale30 };
  }, [lists]);

  const columns: ColumnDef<ListRow>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'List',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{
                backgroundColor: COLOR_MAP[row.original.color] ?? 'var(--rally-gold)',
              }}
            />
            <span className="font-medium text-[var(--text-primary)] truncate">
              {row.original.name}
            </span>
            {row.original.isDefault && (
              <Badge variant="default" size="sm">
                Default
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'ownerDisplay',
        header: 'Owner',
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)]">
            {row.original.ownerDisplay}
          </span>
        ),
      },
      {
        accessorKey: 'sharedWithDisplay',
        header: 'Shared With',
        cell: ({ row }) => {
          const isShared = row.original.isShared;
          const hasUsers =
            row.original.sharedWith && row.original.sharedWith.length > 0;
          if (isShared) {
            return (
              <Badge variant="gold" size="sm">
                Dealership
              </Badge>
            );
          }
          if (hasUsers) {
            return (
              <Badge variant="info" size="sm">
                {row.original.sharedWithDisplay}
              </Badge>
            );
          }
          return (
            <span className="text-[var(--text-tertiary)] text-xs">Private</span>
          );
        },
      },
      {
        accessorKey: 'vehicleCount',
        header: 'Items',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-[var(--text-primary)]">
            {row.original.vehicleCount}
          </span>
        ),
      },
      {
        accessorKey: 'createdAtDisplay',
        header: 'Created',
        cell: ({ row }) => (
          <span className="text-[var(--text-secondary)] text-xs">
            {row.original.createdAtDisplay}
          </span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Updated',
        cell: ({ row }) => {
          const updated = row.original.updatedAt;
          if (!updated) return <span className="text-[var(--text-tertiary)]">—</span>;
          const days = daysSince(updated) ?? 0;
          const tone =
            days > 60
              ? 'text-[var(--status-error)]'
              : days > 30
                ? 'text-[var(--status-warning)]'
                : 'text-[var(--text-secondary)]';
          return (
            <span className={tone}>
              <RelativeTime date={updated} />
            </span>
          );
        },
      },
    ],
    [],
  );

  if (!activeStore) {
    return <ListsSkeleton />;
  }

  if (loading) {
    return <ListsSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="rounded-full bg-[var(--status-error)]/15 p-4">
          <AlertCircle className="h-8 w-8 text-[var(--status-error)]" strokeWidth={1.5} />
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">
          Failed to load lists
        </p>
        <p className="text-xs text-[var(--text-tertiary)] max-w-xs text-center">
          {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lists</h1>
          <Badge variant="default" size="sm">
            {filtered.length} of {kpis.total}
          </Badge>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Total Lists" value={kpis.total} tone="gold" />
        <KpiCard
          label="Shared"
          value={kpis.shared}
          hint="Dealership or specific users"
          tone="success"
        />
        <KpiCard
          label="Stale (>30d)"
          value={kpis.stale30}
          hint="No updates in over a month"
          tone={kpis.stale30 > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Filters
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="Search list or owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startIcon={<Search className="h-4 w-4" />}
            />
            <select
              value={filter.ownerId}
              onChange={(e) =>
                setFilter((f) => ({ ...f, ownerId: e.target.value }))
              }
              className="h-10 rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)]"
            >
              <option value="all">All owners</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={filter.share}
              onChange={(e) =>
                setFilter((f) => ({ ...f, share: e.target.value as ShareFilter }))
              }
              className="h-10 rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)]"
            >
              <option value="all">Any sharing</option>
              <option value="shared_dealership">Shared with dealership</option>
              <option value="shared_users">Shared with users</option>
              <option value="private">Private</option>
            </select>
            <select
              value={filter.recency}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  recency: e.target.value as RecencyFilter,
                }))
              }
              className="h-10 rounded-rally bg-[var(--surface-overlay)] border border-[var(--surface-border)] px-3 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rally-gold)]"
            >
              <option value="all">Any time</option>
              <option value="7">Active in last 7 days</option>
              <option value="30">Active in last 30 days</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No lists yet"
          description="When salespeople or managers create vehicle lists, they appear here."
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyIcon={ListChecks}
          emptyMessage="No lists match these filters"
          emptyDescription="Adjust the share, owner, or recency filters."
          defaultPageSize={25}
          // TODO: drill-down route — /lists/[listId] detail not yet built.
          onRowClick={(row) => {
            console.info('[Lists] open list', row.id);
          }}
        />
      )}

      {/* Owner count summary */}
      {owners.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <UsersIcon className="h-3.5 w-3.5" />
          {owners.length} list owners across this store.
        </div>
      )}
    </div>
  );
}
