'use client';

// Domain hook: cross-tenant vehicle listener via regular collection query
// Queries top-level `vehicles` collection filtered to inventory docs (have dealershipId)
// Excludes vehicle research/reference docs that lack dealershipId
// Supports client-side search and status filtering

import { useMemo } from 'react';
import { where } from 'firebase/firestore';
import { useCollection } from './useFirestore';
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

  // Filter to inventory vehicles only (have dealershipId).
  // The top-level `vehicles` collection also contains ~1,700 reference docs
  // (keyed by year-make-model-trim) that lack dealershipId/stockNumber/vin.
  const constraints = useMemo(() => [
    where('dealershipId', '!=', ''),
  ], []);

  const constraintKey = 'allVehicles:vehicles:hasDealershipId';

  const { data, loading, error } = useCollection<Vehicle>(
    'vehicles',
    constraints,
    constraintKey,
  );

  // Client-side sorting + filtering
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
