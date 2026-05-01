'use client';

// Domain hook: NFC tag inventory listener scoped to a dealership
// Returns tags ordered by lastScannedAt descending (recently tapped first)
// Firestore collection: nfcTags

import { useMemo } from 'react';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { NFCTag } from '../types/nfc';

interface UseNfcTagsOptions {
  dealershipId: string;
}

interface UseNfcTagsReturn {
  tags: NFCTag[];
  loading: boolean;
  error: Error | null;
}

export function useNfcTags(options: UseNfcTagsOptions): UseNfcTagsReturn {
  const { dealershipId } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [
      where('dealershipId', '==', dealershipId),
      orderBy('lastScannedAt', 'desc'),
    ];
    return c;
  }, [dealershipId]);

  const constraintKey = `nfcTags:${dealershipId}`;

  const { data, loading, error } = useCollection<NFCTag>(
    'nfcTags',
    constraints,
    constraintKey,
  );

  return { tags: data, loading, error };
}
