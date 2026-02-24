// System types — web-only types for system management
// These types don't have iOS counterparts; they exist for the admin/management consoles

import { z } from 'zod';
import type { UserRole } from './user';
import { USER_ROLE_VALUES } from './user';

// ---------------------------------------------------------------------------
// AuditLogEntry — tracks all administrative actions
// Firestore collection: auditLogs/{entryId}
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id?: string; // Firestore document ID
  action: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  targetType: 'vehicle' | 'user' | 'store' | 'group' | 'tag' | 'system';
  targetId: string;
  metadata?: Record<string, unknown>;
  tenantId: string;
  storeId?: string;
  timestamp: Date;
  ip?: string;
}

export const AUDIT_TARGET_TYPES = [
  'vehicle', 'user', 'store', 'group', 'tag', 'system',
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

// ---------------------------------------------------------------------------
// FeatureFlag — system-wide feature toggles
// Firestore collection: featureFlags/{flagId}
// ---------------------------------------------------------------------------

export interface FeatureFlag {
  id?: string; // Firestore document ID
  key: string;
  enabled: boolean;
  description?: string;
  tenantOverrides?: Record<string, boolean>;
  rolloutPercentage?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

export const auditLogEntrySchema = z.object({
  id: z.string().optional(),
  action: z.string().min(1),
  actorId: z.string().min(1),
  actorName: z.string().min(1),
  actorRole: z.enum(USER_ROLE_VALUES),
  targetType: z.enum(AUDIT_TARGET_TYPES),
  targetId: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tenantId: z.string().min(1),
  storeId: z.string().optional(),
  timestamp: z.coerce.date(),
  ip: z.string().optional(),
});

export const featureFlagSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  enabled: z.boolean(),
  description: z.string().optional(),
  tenantOverrides: z.record(z.string(), z.boolean()).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type AuditLogEntrySchema = z.infer<typeof auditLogEntrySchema>;
export type FeatureFlagSchema = z.infer<typeof featureFlagSchema>;
