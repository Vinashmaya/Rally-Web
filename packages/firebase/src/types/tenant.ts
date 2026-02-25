// Tenant types — matches iOS TenantContext.swift EXACTLY
// Firestore collections: groups/{groupId}, groups/{groupId}/stores/{storeId},
//   employees/{uid}, employees/{uid}/memberships/{membershipId}

import { z } from 'zod';
import type { UserRole } from './user';
import { USER_ROLE_VALUES } from './user';

// ---------------------------------------------------------------------------
// GroupStatus — matches iOS DealerGroup.GroupStatus enum
// ---------------------------------------------------------------------------

export type GroupStatus = 'active' | 'suspended';

export const GROUP_STATUS_VALUES = ['active', 'suspended'] as const;

// ---------------------------------------------------------------------------
// GroupFeatureFlags — matches iOS DealerGroup.GroupFeatureFlags struct
// ---------------------------------------------------------------------------

export interface GroupFeatureFlags {
  nfcEnabled: boolean;
  testDriveTrackingEnabled: boolean;
  crossStoreInventoryEnabled: boolean;
  analyticsEnabled: boolean;
}

// ---------------------------------------------------------------------------
// DealerGroup — matches iOS DealerGroup struct
// Firestore: groups/{groupId}
// ---------------------------------------------------------------------------

export interface DealerGroup {
  id?: string; // Firestore document ID
  name: string;
  slug?: string; // URL-safe identifier for subdomain routing (e.g. 'gallatincdjr')
  ownerId: string;
  status: GroupStatus;
  createdAt: Date;
  updatedAt: Date;
  featureFlags: GroupFeatureFlags;
}

// ---------------------------------------------------------------------------
// StoreStatus — matches iOS Store.StoreStatus enum
// ---------------------------------------------------------------------------

export type StoreStatus = 'active' | 'suspended';

export const STORE_STATUS_VALUES = ['active', 'suspended'] as const;

// ---------------------------------------------------------------------------
// StoreFeatureFlags — matches iOS Store.StoreFeatureFlags struct
// ---------------------------------------------------------------------------

export interface StoreFeatureFlags {
  detailTrackingEnabled: boolean;
  fuelTrackingEnabled: boolean;
  photoRequiredOnDelivery: boolean;
}

// ---------------------------------------------------------------------------
// DealershipSettings — matches iOS DealershipSettings struct
// ---------------------------------------------------------------------------

export interface DealershipSettings {
  // Test drive settings
  testDriveGeofenceRadius: number; // meters
  testDriveMaxDuration: number; // minutes
  requireCustomerInfo: boolean;
  requireLicenseVerification: boolean;
  requireManagerApprovalAbovePrice?: number;

  // Hold settings
  holdExpirationHours: number;
  allowHoldExtensions: boolean;
  maxHoldExtensions: number;

  // Alert thresholds
  daysOnLotWarning: number;
  daysOnLotCritical: number;
  detailTimeWarningMinutes: number;
  testDriveTimeWarningMinutes: number;

  // Custom statuses
  customStatuses?: CustomStatus[];

  // Operating hours (for alerts)
  operatingHoursStart?: string; // "09:00"
  operatingHoursEnd?: string; // "21:00"
  operatingDays?: number[]; // 1=Mon, 7=Sun
}

/** Default DealershipSettings — matches iOS DealershipSettings.init defaults */
export const DEFAULT_DEALERSHIP_SETTINGS: DealershipSettings = {
  testDriveGeofenceRadius: 16093.4, // 10 miles
  testDriveMaxDuration: 60,
  requireCustomerInfo: false,
  requireLicenseVerification: true,
  requireManagerApprovalAbovePrice: 75000,
  holdExpirationHours: 48,
  allowHoldExtensions: true,
  maxHoldExtensions: 2,
  daysOnLotWarning: 45,
  daysOnLotCritical: 90,
  detailTimeWarningMinutes: 240,
  testDriveTimeWarningMinutes: 45,
  operatingHoursStart: '09:00',
  operatingHoursEnd: '21:00',
  operatingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
} as const;

// ---------------------------------------------------------------------------
// CustomStatus — matches iOS CustomStatus struct
// ---------------------------------------------------------------------------

export interface CustomStatus {
  id: string;
  name: string;
  parentStatus: string; // VehicleStatus raw value
  color: string;
  icon?: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Store — matches iOS Store struct
// Firestore: groups/{groupId}/stores/{storeId}
// ---------------------------------------------------------------------------

export interface Store {
  id?: string; // Firestore document ID
  groupId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
  location?: { latitude: number; longitude: number };
  timezone: string;
  settings: DealershipSettings;
  featureFlags: StoreFeatureFlags;
  logoUrl?: string;
  primaryColor?: string;
}

// ---------------------------------------------------------------------------
// MembershipStatus — matches iOS StoreMembership.MembershipStatus enum
// ---------------------------------------------------------------------------

export type MembershipStatus = 'active' | 'suspended';

export const MEMBERSHIP_STATUS_VALUES = ['active', 'suspended'] as const;

// ---------------------------------------------------------------------------
// PermissionOverride — matches iOS StoreMembership.PermissionOverride enum
// ---------------------------------------------------------------------------

export type PermissionOverride = 'grant' | 'deny';

export const PERMISSION_OVERRIDE_VALUES = ['grant', 'deny'] as const;

// ---------------------------------------------------------------------------
// StoreMembership — matches iOS StoreMembership struct
// Firestore: employees/{uid}/memberships/{membershipId}
// ---------------------------------------------------------------------------

export interface StoreMembership {
  id?: string; // Firestore document ID
  employeeUid: string;
  groupId: string;
  storeId: string;
  role: UserRole;
  customRoleId?: string;
  permissionOverrides: Record<string, PermissionOverride>;
  isPrimary: boolean;
  joinedAt: Date;
  invitedBy: string;
  status: MembershipStatus;
}

// ---------------------------------------------------------------------------
// EmployeeStatus — matches iOS EmployeeProfile.EmployeeStatus enum
// ---------------------------------------------------------------------------

export type EmployeeStatus = 'active' | 'suspended';

export const EMPLOYEE_STATUS_VALUES = ['active', 'suspended'] as const;

// ---------------------------------------------------------------------------
// EmployeeProfile — matches iOS EmployeeProfile struct
// Firestore: employees/{uid}
// ---------------------------------------------------------------------------

export interface EmployeeProfile {
  id?: string; // Firestore document ID
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;
  status: EmployeeStatus;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

const groupFeatureFlagsSchema = z.object({
  nfcEnabled: z.boolean(),
  testDriveTrackingEnabled: z.boolean(),
  crossStoreInventoryEnabled: z.boolean(),
  analyticsEnabled: z.boolean(),
});

export const dealerGroupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().optional(),
  ownerId: z.string().min(1),
  status: z.enum(GROUP_STATUS_VALUES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  featureFlags: groupFeatureFlagsSchema,
});

const storeFeatureFlagsSchema = z.object({
  detailTrackingEnabled: z.boolean(),
  fuelTrackingEnabled: z.boolean(),
  photoRequiredOnDelivery: z.boolean(),
});

const customStatusSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  parentStatus: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  isActive: z.boolean(),
});

const dealershipSettingsSchema = z.object({
  testDriveGeofenceRadius: z.number().positive(),
  testDriveMaxDuration: z.number().int().positive(),
  requireCustomerInfo: z.boolean(),
  requireLicenseVerification: z.boolean(),
  requireManagerApprovalAbovePrice: z.number().nonnegative().optional(),
  holdExpirationHours: z.number().int().positive(),
  allowHoldExtensions: z.boolean(),
  maxHoldExtensions: z.number().int().nonnegative(),
  daysOnLotWarning: z.number().int().positive(),
  daysOnLotCritical: z.number().int().positive(),
  detailTimeWarningMinutes: z.number().int().positive(),
  testDriveTimeWarningMinutes: z.number().int().positive(),
  customStatuses: z.array(customStatusSchema).optional(),
  operatingHoursStart: z.string().optional(),
  operatingHoursEnd: z.string().optional(),
  operatingDays: z.array(z.number().int().min(1).max(7)).optional(),
});

export const storeSchema = z.object({
  id: z.string().optional(),
  groupId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
  phone: z.string().optional(),
  status: z.enum(STORE_STATUS_VALUES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  timezone: z.string(),
  settings: dealershipSettingsSchema,
  featureFlags: storeFeatureFlagsSchema,
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
});

export const storeMembershipSchema = z.object({
  id: z.string().optional(),
  employeeUid: z.string().min(1),
  groupId: z.string().min(1),
  storeId: z.string().min(1),
  role: z.enum(USER_ROLE_VALUES),
  customRoleId: z.string().optional(),
  permissionOverrides: z.record(z.string(), z.enum(PERMISSION_OVERRIDE_VALUES)),
  isPrimary: z.boolean(),
  joinedAt: z.coerce.date(),
  invitedBy: z.string().min(1),
  status: z.enum(MEMBERSHIP_STATUS_VALUES),
});

export const employeeProfileSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  displayName: z.string().min(1),
  phone: z.string().optional(),
  photoURL: z.string().url().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  lastActiveAt: z.coerce.date().optional(),
});

export type DealerGroupSchema = z.infer<typeof dealerGroupSchema>;
export type StoreSchema = z.infer<typeof storeSchema>;
export type StoreMembershipSchema = z.infer<typeof storeMembershipSchema>;
export type EmployeeProfileSchema = z.infer<typeof employeeProfileSchema>;
