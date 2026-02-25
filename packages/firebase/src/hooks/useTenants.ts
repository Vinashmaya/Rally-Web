'use client';

// Domain hook: dealer group (tenant) collection listener (admin-only)
// No dealershipId scoping — returns all groups
// Supports client-side search on name
// Firestore collection: groups

import { useMemo } from 'react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { DealerGroup } from '../types/tenant';

interface UseTenantsOptions {
  search?: string; // Client-side filter on name
}

interface UseTenantsReturn {
  tenants: DealerGroup[];
  loading: boolean;
  error: Error | null;
}

export function useTenants(options: UseTenantsOptions = {}): UseTenantsReturn {
  const { search } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      orderBy('name', 'asc'),
    ];
    return c;
  }, []);

  // Stable key — no variable parameters for the Firestore query
  const constraintKey = 'groups:all';

  const { data, loading, error } = useCollection<DealerGroup>(
    'groups',
    constraints,
    constraintKey,
  );

  // Client-side search filter
  const tenants = useMemo(() => {
    if (!search || !search.trim()) return data;

    const term = search.toLowerCase().trim();
    return data.filter((g) => {
      const searchable = g.name.toLowerCase();
      return searchable.includes(term);
    });
  }, [data, search]);

  return { tenants, loading, error };
}
