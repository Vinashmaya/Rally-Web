'use client';

// Domain hook: cross-tenant vehicle activity listener via collection group query
// Uses useCollectionGroup to query `vehicleActivities` across all tenants
// Returns most recent activities ordered by startedAt desc, limited to configurable count

import { useMemo } from 'react';
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

  // No orderBy/limit — collection group queries require explicit indexes.
  // Sort and limit client-side after fetch instead.
  const constraintKey = 'allActivities:vehicleActivities';

  const { data, loading, error } = useCollectionGroup<VehicleActivity>(
    'vehicleActivities',
    [],
    constraintKey,
  );

  // Client-side sort (desc by startedAt) + limit
  const allActivities = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aTime = (a.startedAt as unknown as { seconds?: number })?.seconds ?? 0;
      const bTime = (b.startedAt as unknown as { seconds?: number })?.seconds ?? 0;
      return bTime - aTime; // desc
    });
    return sorted.slice(0, limitCount);
  }, [data, limitCount]);

  return { allActivities, loading, error };
}
