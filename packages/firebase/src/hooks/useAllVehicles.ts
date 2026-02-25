'use client';

// Domain hook: cross-tenant vehicle listener via collection group query
// Uses useCollectionGroup to query `vehicles` across all tenants
// Supports client-side search and status filtering

import { useMemo } from 'react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
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

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      orderBy('stockNumber', 'asc'),
    ];
    return c;
  }, []);

  // Stable key — no variable Firestore parameters
  const constraintKey = 'allVehicles:vehicles';

  const { data, loading, error } = useCollectionGroup<Vehicle>(
    'vehicles',
    constraints,
    constraintKey,
  );

  // Client-side filtering for status and search
  const allVehicles = useMemo(() => {
    let filtered = data;

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
