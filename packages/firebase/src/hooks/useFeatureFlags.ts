'use client';

// Domain hook: feature flags collection listener (system-wide)
// No scoping — returns all feature flags
// Firestore collection: featureFlags

import { useMemo } from 'react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { FeatureFlag } from '../types/system';

interface UseFeatureFlagsReturn {
  featureFlags: FeatureFlag[];
  loading: boolean;
  error: Error | null;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      orderBy('key', 'asc'),
    ];
    return c;
  }, []);

  // Stable key — no variable parameters
  const constraintKey = 'featureFlags:all';

  const { data, loading, error } = useCollection<FeatureFlag>(
    'featureFlags',
    constraints,
    constraintKey,
  );

  return { featureFlags: data, loading, error };
}
