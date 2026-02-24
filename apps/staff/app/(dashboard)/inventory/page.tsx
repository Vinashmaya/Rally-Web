'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Store } from 'lucide-react';
import { Button, EmptyState } from '@rally/ui';
import { useToast } from '@rally/ui';
import {
  useVehicles,
  VEHICLE_STATUS_VALUES,
  VEHICLE_STATUS_DISPLAY,
  type VehicleStatus,
  type Vehicle,
} from '@rally/firebase';
import { useTenantStore } from '@rally/services';
import { InventoryHeader, type SortOption } from './components/InventoryHeader';
import { VehicleGrid } from './components/VehicleGrid';

// ---------------------------------------------------------------------------
// Status Filter Chips
// ---------------------------------------------------------------------------

const STATUS_FILTERS: Array<{ value: VehicleStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  ...VEHICLE_STATUS_VALUES.map((status) => ({
    value: status,
    label: VEHICLE_STATUS_DISPLAY[status].displayName,
  })),
];

// ---------------------------------------------------------------------------
// Debounce hook
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Client-side sort
// ---------------------------------------------------------------------------

function sortVehicles(vehicles: Vehicle[], sortBy: SortOption): Vehicle[] {
  const sorted = [...vehicles];

  switch (sortBy) {
    case 'stockNumber':
      sorted.sort((a, b) => a.stockNumber.localeCompare(b.stockNumber, undefined, { numeric: true }));
      break;
    case 'daysOnLot':
      sorted.sort((a, b) => (b.daysOnLot ?? 0) - (a.daysOnLot ?? 0));
      break;
    case 'priceAsc':
      sorted.sort((a, b) => (a.internetPrice ?? Infinity) - (b.internetPrice ?? Infinity));
      break;
    case 'priceDesc':
      sorted.sort((a, b) => (b.internetPrice ?? 0) - (a.internetPrice ?? 0));
      break;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Inventory Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Tenant state
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  // Local UI state
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<VehicleStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('stockNumber');

  // Debounce search input by 300ms
  const debouncedSearch = useDebouncedValue(search, 300);

  // Firestore real-time subscription
  const statusFilter = activeFilter === 'all' ? undefined : activeFilter;
  const { vehicles: rawVehicles, loading, error } = useVehicles({
    dealershipId,
    status: statusFilter,
    search: debouncedSearch,
  });

  // Surface errors as toasts
  useEffect(() => {
    if (error) {
      toast({
        type: 'error',
        title: 'Failed to load inventory',
        description: error.message,
      });
    }
  }, [error, toast]);

  // Client-side sort
  const vehicles = useMemo(
    () => sortVehicles(rawVehicles, sortBy),
    [rawVehicles, sortBy],
  );

  // Total count (pre-search, pre-filter) — use rawVehicles length for filtered count
  // The "total" is the Firestore result before client-side search; when no status filter,
  // that's the full inventory. When status filter is active, it's scoped to that status.
  const totalCount = rawVehicles.length;
  const filteredCount = vehicles.length;

  // Navigation
  const handleVehicleClick = useCallback(
    (vin: string) => {
      router.push(`/inventory/${vin}`);
    },
    [router],
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearch('');
    setActiveFilter('all');
    setSortBy('stockNumber');
  }, []);

  // Guard: no active store
  if (!activeStore) {
    return (
      <EmptyState
        icon={Store}
        title="Select a store"
        description="Choose a store from the sidebar to view its inventory."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: search + sort + count */}
      <InventoryHeader
        search={search}
        onSearch={setSearch}
        totalCount={totalCount}
        filteredCount={filteredCount}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeFilter === filter.value
                ? 'bg-rally-goldMuted text-rally-gold border border-rally-gold/30'
                : 'bg-surface-overlay text-text-secondary border border-surface-border hover:border-surface-borderHover'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Vehicle grid / empty state */}
      {!loading && vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Adjust your filters or search terms. Vehicles from your store's inventory will appear here."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <VehicleGrid
          vehicles={vehicles}
          loading={loading}
          onVehicleClick={handleVehicleClick}
        />
      )}
    </div>
  );
}
