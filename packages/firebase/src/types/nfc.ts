// NFC types — matches iOS NFCTag.swift EXACTLY
// Firestore collection: nfcTags/{tagId}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// NFCTagStatus — matches iOS NFCTagStatus enum raw values
// ---------------------------------------------------------------------------

export type NFCTagStatus = 'active' | 'deactivated' | 'lost' | 'damaged';

export const NFC_TAG_STATUS_VALUES = ['active', 'deactivated', 'lost', 'damaged'] as const;

/** Display names — matches iOS NFCTagStatus.displayName */
export const NFC_TAG_STATUS_DISPLAY: Record<NFCTagStatus, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
  lost: 'Lost',
  damaged: 'Damaged',
} as const;

/** Icons (Lucide equivalents) — matches iOS NFCTagStatus.icon */
export const NFC_TAG_STATUS_ICON: Record<NFCTagStatus, string> = {
  active: 'check-circle',
  deactivated: 'minus-circle',
  lost: 'help-circle',
  damaged: 'alert-triangle',
} as const;

// ---------------------------------------------------------------------------
// NFCChipType — matches iOS NFCChipType enum raw values
// ---------------------------------------------------------------------------

export type NFCChipType = 'ntag213' | 'ntag215' | 'ntag216' | 'mifare' | 'other';

export const NFC_CHIP_TYPE_VALUES = ['ntag213', 'ntag215', 'ntag216', 'mifare', 'other'] as const;

/** Display names — matches iOS NFCChipType.displayName */
export const NFC_CHIP_TYPE_DISPLAY: Record<NFCChipType, string> = {
  ntag213: 'NTAG213 (144 bytes)',
  ntag215: 'NTAG215 (504 bytes)',
  ntag216: 'NTAG216 (888 bytes)',
  mifare: 'MIFARE',
  other: 'Other',
} as const;

/** Capacity in bytes — matches iOS NFCChipType.capacity */
export const NFC_CHIP_TYPE_CAPACITY: Record<NFCChipType, number> = {
  ntag213: 144,
  ntag215: 504,
  ntag216: 888,
  mifare: 1024,
  other: 0,
} as const;

// ---------------------------------------------------------------------------
// NFCTagPayload — matches iOS NFCTagPayload struct
// ---------------------------------------------------------------------------

export interface NFCTagPayload {
  stockNumber: string;
  vin?: string;
  tagId: string;
  dealerId: string;
  version: number;
}

/** Generate deep link URL — matches iOS NFCTagPayload.deepLinkUrl */
export function nfcDeepLinkUrl(payload: NFCTagPayload): string {
  return payload.vin
    ? `https://aicdjr.com/v/${payload.vin}`
    : 'https://aicdjr.com/v/unknown';
}

// ---------------------------------------------------------------------------
// NFCTag — matches iOS NFCTag struct (Firestore document structure)
// ---------------------------------------------------------------------------

export interface NFCTag {
  id?: string; // UUID or serial number (Firestore document ID)

  // Association
  vehicleId?: string; // Stock number, undefined if unassigned
  dealershipId: string;

  // Tag identification
  tagSerialNumber?: string; // Hardware serial from tag
  chipType: NFCChipType;

  // Programming info
  programmedAt?: Date;
  programmedBy?: string; // User ID
  payload?: NFCTagPayload;

  // Status tracking
  status: NFCTagStatus;
  lastScannedAt?: Date;
  scanCount: number;
  writeCount: number;

  // Physical tracking
  notes?: string;
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

const nfcTagPayloadSchema = z.object({
  stockNumber: z.string().min(1),
  vin: z.string().optional(),
  tagId: z.string().min(1),
  dealerId: z.string().min(1),
  version: z.number().int().positive(),
});

export const nfcTagSchema = z.object({
  id: z.string().optional(),
  vehicleId: z.string().optional(),
  dealershipId: z.string().min(1),
  tagSerialNumber: z.string().optional(),
  chipType: z.enum(NFC_CHIP_TYPE_VALUES),
  programmedAt: z.coerce.date().optional(),
  programmedBy: z.string().optional(),
  payload: nfcTagPayloadSchema.optional(),
  status: z.enum(NFC_TAG_STATUS_VALUES),
  lastScannedAt: z.coerce.date().optional(),
  scanCount: z.number().int().nonnegative(),
  writeCount: z.number().int().nonnegative(),
  notes: z.string().optional(),
});

export type NFCTagSchema = z.infer<typeof nfcTagSchema>;
