'use client';

// Domain hook: audit log collection listener
// Supports optional tenant scoping and configurable limit
// Firestore collection: auditLogs

import { useMemo } from 'react';
import { where, orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import { useCollection } from './useFirestore';
import type { AuditLogEntry } from '../types/system';

interface UseAuditLogOptions {
  tenantId?: string;
  limitCount?: number; // default 50
}

interface UseAuditLogReturn {
  auditLogs: AuditLogEntry[];
  loading: boolean;
  error: Error | null;
}

export function useAuditLog(options: UseAuditLogOptions = {}): UseAuditLogReturn {
  const { tenantId, limitCount = 50 } = options;

  const constraints = useMemo(() => {
    const c: QueryConstraint[] = [];

    if (tenantId) {
      c.push(where('tenantId', '==', tenantId));
    }

    c.push(orderBy('timestamp', 'desc'));
    c.push(limit(limitCount));

    return c;
  }, [tenantId, limitCount]);

  // Stable key — captures tenantId and limit value
  const constraintKey = `auditLogs:${tenantId ?? 'all'}:${limitCount}`;

  const { data, loading, error } = useCollection<AuditLogEntry>(
    'auditLogs',
    constraints,
    constraintKey,
  );

  return { auditLogs: data, loading, error };
}
