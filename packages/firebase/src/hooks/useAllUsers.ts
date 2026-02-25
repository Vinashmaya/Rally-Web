'use client';

// Domain hook: cross-tenant user listener via collection group query
// Uses useCollectionGroup to query `memberships` across all tenants
// Supports client-side search and role filtering

import { useMemo } from 'react';
import { orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollectionGroup } from './useFirestore';
import type { StoreMembership } from '../types/tenant';

interface UseAllUsersOptions {
  search?: string; // Client-side filter on employeeUid, role
  role?: string;
}

interface UseAllUsersReturn {
  allUsers: StoreMembership[];
  loading: boolean;
  error: Error | null;
}

export function useAllUsers(options: UseAllUsersOptions = {}): UseAllUsersReturn {
  const { search, role } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      orderBy('joinedAt', 'desc'),
    ];
    return c;
  }, []);

  // Stable key — no variable Firestore parameters
  const constraintKey = 'allUsers:memberships';

  const { data, loading, error } = useCollectionGroup<StoreMembership>(
    'memberships',
    constraints,
    constraintKey,
  );

  // Client-side filtering for role and search
  const allUsers = useMemo(() => {
    let filtered = data;

    if (role) {
      filtered = filtered.filter((m) => m.role === role);
    }

    if (search && search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter((m) => {
        const searchable = `${m.employeeUid} ${m.role} ${m.storeId} ${m.groupId}`.toLowerCase();
        return searchable.includes(term);
      });
    }

    return filtered;
  }, [data, role, search]);

  return { allUsers, loading, error };
}
