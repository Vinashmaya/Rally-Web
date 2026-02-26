'use client';

// Domain hook: cross-tenant user listener via collection group query
// Uses useCollectionGroup to query `memberships` across all tenants
// Supports client-side search and role filtering

import { useMemo } from 'react';
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

  // No orderBy — collection group queries require explicit indexes.
  // Sort client-side after fetch instead.
  const constraintKey = 'allUsers:memberships';

  const { data, loading, error } = useCollectionGroup<StoreMembership>(
    'memberships',
    [],
    constraintKey,
  );

  // Client-side sorting + filtering (avoids needing collection group index)
  const allUsers = useMemo(() => {
    let filtered = [...data].sort((a, b) => {
      const aTime = (a.joinedAt as unknown as { seconds?: number })?.seconds ?? 0;
      const bTime = (b.joinedAt as unknown as { seconds?: number })?.seconds ?? 0;
      return bTime - aTime; // desc
    });

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
