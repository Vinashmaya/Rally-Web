'use client';

// Domain hook: activity feed listener scoped to a dealership
// Returns recent activities ordered by startedAt descending
// Firestore collection: vehicleActivities

import { useMemo } from 'react';
import { where, orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { VehicleActivity } from '../types/activity';

interface UseActivitiesOptions {
  dealershipId: string;
  limitCount?: number; // default 50
}

interface UseActivitiesReturn {
  activities: VehicleActivity[];
  loading: boolean;
  error: Error | null;
}

export function useActivities(options: UseActivitiesOptions): UseActivitiesReturn {
  const { dealershipId, limitCount = 50 } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('startedAt', 'desc'),
      limit(limitCount),
    ];
    return c;
  }, [dealershipId, limitCount]);

  // Stable key — captures dealershipId and limit value
  const constraintKey = `activities:${dealershipId}:${limitCount}`;

  const { data, loading, error } = useCollection<VehicleActivity>(
    'vehicleActivities',
    constraints,
    constraintKey,
  );

  return { activities: data, loading, error };
}
