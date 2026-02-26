'use client';

// Domain hook: cross-tenant vehicle listener via collection group query
// Uses useCollectionGroup to query `vehicles` across all tenants
// Supports client-side search and status filtering

import { useMemo } from 'react';
import { useCollectionGroup } from './useFirestore';
import type { Vehicle } from '../types/vehicle';

interface UseAllVehiclesOptions {
  search?: string; // Client-side filter on stockNumber, vin, year+make+model+trim
  status?: string;
}

interface UseAllVehiclesReturn {
  allVehicles: Vehicle[];
  loading: boolean;
  error: Error | null;
}

export function useAllVehicles(options: UseAllVehiclesOptions = {}): UseAllVehiclesReturn {
  const { search, status } = options;

  // No orderBy — collection group queries require explicit indexes.
  // Sort client-side after fetch instead.
  const constraintKey = 'allVehicles:vehicles';

  const { data, loading, error } = useCollectionGroup<Vehicle>(
    'vehicles',
    [],
    constraintKey,
  );

  // Client-side sorting + filtering (avoids needing collection group index)
  const allVehicles = useMemo(() => {
    let filtered = [...data].sort((a, b) =>
      (a.stockNumber ?? '').localeCompare(b.stockNumber ?? '', undefined, { numeric: true }),
    );

    if (status) {
      filtered = filtered.filter((v) => v.status === status);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((v) => {
        const searchable = `${v.stockNumber} ${v.vin} ${v.year} ${v.make} ${v.model} ${v.trim ?? ''}`.toLowerCase();
        return searchable.includes(term);
      });
    }

    return filtered;
  }, [data, status, search]);

  return { allVehicles, loading, error };
}
