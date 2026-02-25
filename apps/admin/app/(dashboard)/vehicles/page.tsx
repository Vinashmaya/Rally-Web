'use client';

import { useState, useMemo } from 'react';
import {
  Badge,
  Card,
  CardContent,
  Input,
  EmptyState,
  FilterBar,
  DataTable,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { useAllVehicles } from '@rally/firebase';
import type { Vehicle, VehicleStatus } from '@rally/firebase';
import {
  Car,
  Search,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemVehicle {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  color?: string;
  status: VehicleDisplayStatus;
  daysOnLot: number;
  dealershipId: string;
  primaryPhotoUrl?: string;
  tenantName: string;
  tenantSlug: string;
}

type VehicleDisplayStatus = 'available' | 'testDrive' | 'showVideo' | 'offLot' | 'sold' | VehicleStatus;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<string, string> = {
  available: 'Available',
  testDrive: 'Test Drive',
  showVideo: 'Showing',
  offLot: 'Off Lot',
  sold: 'Sold',
  incoming: 'Incoming',
  intake: 'Intake',
  prep: 'In Prep',
  frontline: 'Frontline',
  service: 'Service',
  delivery: 'Delivery',
  offsite: 'Off-Site',
  archived: 'Archived',
} as const;

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  testDrive: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
  showVideo: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
  offLot: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
  sold: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
  incoming: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30',
  intake: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
  prep: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30',
  frontline: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  service: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
  delivery: 'bg-[#14B8A6]/15 text-[#14B8A6] border-[#14B8A6]/30',
  offsite: 'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/30',
  archived: 'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/30',
} as const;

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'frontline', label: 'Frontline' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'prep', label: 'In Prep' },
  { value: 'service', label: 'Service' },
  { value: 'sold', label: 'Sold' },
  { value: 'offsite', label: 'Off-Site' },
] as const;

const TENANT_COLORS: Record<string, string> = {
  'gallatin-cdjr': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'music-city-toyota': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'franklin-chevrolet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'hendersonville-ford': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
} as const;

// ---------------------------------------------------------------------------
// Helper: map Vehicle → SystemVehicle
// ---------------------------------------------------------------------------

function mapVehicleToSystemVehicle(vehicle: Vehicle): SystemVehicle {
  // Calculate daysOnLot from addedToInventoryAt if not present on the doc
  let daysOnLot = vehicle.daysOnLot ?? 0;
  if (!vehicle.daysOnLot && vehicle.addedToInventoryAt) {
    const added = vehicle.addedToInventoryAt instanceof Date
      ? vehicle.addedToInventoryAt
      : new Date(vehicle.addedToInventoryAt);
    daysOnLot = Math.max(0, Math.floor((Date.now() - added.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return {
    id: vehicle.id ?? vehicle.vin,
    vin: vehicle.vin,
    stockNumber: vehicle.stockNumber,
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    color: vehicle.exteriorColor,
    status: vehicle.status as VehicleDisplayStatus,
    daysOnLot,
    dealershipId: vehicle.dealershipId,
    primaryPhotoUrl: vehicle.primaryPhotoUrl,
    tenantName: vehicle.dealershipId,
    tenantSlug: vehicle.dealershipId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateVin(vin: string): string {
  if (vin.length <= 11) return vin;
  return `...${vin.slice(-8)}`;
}

function getAgingColor(days: number): string {
  if (days >= 90) return 'text-[var(--status-error)]';
  if (days >= 60) return 'text-orange-400';
  if (days >= 30) return 'text-[var(--status-warning)]';
  return 'text-[var(--text-secondary)]';
}

// ---------------------------------------------------------------------------
// Vehicle Photo Thumbnail
// ---------------------------------------------------------------------------

function VehicleThumb({ url, alt }: { url?: string; alt: string }) {
  if (!url) {
    return (
      <div className="flex h-10 w-14 items-center justify-center rounded-[var(--radius-rally)] bg-[var(--surface-overlay)] border border-[var(--surface-border)]">
        <ImageIcon className="h-4 w-4 text-[var(--text-disabled)]" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-10 w-14 rounded-[var(--radius-rally)] object-cover border border-[var(--surface-border)]"
    />
  );
}

// ---------------------------------------------------------------------------
// Column Definitions
// ---------------------------------------------------------------------------

const columns: ColumnDef<SystemVehicle, unknown>[] = [
  {
    id: 'photo',
    header: '',
    cell: ({ row }) => {
      const v = row.original;
      return (
        <VehicleThumb
          url={v.primaryPhotoUrl}
          alt={`${v.year} ${v.make} ${v.model}`}
        />
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'stockNumber',
    header: 'Stock #',
    cell: ({ row }) => (
      <span className="font-[family-name:var(--font-geist-mono)] font-bold text-[var(--rally-gold)]">
        {row.original.stockNumber}
      </span>
    ),
  },
  {
    id: 'ymm',
    header: 'Vehicle',
    accessorFn: (row) => `${row.year} ${row.make} ${row.model}`,
    cell: ({ row }) => {
      const v = row.original;
      return (
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {v.year} {v.make} {v.model}
          </p>
          {v.trim && (
            <p className="text-xs text-[var(--text-tertiary)] truncate">
              {v.trim}{v.color ? ` \u2022 ${v.color}` : ''}
            </p>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'vin',
    header: 'VIN',
    cell: ({ row }) => (
      <span
        className="text-xs font-[family-name:var(--font-geist-mono)] text-[var(--text-tertiary)]"
        title={row.original.vin}
      >
        {truncateVin(row.original.vin)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status;
      const colorClass = STATUS_COLORS[status] ?? 'bg-[#6B7280]/15 text-[#6B7280] border-[#6B7280]/30';
      const isActive = status !== 'available' && status !== 'sold' && status !== 'frontline' && status !== 'archived';
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass}`}>
          {isActive && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-rally-pulse" />
          )}
          {STATUS_DISPLAY[status] ?? status}
        </span>
      );
    },
  },
  {
    accessorKey: 'tenantName',
    header: 'Tenant',
    cell: ({ row }) => {
      const { tenantSlug, tenantName } = row.original;
      const colorClass = TENANT_COLORS[tenantSlug] ?? 'bg-surface-overlay text-text-secondary border-surface-border';
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass}`}>
          {tenantName}
        </span>
      );
    },
  },
  {
    accessorKey: 'daysOnLot',
    header: 'Days',
    cell: ({ row }) => {
      const days = row.original.daysOnLot;
      return (
        <span className={`text-sm font-bold tabular-nums ${getAgingColor(days)}`}>
          {days}d
        </span>
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function SystemVehiclesPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Real Firestore data via useAllVehicles hook
  const { allVehicles: rawVehicles, loading, error } = useAllVehicles({});

  // Map Vehicle[] → SystemVehicle[]
  const vehicles: SystemVehicle[] = useMemo(
    () => rawVehicles.map(mapVehicleToSystemVehicle),
    [rawVehicles],
  );

  // Compute filter counts
  const filterOptionsWithCounts: FilterOption[] = useMemo(() => {
    return FILTER_OPTIONS.map((opt) => ({
      ...opt,
      count:
        opt.value === 'all'
          ? vehicles.length
          : vehicles.filter((v) => v.status === opt.value).length,
    }));
  }, [vehicles]);

  // Filter by status + search
  const filteredVehicles = useMemo(() => {
    let result = [...vehicles];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((v) => v.status === statusFilter);
    }

    // Search filter
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.stockNumber.toLowerCase().includes(query) ||
          v.vin.toLowerCase().includes(query) ||
          `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(query) ||
          v.make.toLowerCase().includes(query) ||
          v.model.toLowerCase().includes(query),
      );
    }

    return result;
  }, [vehicles, statusFilter, search]);

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-status-error shrink-0" />
            <div>
              <p className="text-sm font-medium text-text-primary">Failed to load vehicles</p>
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
          <Car className="h-6 w-6 text-[var(--rally-gold)]" />
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            System Vehicles
          </h1>
          <Badge variant="default" size="md">
            {filteredVehicles.length}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-[var(--text-secondary)]">
        All vehicles across all tenants. Monitor inventory, status, and aging system-wide.
      </p>

      {/* Filter Bar */}
      <FilterBar
        options={filterOptionsWithCounts}
        selected={statusFilter}
        onSelect={setStatusFilter}
      />

      {/* Search */}
      <Input
        placeholder="Search by stock #, VIN, or make/model..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        startIcon={<Search className="h-4 w-4" />}
      />

      {/* Empty State */}
      {!loading && filteredVehicles.length === 0 && (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description={
            search
              ? `No vehicles match "${search}". Try a different search term.`
              : 'No vehicles match the current filters.'
          }
        />
      )}

      {/* Data Table */}
      {(loading || filteredVehicles.length > 0) && (
        <DataTable<SystemVehicle>
          columns={columns}
          data={filteredVehicles}
          loading={loading}
          globalFilter={search}
          emptyIcon={Car}
          emptyMessage="No vehicles found"
          emptyDescription="Try adjusting your search or filters."
          defaultPageSize={25}
          onRowClick={() => {
            // TODO: Navigate to vehicle detail cross-tenant view
          }}
        />
      )}
    </div>
  );
}
