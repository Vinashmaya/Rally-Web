'use client';

// Domain hook: vehicle lists for a user at a dealership
// Returns lists the user owns, lists shared with them, and dealership-wide shared lists
// Firestore collection: vehicleLists

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { VehicleList } from '../types/list';

interface UseVehicleListsOptions {
  dealershipId: string;
  userId: string;
}

interface UseVehicleListsReturn {
  lists: VehicleList[];
  loading: boolean;
  error: Error | null;
}

export function useVehicleLists(options: UseVehicleListsOptions): UseVehicleListsReturn {
  const { dealershipId, userId } = options;

  // Query all lists at this dealership, then filter client-side for access.
  // Firestore doesn't support OR across different fields in a single query,
  // so we scope by dealershipId and filter for ownership/sharing client-side.
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('updatedAt', 'desc'),
    ];
    return c;
  }, [dealershipId]);

  const constraintKey = `vehicleLists:${dealershipId}`;

  const { data, loading, error } = useCollection<VehicleList>(
    'vehicleLists',
    constraints,
    constraintKey,
  );

  // Client-side access filter:
  // - User owns the list (ownerId)
  // - User is in the sharedWith array
  // - List is shared with entire dealership (isShared)
  const lists = useMemo(() => {
    return data.filter((list) =>
      list.ownerId === userId ||
      (list.sharedWith && list.sharedWith.includes(userId)) ||
      list.isShared === true
    );
  }, [data, userId]);

  return { lists, loading, error };
}
