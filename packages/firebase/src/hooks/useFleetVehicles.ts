'use client';

// Domain hook: fleet vehicle collection listener scoped to a dealership
// Supports source filtering (ghost/kahu)
// Firestore collection: fleetVehicles

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { FleetVehicle, FleetVehicleSource } from '../types/fleet';

interface UseFleetVehiclesOptions {
  dealershipId: string;
  source?: FleetVehicleSource;
}

interface UseFleetVehiclesReturn {
  fleetVehicles: FleetVehicle[];
  loading: boolean;
  error: Error | null;
}

export function useFleetVehicles(options: UseFleetVehiclesOptions): UseFleetVehiclesReturn {
  const { dealershipId, source } = options;

  // Build Firestore constraints — memoized so useCollection only re-subscribes
  // when the actual query parameters change
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
    ];

    if (source) {
      c.push(where('source', '==', source));
    }

    c.push(orderBy('lastUpdate', 'desc'));

    return c;
  }, [dealershipId, source]);

  // Stable key — captures dealershipId and source value
  const constraintKey = `fleetVehicles:${dealershipId}:${source ?? 'all'}`;

  const { data, loading, error } = useCollection<FleetVehicle>(
    'fleetVehicles',
    constraints,
    constraintKey,
  );

  return { fleetVehicles: data, loading, error };
}
