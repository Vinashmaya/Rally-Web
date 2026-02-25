'use client';

// Domain hook: cross-tenant vehicle activity listener via collection group query
// Uses useCollectionGroup to query `vehicleActivities` across all tenants
// Returns most recent activities ordered by startedAt desc, limited to configurable count

import { useMemo } from 'react';
import { orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import { useCollectionGroup } from './useFirestore';
import type { VehicleActivity } from '../types/activity';

interface UseAllActivitiesOptions {
  limitCount?: number; // default 50
}

interface UseAllActivitiesReturn {
  allActivities: VehicleActivity[];
  loading: boolean;
  error: Error | null;
}

export function useAllActivities(options: UseAllActivitiesOptions = {}): UseAllActivitiesReturn {
  const { limitCount = 50 } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      orderBy('startedAt', 'desc'),
      limit(limitCount),
    ];
    return c;
  }, [limitCount]);

  // Stable key — captures limit value
  const constraintKey = `allActivities:vehicleActivities:${limitCount}`;

  const { data, loading, error } = useCollectionGroup<VehicleActivity>(
    'vehicleActivities',
    constraints,
    constraintKey,
  );

  return { allActivities: data, loading, error };
}
