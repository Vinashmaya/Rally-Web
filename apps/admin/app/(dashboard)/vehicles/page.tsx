'use client';

import { useState, useMemo } from 'react';
import {
  Badge,
  Input,
  EmptyState,
  FilterBar,
  DataTable,
} from '@rally/ui';
import type { FilterOption } from '@rally/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Car,
  Search,
  Image as ImageIcon,
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
  status: VehicleActivityStatus;
  daysOnLot: number;
  dealershipId: string;
  primaryPhotoUrl?: string;
  tenantName: string;
  tenantSlug: string;
}

type VehicleActivityStatus = 'available' | 'testDrive' | 'showVideo' | 'offLot' | 'sold';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DISPLAY: Record<VehicleActivityStatus, string> = {
  available: 'Available',
  testDrive: 'Test Drive',
  showVideo: 'Showing',
  offLot: 'Off Lot',
  sold: 'Sold',
} as const;

const STATUS_COLORS: Record<VehicleActivityStatus, string> = {
  available: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  testDrive: 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30',
  showVideo: 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
  offLot: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
  sold: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
} as const;

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'testDrive', label: 'Test Drive' },
  { value: 'showVideo', label: 'Showing' },
  { value: 'offLot', label: 'Off Lot' },
  { value: 'sold', label: 'Sold' },
] as const;

const TENANT_COLORS: Record<string, string> = {
  'gallatin-cdjr': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'music-city-toyota': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'franklin-chevrolet': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'hendersonville-ford': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
} as const;

// ---------------------------------------------------------------------------
// Mock Data — 24 vehicles across 4 tenants
// ---------------------------------------------------------------------------

const MOCK_VEHICLES: SystemVehicle[] = [
  // Gallatin CDJR
  { id: 'v-001', vin: '1C4RJFBG9LC123456', stockNumber: 'G2401', year: 2024, make: 'Jeep', model: 'Grand Cherokee', trim: 'Limited', color: 'Diamond Black', status: 'available', daysOnLot: 12, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr', primaryPhotoUrl: undefined },
  { id: 'v-002', vin: '2C3CDXCT5NH234567', stockNumber: 'G2402', year: 2024, make: 'Dodge', model: 'Charger', trim: 'R/T', color: 'Torred', status: 'testDrive', daysOnLot: 8, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr' },
  { id: 'v-003', vin: '1C6SRFFT9PN345678', stockNumber: 'G2403', year: 2024, make: 'Ram', model: '1500', trim: 'Laramie', color: 'Granite Crystal', status: 'available', daysOnLot: 45, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr' },
  { id: 'v-004', vin: '3C6UR5DL7PG456789', stockNumber: 'G2404', year: 2024, make: 'Ram', model: '2500', trim: 'Big Horn', color: 'Patriot Blue', status: 'offLot', daysOnLot: 32, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr' },
  { id: 'v-005', vin: 'ZACNRFBV5PPP56789', stockNumber: 'G2405', year: 2024, make: 'Chrysler', model: 'Pacifica', trim: 'Touring L', color: 'Bright White', status: 'sold', daysOnLot: 67, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr' },
  { id: 'v-006', vin: '1C4PJXDG2PW567890', stockNumber: 'G2406', year: 2024, make: 'Jeep', model: 'Wrangler', trim: 'Rubicon', color: 'Sarge Green', status: 'showVideo', daysOnLot: 5, dealershipId: 'gallatin-cdjr', tenantName: 'Gallatin CDJR', tenantSlug: 'gallatin-cdjr' },

  // Music City Toyota
  { id: 'v-007', vin: '4T1BZ1HK5LU678901', stockNumber: 'MC3001', year: 2025, make: 'Toyota', model: 'Camry', trim: 'XSE', color: 'Celestial Silver', status: 'available', daysOnLot: 14, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },
  { id: 'v-008', vin: '5TDKZ3DC8LS789012', stockNumber: 'MC3002', year: 2025, make: 'Toyota', model: 'Highlander', trim: 'XLE', color: 'Magnetic Gray', status: 'available', daysOnLot: 22, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },
  { id: 'v-009', vin: 'JTDKN3DU9L5890123', stockNumber: 'MC3003', year: 2025, make: 'Toyota', model: 'Prius', trim: 'Limited', color: 'Wind Chill Pearl', status: 'testDrive', daysOnLot: 3, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },
  { id: 'v-010', vin: '5TFBY5F11LX901234', stockNumber: 'MC3004', year: 2025, make: 'Toyota', model: 'Tundra', trim: 'TRD Pro', color: 'Solar Octane', status: 'available', daysOnLot: 91, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },
  { id: 'v-011', vin: '2T1BURHE9LC012345', stockNumber: 'MC3005', year: 2025, make: 'Toyota', model: 'Corolla', trim: 'SE', color: 'Blueprint', status: 'sold', daysOnLot: 28, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },
  { id: 'v-012', vin: 'JTEBU5JR5P5123456', stockNumber: 'MC3006', year: 2025, make: 'Toyota', model: '4Runner', trim: 'TRD Off-Road', color: 'Lunar Rock', status: 'showVideo', daysOnLot: 7, dealershipId: 'music-city-toyota', tenantName: 'Music City Toyota', tenantSlug: 'music-city-toyota' },

  // Franklin Chevrolet
  { id: 'v-013', vin: '1G1YC2D40P5234567', stockNumber: 'FC5501', year: 2025, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', color: 'Torch Red', status: 'available', daysOnLot: 19, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },
  { id: 'v-014', vin: '3GCUDED00PG345678', stockNumber: 'FC5502', year: 2025, make: 'Chevrolet', model: 'Silverado', trim: 'High Country', color: 'Black', status: 'testDrive', daysOnLot: 11, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },
  { id: 'v-015', vin: '1G1FE6S09P0456789', stockNumber: 'FC5503', year: 2025, make: 'Chevrolet', model: 'Camaro', trim: 'SS', color: 'Rally Green', status: 'available', daysOnLot: 55, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },
  { id: 'v-016', vin: '1GCVKNEK7PZ567890', stockNumber: 'FC5504', year: 2025, make: 'Chevrolet', model: 'Tahoe', trim: 'Z71', color: 'Empire Beige', status: 'offLot', daysOnLot: 38, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },
  { id: 'v-017', vin: '1G1RC6S50P0678901', stockNumber: 'FC5505', year: 2025, make: 'Chevrolet', model: 'Malibu', trim: 'RS', color: 'Silver Ice', status: 'sold', daysOnLot: 42, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },
  { id: 'v-018', vin: '1GNLVGED4PJ789012', stockNumber: 'FC5506', year: 2025, make: 'Chevrolet', model: 'Traverse', trim: 'LT', color: 'Summit White', status: 'available', daysOnLot: 25, dealershipId: 'franklin-chevrolet', tenantName: 'Franklin Chevrolet', tenantSlug: 'franklin-chevrolet' },

  // Hendersonville Ford
  { id: 'v-019', vin: '1FTFW1E80PFB89012', stockNumber: 'HF7701', year: 2025, make: 'Ford', model: 'F-150', trim: 'Lariat', color: 'Atlas Blue', status: 'available', daysOnLot: 16, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
  { id: 'v-020', vin: '1FM5K8GC7PGA90123', stockNumber: 'HF7702', year: 2025, make: 'Ford', model: 'Explorer', trim: 'ST', color: 'Rapid Red', status: 'testDrive', daysOnLot: 9, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
  { id: 'v-021', vin: '3FMCR9B69PRE01234', stockNumber: 'HF7703', year: 2025, make: 'Ford', model: 'Bronco Sport', trim: 'Badlands', color: 'Cactus Gray', status: 'available', daysOnLot: 73, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
  { id: 'v-022', vin: '1FMSK8DH5PGB12345', stockNumber: 'HF7704', year: 2025, make: 'Ford', model: 'Expedition', trim: 'King Ranch', color: 'Star White', status: 'showVideo', daysOnLot: 4, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
  { id: 'v-023', vin: '1FA6P8TH5P5523456', stockNumber: 'HF7705', year: 2025, make: 'Ford', model: 'Mustang', trim: 'GT', color: 'Grabber Blue', status: 'offLot', daysOnLot: 21, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
  { id: 'v-024', vin: '1FMEE5DP4PLA34567', stockNumber: 'HF7706', year: 2025, make: 'Ford', model: 'Escape', trim: 'Titanium', color: 'Carbonized Gray', status: 'sold', daysOnLot: 36, dealershipId: 'hendersonville-ford', tenantName: 'Hendersonville Ford', tenantSlug: 'hendersonville-ford' },
] as const;

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
      const colorClass = STATUS_COLORS[status] ?? '';
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${colorClass}`}>
          {status !== 'available' && status !== 'sold' && (
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
  const [loading, setLoading] = useState(false);

  // TODO: Replace with real Firestore collectionGroup query across all tenants
  const vehicles = MOCK_VEHICLES as unknown as SystemVehicle[];

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
