// Vehicle types — matches iOS Vehicle.swift EXACTLY
// Firestore collection: vehicles/{vin}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// VehicleStatus — matches iOS VehicleStatus enum raw values
// ---------------------------------------------------------------------------

export type VehicleStatus =
  | 'incoming'
  | 'intake'
  | 'prep'
  | 'frontline'
  | 'service'
  | 'sold'
  | 'delivery'
  | 'offsite'
  | 'archived';

export const VEHICLE_STATUS_VALUES = [
  'incoming', 'intake', 'prep', 'frontline', 'service',
  'sold', 'delivery', 'offsite', 'archived',
] as const;

/** Display metadata for VehicleStatus — matches iOS VehicleStatus computed properties */
export const VEHICLE_STATUS_DISPLAY: Record<VehicleStatus, { displayName: string; icon: string; color: string }> = {
  incoming:  { displayName: 'Incoming',  icon: 'truck',          color: 'purple' },
  intake:    { displayName: 'Intake',    icon: 'search',         color: 'orange' },
  prep:      { displayName: 'In Prep',   icon: 'wrench',         color: 'yellow' },
  frontline: { displayName: 'Frontline', icon: 'car',            color: 'green' },
  service:   { displayName: 'Service',   icon: 'settings',       color: 'red' },
  sold:      { displayName: 'Sold',      icon: 'check-circle-2', color: 'blue' },
  delivery:  { displayName: 'Delivery',  icon: 'gift',           color: 'teal' },
  offsite:   { displayName: 'Off-Site',  icon: 'external-link',  color: 'gray' },
  archived:  { displayName: 'Archived',  icon: 'archive',        color: 'secondary' },
} as const;

// ---------------------------------------------------------------------------
// VehicleSubStatus — matches iOS VehicleSubStatus enum raw values
// ---------------------------------------------------------------------------

export type VehicleSubStatus =
  // Incoming
  | 'in_transit'
  | 'arrived_pending'
  // Intake
  | 'inspection'
  | 'documentation'
  | 'photography'
  // Prep
  | 'detail_queue'
  | 'in_detail'
  | 'accessories'
  | 'reconditioning'
  // Frontline
  | 'available'
  | 'on_hold'
  | 'test_drive'
  | 'deal_pending'
  // Service
  | 'customer_concern'
  | 'recall_work'
  | 'warranty_prep'
  // Sold
  | 'pending_delivery'
  | 'in_delivery'
  // Delivery
  | 'delivered'
  // Off-Site
  | 'wholesale_auction'
  | 'body_shop'
  | 'customer_loaner'
  | 'employee_use'
  // Archived
  | 'trade_completed'
  | 'wholesaled';

export const VEHICLE_SUB_STATUS_VALUES = [
  'in_transit', 'arrived_pending',
  'inspection', 'documentation', 'photography',
  'detail_queue', 'in_detail', 'accessories', 'reconditioning',
  'available', 'on_hold', 'test_drive', 'deal_pending',
  'customer_concern', 'recall_work', 'warranty_prep',
  'pending_delivery', 'in_delivery',
  'delivered',
  'wholesale_auction', 'body_shop', 'customer_loaner', 'employee_use',
  'trade_completed', 'wholesaled',
] as const;

/** Display names for VehicleSubStatus — matches iOS VehicleSubStatus.displayName */
export const VEHICLE_SUB_STATUS_DISPLAY: Record<VehicleSubStatus, string> = {
  in_transit: 'In Transit',
  arrived_pending: 'Arrived - Pending Intake',
  inspection: 'PDI Inspection',
  documentation: 'Documentation',
  photography: 'Photography',
  detail_queue: 'Detail Queue',
  in_detail: 'In Detail',
  accessories: 'Accessories Install',
  reconditioning: 'Reconditioning',
  available: 'Available',
  on_hold: 'On Hold',
  test_drive: 'Test Drive',
  deal_pending: 'Deal Pending',
  customer_concern: 'Customer Concern',
  recall_work: 'Recall Work',
  warranty_prep: 'Warranty Prep',
  pending_delivery: 'Pending Delivery',
  in_delivery: 'In Delivery',
  delivered: 'Delivered',
  wholesale_auction: 'Wholesale/Auction',
  body_shop: 'Body Shop',
  customer_loaner: 'Customer Loaner',
  employee_use: 'Employee Use',
  trade_completed: 'Trade Completed',
  wholesaled: 'Wholesaled',
} as const;

/** Valid sub-statuses per primary status — matches iOS VehicleSubStatus.validSubStatuses(for:) */
export const VALID_SUB_STATUSES: Record<VehicleStatus, VehicleSubStatus[]> = {
  incoming:  ['in_transit', 'arrived_pending'],
  intake:    ['inspection', 'documentation', 'photography'],
  prep:      ['detail_queue', 'in_detail', 'accessories', 'reconditioning'],
  frontline: ['available', 'on_hold', 'test_drive', 'deal_pending'],
  service:   ['customer_concern', 'recall_work', 'warranty_prep'],
  sold:      ['pending_delivery', 'in_delivery'],
  delivery:  ['delivered'],
  offsite:   ['wholesale_auction', 'body_shop', 'customer_loaner', 'employee_use'],
  archived:  ['trade_completed', 'wholesaled'],
} as const;

// ---------------------------------------------------------------------------
// VehicleType — matches iOS VehicleType enum raw values
// ---------------------------------------------------------------------------

export type VehicleType =
  | 'sedan'
  | 'suv'
  | 'truck'
  | 'van'
  | 'coupe'
  | 'convertible'
  | 'wagon'
  | 'hatchback'
  | 'other';

export const VEHICLE_TYPE_VALUES = [
  'sedan', 'suv', 'truck', 'van', 'coupe',
  'convertible', 'wagon', 'hatchback', 'other',
] as const;

export const VEHICLE_TYPE_DISPLAY: Record<VehicleType, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  truck: 'Truck',
  van: 'Van',
  coupe: 'Coupe',
  convertible: 'Convertible',
  wagon: 'Wagon',
  hatchback: 'Hatchback',
  other: 'Other',
} as const;

// ---------------------------------------------------------------------------
// VehicleCondition — matches iOS VehicleCondition enum raw values
// ---------------------------------------------------------------------------

export type VehicleCondition = 'new' | 'used' | 'certified';

export const VEHICLE_CONDITION_VALUES = ['new', 'used', 'certified'] as const;

export const VEHICLE_CONDITION_DISPLAY: Record<VehicleCondition, string> = {
  new: 'New',
  used: 'Used',
  certified: 'Certified Pre-Owned',
} as const;

// ---------------------------------------------------------------------------
// VehicleLocation — matches iOS VehicleLocation struct
// ---------------------------------------------------------------------------

export interface VehicleLocation {
  parkingSpaceId?: string;
  coordinates?: { latitude: number; longitude: number };
  zone?: string;
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// HoldInfo — matches iOS HoldInfo struct
// ---------------------------------------------------------------------------

export interface HoldInfo {
  heldBy: string; // User ID
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  depositAmount?: number;
  expiresAt?: Date;
  notes?: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Vehicle — matches iOS Vehicle struct (Firestore document structure)
// ---------------------------------------------------------------------------

export interface Vehicle {
  id?: string; // Firestore document ID (firestoreId in iOS)

  // Core identification
  stockNumber: string;
  vin: string;
  dealershipId: string;

  // Vehicle details
  year: number;
  make: string;
  model: string;
  trim?: string;
  exteriorColor?: string;
  interiorColor?: string;

  // Pricing
  msrp?: number;
  internetPrice?: number;

  // Status tracking
  status: VehicleStatus;
  subStatus?: VehicleSubStatus;
  statusChangedAt?: Date;
  statusChangedBy?: string; // User ID

  // Location
  location?: VehicleLocation;

  // Hold information
  holdInfo?: HoldInfo;

  // NFC/QR linking
  nfcTagId?: string;
  qrCodeUrl?: string;

  // Media
  photos?: string[]; // URLs
  primaryPhotoUrl?: string;

  // Timestamps
  addedToInventoryAt?: Date;
  lastInteractionAt?: Date;

  // Metrics
  testDriveCount: number;
  daysOnLot?: number;

  // Vehicle classification
  isNew: boolean;
  type?: VehicleType;
  condition?: VehicleCondition;
  transmission?: string;
  mileage?: number;

  // Extensible metadata
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

const vehicleLocationSchema = z.object({
  parkingSpaceId: z.string().optional(),
  coordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  zone: z.string().optional(),
  updatedAt: z.coerce.date().optional(),
});

const holdInfoSchema = z.object({
  heldBy: z.string(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  depositAmount: z.number().nonnegative().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  createdAt: z.coerce.date(),
});

export const vehicleSchema = z.object({
  id: z.string().optional(),

  // Core identification
  stockNumber: z.string().min(1),
  vin: z.string().min(17).max(17),
  dealershipId: z.string().min(1),

  // Vehicle details
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  exteriorColor: z.string().optional(),
  interiorColor: z.string().optional(),

  // Pricing
  msrp: z.number().nonnegative().optional(),
  internetPrice: z.number().nonnegative().optional(),

  // Status tracking
  status: z.enum(VEHICLE_STATUS_VALUES),
  subStatus: z.enum(VEHICLE_SUB_STATUS_VALUES).optional(),
  statusChangedAt: z.coerce.date().optional(),
  statusChangedBy: z.string().optional(),

  // Location
  location: vehicleLocationSchema.optional(),

  // Hold information
  holdInfo: holdInfoSchema.optional(),

  // NFC/QR linking
  nfcTagId: z.string().optional(),
  qrCodeUrl: z.string().url().optional(),

  // Media
  photos: z.array(z.string().url()).optional(),
  primaryPhotoUrl: z.string().url().optional(),

  // Timestamps
  addedToInventoryAt: z.coerce.date().optional(),
  lastInteractionAt: z.coerce.date().optional(),

  // Metrics
  testDriveCount: z.number().int().nonnegative(),
  daysOnLot: z.number().int().nonnegative().optional(),

  // Vehicle classification
  isNew: z.boolean(),
  type: z.enum(VEHICLE_TYPE_VALUES).optional(),
  condition: z.enum(VEHICLE_CONDITION_VALUES).optional(),
  transmission: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),

  // Extensible metadata
  metadata: z.record(z.string(), z.string()).optional(),
});

export type VehicleSchema = z.infer<typeof vehicleSchema>;
