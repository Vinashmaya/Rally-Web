'use client';

// Domain hook: battery report collection listener scoped to a dealership
// Returns reports ordered by lastEventTime descending
// Firestore collection: batteryReports

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { BatteryReport } from '../types/fleet';

interface UseBatteryReportsOptions {
  dealershipId: string;
}

interface UseBatteryReportsReturn {
  batteryReports: BatteryReport[];
  loading: boolean;
  error: Error | null;
}

export function useBatteryReports(options: UseBatteryReportsOptions): UseBatteryReportsReturn {
  const { dealershipId } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('lastEventTime', 'desc'),
    ];
    return c;
  }, [dealershipId]);

  // Stable key — captures dealershipId
  const constraintKey = `batteryReports:${dealershipId}`;

  const { data, loading, error } = useCollection<BatteryReport>(
    'batteryReports',
    constraints,
    constraintKey,
  );

  return { batteryReports: data, loading, error };
}
