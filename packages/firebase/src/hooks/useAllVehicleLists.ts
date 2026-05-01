'use client';

// Domain hook: ALL vehicle lists for a dealership (manager view)
// Unlike useVehicleLists which filters client-side for the current user's access,
// this hook returns every list at the dealership — for GM/Principal oversight.
// Firestore collection: vehicleLists

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { VehicleList } from '../types/list';

interface UseAllVehicleListsOptions {
  dealershipId: string;
}

interface UseAllVehicleListsReturn {
  lists: VehicleList[];
  loading: boolean;
  error: Error | null;
}

export function useAllVehicleLists(
  options: UseAllVehicleListsOptions,
): UseAllVehicleListsReturn {
  const { dealershipId } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('updatedAt', 'desc'),
    ];
    return c;
  }, [dealershipId]);

  const constraintKey = `allVehicleLists:${dealershipId}`;

  const { data, loading, error } = useCollection<VehicleList>(
    'vehicleLists',
    constraints,
    constraintKey,
  );

  return { lists: data, loading, error };
}
