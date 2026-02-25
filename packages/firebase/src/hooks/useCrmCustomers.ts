'use client';

// Domain hook: CRM customer collection listener scoped to a dealership
// Supports client-side search on fullName (Firestore has no full-text search)
// Firestore collection: crmCustomers

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { CrmCustomer } from '../types/crm';

interface UseCrmCustomersOptions {
  dealershipId: string;
  search?: string; // Client-side filter on fullName
}

interface UseCrmCustomersReturn {
  customers: CrmCustomer[];
  loading: boolean;
  error: Error | null;
}

export function useCrmCustomers(options: UseCrmCustomersOptions): UseCrmCustomersReturn {
  const { dealershipId, search } = options;

  // Build Firestore constraints
  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('updatedAt', 'desc'),
    ];
    return c;
  }, [dealershipId]);

  // Stable key — captures dealershipId
  const constraintKey = `crmCustomers:${dealershipId}`;

  const { data, loading, error } = useCollection<CrmCustomer>(
    'crmCustomers',
    constraints,
    constraintKey,
  );

  // Client-side search filter (Firestore doesn't support full-text search)
  const customers = useMemo(() => {
    if (!search || !search.trim()) return data;

    const term = search.toLowerCase().trim();
    return data.filter((c) => {
      const searchable = `${c.fullName} ${c.email ?? ''} ${c.phone ?? ''} ${c.vehicleOfInterest ?? ''}`.toLowerCase();
      return searchable.includes(term);
    });
  }, [data, search]);

  return { customers, loading, error };
}
