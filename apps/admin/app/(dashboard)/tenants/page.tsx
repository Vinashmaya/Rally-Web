'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authFetch } from '@rally/firebase';
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  DataTable,
  FilterBar,
  Skeleton,
  useToast,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tenant type (admin-level view — richer than DealerGroup)
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string;
  slug: string;
  groupName: string;
  status: 'active' | 'suspended' | 'trial' | 'deprovisioned';
  usersCount: number;
  vehiclesCount: number;
  storesCount: number;
  createdAt: string;
  subdomain: string;
}

// ---------------------------------------------------------------------------
// Helper: derive slug from group name
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Status badge variant mapping
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  status: TenantRow['status'],
): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'suspended':
      return 'error';
    case 'deprovisioned':
      return 'warning';
  }
}

// ---------------------------------------------------------------------------
// Filter setup
// ---------------------------------------------------------------------------

type StatusFilter = 'all' | 'active' | 'suspended' | 'trial';

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
] as const;

// ---------------------------------------------------------------------------
// Action Dropdown
// ---------------------------------------------------------------------------

function TenantActionMenu({
  tenant,
  onClose,
  onAction,
}: {
  tenant: TenantRow;
  onClose: () => void;
  onAction: (tenantId: string, action: 'suspend' | 'activate' | 'deprovision') => void;
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-48 rounded-rally-lg bg-surface-overlay border border-surface-border shadow-xl py-1"
      onMouseLeave={onClose}
    >
      {tenant.status !== 'active' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-border hover:text-text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onAction(tenant.id, 'activate');
            onClose();
          }}
        >
          <Play className="h-3.5 w-3.5" />
          Activate
        </button>
      )}
      {tenant.status === 'active' && (
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-status-warning hover:bg-surface-border transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onAction(tenant.id, 'suspend');
            onClose();
          }}
        >
          <Pause className="h-3.5 w-3.5" />
          Suspend
        </button>
      )}
      <div className="my-1 border-t border-surface-border" />
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-status-error hover:bg-surface-border transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm(`Are you sure you want to deprovision "${tenant.groupName}"? This action cannot be undone.`)) {
            onAction(tenant.id, 'deprovision');
          }
          onClose();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Deprovision
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action Cell
// ---------------------------------------------------------------------------

function TenantActionCell({
  tenant,
  onAction,
}: {
  tenant: TenantRow;
  onAction: (tenantId: string, action: 'suspend' | 'activate' | 'deprovision') => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-rally text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-label={`Actions for ${tenant.groupName}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <TenantActionMenu
          tenant={tenant}
          onClose={() => setOpen(false)}
          onAction={onAction}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TenantsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch tenant data from server API (includes aggregated counts)
  const [tenantRows, setTenantRows] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/admin/tenants')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setTenantRows(
            (json.data as Array<Record<string, unknown>>).map((t) => {
              // Firestore Timestamps serialize as {_seconds, _nanoseconds} via JSON
              let createdAt = '';
              if (t.createdAt) {
                const ts = t.createdAt as { _seconds?: number } | string;
                const ms = typeof ts === 'string' ? Date.parse(ts) : ((ts._seconds ?? 0) * 1000);
                const d = new Date(ms);
                if (!isNaN(d.getTime())) createdAt = d.toISOString().split('T')[0] ?? '';
              }
              const name = (t.name as string) ?? '';
              return {
                id: (t.id as string) ?? '',
                slug: slugify(name),
                groupName: name,
                status: (t.status as TenantRow['status']) ?? 'active',
                usersCount: (t.usersCount as number) ?? 0,
                vehiclesCount: (t.vehiclesCount as number) ?? 0,
                storesCount: (t.storesCount as number) ?? 0,
                createdAt,
                subdomain: `${slugify(name)}.rally.vin`,
              };
            }),
          );
        }
      })
      .catch((err) => console.error('[tenants] fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  // Tenant action handler
  const handleTenantAction = useCallback(
    async (tenantId: string, action: 'suspend' | 'activate' | 'deprovision') => {
      try {
        const res = await authFetch(`/api/admin/tenants/${tenantId}/${action}`, {
          method: 'POST',
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
          throw new Error(body.message ?? `Failed to ${action} tenant`);
        }

        toast({
          type: 'success',
          title: `Tenant ${action}d`,
          description: `Successfully ${action === 'activate' ? 'activated' : action === 'suspend' ? 'suspended' : 'deprovisioned'} the tenant.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred';
        toast({
          type: 'error',
          title: `Failed to ${action} tenant`,
          description: message,
        });
      }
    },
    [toast],
  );

  // Column definitions (defined inside component to access handleTenantAction)
  const columns: ColumnDef<TenantRow, unknown>[] = useMemo(() => [
    {
      accessorKey: 'slug',
      header: 'Slug',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-geist-mono)] text-sm text-text-primary font-medium">
            {row.original.slug}
          </span>
          <a
            href={`https://${row.original.subdomain}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-text-tertiary hover:text-rally-gold transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ),
    },
    {
      accessorKey: 'groupName',
      header: 'Group Name',
      cell: ({ row }) => (
        <span className="text-sm text-text-secondary">
          {row.original.groupName}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.status)} size="sm">
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'usersCount',
      header: 'Users',
      cell: ({ row }) => (
        <span className="font-[family-name:var(--font-geist-mono)] text-sm text-text-secondary tabular-nums">
          {row.original.usersCount}
        </span>
      ),
    },
    {
      accessorKey: 'vehiclesCount',
      header: 'Vehicles',
      cell: ({ row }) => (
        <span className="font-[family-name:var(--font-geist-mono)] text-sm text-text-secondary tabular-nums">
          {row.original.vehiclesCount.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'storesCount',
      header: 'Stores',
      cell: ({ row }) => (
        <span className="font-[family-name:var(--font-geist-mono)] text-sm text-text-secondary tabular-nums">
          {row.original.storesCount}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-text-tertiary">
          {row.original.createdAt}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <TenantActionCell
          tenant={row.original}
          onAction={handleTenantAction}
        />
      ),
    },
  ], [handleTenantAction]);

  // Filter by status
  const filteredTenants = useMemo(() => {
    let result = [...tenantRows];

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return result;
  }, [tenantRows, statusFilter]);

  // Filter option counts
  const filterOptionsWithCounts: FilterOption[] = useMemo(() => {
    return STATUS_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? tenantRows.length
          : tenantRows.filter((t) => t.status === opt.value).length,
    }));
  }, [tenantRows]);

  // Aggregate stats
  const totalUsers = tenantRows.reduce((sum, t) => sum + t.usersCount, 0);
  const totalVehicles = tenantRows.reduce((sum, t) => sum + t.vehiclesCount, 0);
  const activeTenants = tenantRows.filter((t) => t.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* -- Header ---------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Tenants</h1>
          <Badge variant="default" size="md">
            {tenantRows.length}
          </Badge>
        </div>
        <Button
          variant="primary"
          onClick={() => router.push('/tenants/create')}
        >
          <Plus className="h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      {/* -- Summary Stats ------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Building2 className="h-4 w-4 text-rally-gold" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Active</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {loading ? <Skeleton variant="text" className="h-6 w-8 inline-block" /> : activeTenants}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Building2 className="h-4 w-4 text-status-info" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Total Users</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {loading ? <Skeleton variant="text" className="h-6 w-12 inline-block" /> : totalUsers.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Building2 className="h-4 w-4 text-status-success" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Total Vehicles</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {loading ? <Skeleton variant="text" className="h-6 w-12 inline-block" /> : totalVehicles.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* -- Filters + Search -------------------------------------------- */}
      <div className="space-y-3">
        <FilterBar
          options={filterOptionsWithCounts}
          selected={statusFilter}
          onSelect={(v) => setStatusFilter(v as StatusFilter)}
        />
        <Input
          placeholder="Search by slug or group name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          startIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* -- Data Table -------------------------------------------------- */}
      <DataTable<TenantRow>
        columns={columns}
        data={filteredTenants}
        globalFilter={search}
        loading={loading}
        onRowClick={(row) => router.push(`/tenants/${row.id}`)}
        emptyIcon={Building2}
        emptyMessage="No tenants found"
        emptyDescription={
          search
            ? `No tenants match "${search}". Try a different search.`
            : 'Provision your first tenant to get started.'
        }
        emptyAction={
          !search ? (
            <Button
              variant="primary"
              onClick={() => router.push('/tenants/create')}
            >
              <Plus className="h-4 w-4" />
              Create Tenant
            </Button>
          ) : undefined
        }
        defaultPageSize={25}
      />
    </div>
  );
}
