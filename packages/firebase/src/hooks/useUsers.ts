'use client';

// Domain hook: user collection listener scoped to a dealership
// Supports role filtering and client-side search

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { DealerUser, UserRole } from '../types/user';

interface UseUsersOptions {
  dealershipId: string;
  role?: UserRole;
  search?: string; // Client-side filter on displayName, email
}

interface UseUsersReturn {
  users: DealerUser[];
  loading: boolean;
  error: Error | null;
}

export function useUsers(options: UseUsersOptions): UseUsersReturn {
  const { dealershipId, role, search } = options;

  // Build Firestore constraints
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
    ];

    if (role) {
      c.push(where('role', '==', role));
    }

    c.push(orderBy('displayName', 'asc'));

    return c;
  }, [dealershipId, role]);

  // Stable key for useCollection's dependency tracking
  const constraintKey = `users:${dealershipId}:${role ?? 'all'}`;

  const { data, loading, error } = useCollection<DealerUser>('users', constraints, constraintKey);

  // Client-side search filter
  const users = useMemo(() => {
    if (!search || !search.trim()) return data;

    const term = search.toLowerCase().trim();
    return data.filter((u) => {
      const searchable = `${u.displayName} ${u.email} ${u.phone ?? ''}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [data, search]);

  return { users, loading, error };
}
