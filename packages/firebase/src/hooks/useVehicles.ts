'use client';

// Domain hook: vehicle collection listener scoped to a dealership
// Supports status filtering and client-side search (Firestore has no full-text search)

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { Vehicle, VehicleStatus } from '../types/vehicle';

interface UseVehiclesOptions {
  dealershipId: string;
  status?: VehicleStatus;
  search?: string; // Client-side filter on stockNumber, vin, year+make+model+trim
}

interface UseVehiclesReturn {
  vehicles: Vehicle[];
  loading: boolean;
  error: Error | null;
}

export function useVehicles(options: UseVehiclesOptions): UseVehiclesReturn {
  const { dealershipId, status, search } = options;

  // Build Firestore constraints — memoized so useCollection only re-subscribes
  // when the actual query parameters change
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
    ];

    if (status) {
      c.push(where('status', '==', status));
    }

    c.push(orderBy('stockNumber', 'asc'));

    return c;
  }, [dealershipId, status]);

  // Stable key for useCollection's dependency tracking — captures actual values
  const constraintKey = `vehicles:${dealershipId}:${status ?? 'all'}`;

  const { data, loading, error } = useCollection<Vehicle>('vehicles', constraints, constraintKey);

  // Client-side search filter (Firestore doesn't support full-text search)
  const vehicles = useMemo(() => {
    if (!search || !search.trim()) return data;

    const term = search.toLowerCase().trim();
    return data.filter((v) => {
      const searchable = `${v.stockNumber} ${v.vin} ${v.year} ${v.make} ${v.model} ${v.trim ?? ''}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [data, search]);

  return { vehicles, loading, error };
}
