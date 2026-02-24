'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Search, ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
  VehicleCard,
  FilterBar,
  Skeleton,
  EmptyState,
  Button,
  Input,
  Badge,
  type FilterOption,
} from '@rally/ui';
import { useToast } from '@rally/ui';
import {
  useVehicles,
  VEHICLE_STATUS_VALUES,
  VEHICLE_STATUS_DISPLAY,
  type VehicleStatus,
  type Vehicle,
} from '@rally/firebase';
import { useTenantStore } from '@rally/services';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_FILTERS: FilterOption[] = [
  { value: 'all', label: 'All' },
  ...VEHICLE_STATUS_VALUES.map((status) => ({
    value: status,
    label: VEHICLE_STATUS_DISPLAY[status].displayName,
  })),
] as const;

type SortOption = 'newest' | 'oldest' | 'priceAsc' | 'priceDesc' | 'daysOnLot';

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'priceAsc', label: 'Price: Low to High' },
  { value: 'priceDesc', label: 'Price: High to Low' },
  { value: 'daysOnLot', label: 'Days on Lot' },
] as const;

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
    case 'newest':
      sorted.sort((a, b) => {
        const aDate = a.addedToInventoryAt ? new Date(a.addedToInventoryAt).getTime() : 0;
        const bDate = b.addedToInventoryAt ? new Date(b.addedToInventoryAt).getTime() : 0;
        return bDate - aDate;
      });
      break;
    case 'oldest':
      sorted.sort((a, b) => {
        const aDate = a.addedToInventoryAt ? new Date(a.addedToInventoryAt).getTime() : 0;
        const bDate = b.addedToInventoryAt ? new Date(b.addedToInventoryAt).getTime() : 0;
        return aDate - bDate;
      });
      break;
    case 'priceAsc':
      sorted.sort((a, b) => (a.internetPrice ?? Infinity) - (b.internetPrice ?? Infinity));
      break;
    case 'priceDesc':
      sorted.sort((a, b) => (b.internetPrice ?? 0) - (a.internetPrice ?? 0));
      break;
    case 'daysOnLot':
      sorted.sort((a, b) => (b.daysOnLot ?? 0) - (a.daysOnLot ?? 0));
      break;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InventorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-72" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PortalInventoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Tenant state
  const activeStore = useTenantStore((s) => s.activeStore);
  const dealershipId = activeStore?.id ?? '';

  // Local UI state
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [sortOpen, setSortOpen] = useState(false);

  // Debounce search input by 300ms
  const debouncedSearch = useDebouncedValue(search, 300);

  // Firestore real-time subscription
  const statusFilter = activeFilter === 'all' ? undefined : (activeFilter as VehicleStatus);
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

  // Filter options with counts
  const filterOptionsWithCounts = useMemo((): FilterOption[] => {
    return STATUS_FILTERS.map((opt) => ({
      ...opt,
      count: opt.value === 'all'
        ? rawVehicles.length
        : rawVehicles.filter((v) => v.status === opt.value).length,
    }));
  }, [rawVehicles]);

  // Client-side sort
  const vehicles = useMemo(
    () => sortVehicles(rawVehicles, sortBy),
    [rawVehicles, sortBy],
  );

  const vehicleCount = vehicles.length;

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
    setSortBy('newest');
  }, []);

  // Current sort label
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort';

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Inventory</h1>
          {!loading && (
            <Badge variant="default" size="sm">
              {vehicleCount} vehicles
            </Badge>
          )}
        </div>
      </div>

      {/* Search + Sort Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search stock #, VIN, make, model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-rally bg-surface-overlay border border-surface-border text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-rally-gold transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            className="flex items-center gap-2 h-9 px-3 rounded-rally bg-surface-overlay border border-surface-border text-sm text-text-secondary hover:text-text-primary hover:border-surface-borderHover transition-colors"
          >
            {currentSortLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-rally bg-surface-raised border border-surface-border shadow-rally-lg py-1">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSortBy(option.value);
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-2 text-xs transition-colors ${
                    sortBy === option.value
                      ? 'text-rally-gold bg-rally-goldMuted/50'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-overlay'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Filter Chips */}
      <FilterBar
        options={activeFilter === 'all' ? filterOptionsWithCounts : filterOptionsWithCounts}
        selected={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Vehicle Grid / Empty State / Loading */}
      {loading ? (
        <InventorySkeleton />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No vehicles found"
          description="Adjust your filters or search terms. Vehicles from your dealership inventory will appear here."
          action={
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.vin}
              stockNumber={vehicle.stockNumber}
              vin={vehicle.vin}
              year={vehicle.year}
              make={vehicle.make}
              model={vehicle.model}
              trim={vehicle.trim}
              status={vehicle.status as VehicleStatus}
              exteriorColor={vehicle.exteriorColor}
              internetPrice={vehicle.internetPrice}
              primaryPhotoUrl={vehicle.primaryPhotoUrl}
              daysOnLot={vehicle.daysOnLot}
              holdInfo={
                vehicle.holdInfo
                  ? { userName: vehicle.holdInfo.customerName ?? 'Unknown' }
                  : undefined
              }
              onPress={() => handleVehicleClick(vehicle.vin)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
