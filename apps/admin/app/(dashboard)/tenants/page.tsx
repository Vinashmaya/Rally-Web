'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  Input,
  DataTable,
  FilterBar,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  MoreHorizontal,
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
// Mock data — TODO: Replace with real API route (GET /api/admin/tenants)
// that uses Firebase Admin SDK to query all groups across the platform
// ---------------------------------------------------------------------------

const MOCK_TENANTS: TenantRow[] = [
  {
    id: 'grp_001',
    slug: 'gallatin-cdjr',
    groupName: 'Gallatin CDJR',
    status: 'active',
    usersCount: 45,
    vehiclesCount: 892,
    storesCount: 2,
    createdAt: '2025-11-15',
    subdomain: 'gallatin-cdjr.rally.vin',
  },
  {
    id: 'grp_002',
    slug: 'nashville-motors',
    groupName: 'Nashville Motors Group',
    status: 'active',
    usersCount: 67,
    vehiclesCount: 1203,
    storesCount: 3,
    createdAt: '2025-12-01',
    subdomain: 'nashville-motors.rally.vin',
  },
  {
    id: 'grp_003',
    slug: 'liberty-ford',
    groupName: 'Liberty Ford',
    status: 'active',
    usersCount: 32,
    vehiclesCount: 548,
    storesCount: 1,
    createdAt: '2025-12-18',
    subdomain: 'liberty-ford.rally.vin',
  },
  {
    id: 'grp_004',
    slug: 'springfield-auto',
    groupName: 'Springfield Auto Mall',
    status: 'trial',
    usersCount: 12,
    vehiclesCount: 234,
    storesCount: 1,
    createdAt: '2026-01-05',
    subdomain: 'springfield-auto.rally.vin',
  },
  {
    id: 'grp_005',
    slug: 'cookeville-chevy',
    groupName: 'Cookeville Chevrolet',
    status: 'active',
    usersCount: 28,
    vehiclesCount: 412,
    storesCount: 1,
    createdAt: '2026-01-12',
    subdomain: 'cookeville-chevy.rally.vin',
  },
  {
    id: 'grp_006',
    slug: 'murfreesboro-hyundai',
    groupName: 'Murfreesboro Hyundai',
    status: 'trial',
    usersCount: 8,
    vehiclesCount: 156,
    storesCount: 1,
    createdAt: '2026-02-01',
    subdomain: 'murfreesboro-hyundai.rally.vin',
  },
  {
    id: 'grp_007',
    slug: 'test-dealer-old',
    groupName: 'Test Dealer (Legacy)',
    status: 'suspended',
    usersCount: 0,
    vehiclesCount: 0,
    storesCount: 1,
    createdAt: '2025-10-01',
    subdomain: 'test-dealer-old.rally.vin',
  },
  {
    id: 'grp_008',
    slug: 'clarksville-toyota',
    groupName: 'Clarksville Toyota',
    status: 'active',
    usersCount: 38,
    vehiclesCount: 621,
    storesCount: 2,
    createdAt: '2026-01-20',
    subdomain: 'clarksville-toyota.rally.vin',
  },
  {
    id: 'grp_009',
    slug: 'jackson-nissan',
    groupName: 'Jackson Nissan',
    status: 'active',
    usersCount: 22,
    vehiclesCount: 389,
    storesCount: 1,
    createdAt: '2026-02-10',
    subdomain: 'jackson-nissan.rally.vin',
  },
  {
    id: 'grp_010',
    slug: 'demo-sandbox',
    groupName: 'Rally Demo Sandbox',
    status: 'trial',
    usersCount: 5,
    vehiclesCount: 50,
    storesCount: 1,
    createdAt: '2026-02-20',
    subdomain: 'demo-sandbox.rally.vin',
  },
] as const;

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
// Column definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<TenantRow, unknown>[] = [
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Open action menu (suspend, impersonate, delete)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-rally text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors"
        aria-label={`Actions for ${row.original.groupName}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    ),
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TenantsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // TODO: Replace mock with real data from API route
  const loading = false;
  const tenants = MOCK_TENANTS;

  // Filter by status
  const filteredTenants = useMemo(() => {
    let result = [...tenants];

    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    return result;
  }, [tenants, statusFilter]);

  // Filter option counts
  const filterOptionsWithCounts: FilterOption[] = useMemo(() => {
    return STATUS_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? tenants.length
          : tenants.filter((t) => t.status === opt.value).length,
    }));
  }, [tenants]);

  // Aggregate stats
  const totalUsers = tenants.reduce((sum, t) => sum + t.usersCount, 0);
  const totalVehicles = tenants.reduce((sum, t) => sum + t.vehiclesCount, 0);
  const activeTenants = tenants.filter((t) => t.status === 'active').length;

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Tenants</h1>
          <Badge variant="default" size="md">
            {tenants.length}
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

      {/* ── Summary Stats ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-3">
            <div className="shrink-0 p-2 rounded-rally bg-surface-overlay">
              <Building2 className="h-4 w-4 text-rally-gold" />
            </div>
            <div>
              <p className="text-xs text-text-tertiary uppercase tracking-wider">Active</p>
              <p className="text-lg font-bold text-text-primary font-[family-name:var(--font-geist-mono)]">
                {activeTenants}
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
                {totalUsers.toLocaleString()}
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
                {totalVehicles.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters + Search ─────────────────────────────────────── */}
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

      {/* ── Data Table ───────────────────────────────────────────── */}
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
