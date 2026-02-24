'use client';

import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@rally/ui';

// ---------------------------------------------------------------------------
// Sort Options
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'stockNumber', label: 'Stock #' },
  { value: 'daysOnLot', label: 'Days on Lot' },
  { value: 'priceAsc', label: 'Price (Low)' },
  { value: 'priceDesc', label: 'Price (High)' },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]['value'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InventoryHeaderProps {
  search: string;
  onSearch: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InventoryHeader({
  search,
  onSearch,
  totalCount,
  filteredCount,
  sortBy,
  onSortChange,
}: InventoryHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Inventory</h1>
          <span className="text-sm text-text-secondary">
            {filteredCount === totalCount
              ? `${totalCount} vehicles`
              : `Showing ${filteredCount} of ${totalCount}`}
          </span>
        </div>

        {/* Sort dropdown */}
        <div className="relative flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5 text-text-tertiary" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-8 appearance-none rounded-rally border border-surface-border bg-surface-overlay px-3 pr-7 text-xs text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-rally-gold focus:ring-offset-2 focus:ring-offset-surface-base"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by stock #, VIN, year, make, model..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        startIcon={<Search className="h-4 w-4" />}
      />
    </div>
  );
}
