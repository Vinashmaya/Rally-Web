// User types — matches iOS User.swift EXACTLY
// Firestore collection: users/{uid}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// UserRole — matches iOS UserRole enum raw values
// ---------------------------------------------------------------------------

export type UserRole =
  | 'owner'
  | 'general_manager'
  | 'sales_manager'
  | 'service_manager'
  | 'finance_manager'
  | 'desk_manager'
  | 'salesperson'
  | 'bdc_agent'
  | 'service_advisor'
  | 'technician'
  | 'porter'
  | 'detailer'
  | 'parts';

export const USER_ROLE_VALUES = [
  'owner', 'general_manager', 'sales_manager', 'service_manager',
  'finance_manager', 'desk_manager', 'salesperson', 'bdc_agent',
  'service_advisor', 'technician', 'porter', 'detailer', 'parts',
] as const;

/** Display names for UserRole — matches iOS UserRole.displayName */
export const USER_ROLE_DISPLAY: Record<UserRole, string> = {
  owner: 'Owner',
  general_manager: 'General Manager',
  sales_manager: 'Sales Manager',
  service_manager: 'Service Manager',
  finance_manager: 'Finance Manager',
  desk_manager: 'Desk Manager',
  salesperson: 'Salesperson',
  bdc_agent: 'BDC Agent',
  service_advisor: 'Service Advisor',
  technician: 'Technician',
  porter: 'Porter',
  detailer: 'Detailer',
  parts: 'Parts',
} as const;

/** Icon names for UserRole — Lucide equivalents of iOS SF Symbols */
export const USER_ROLE_ICON: Record<UserRole, string> = {
  owner: 'crown',
  general_manager: 'building-2',
  sales_manager: 'users',
  service_manager: 'wrench',
  finance_manager: 'dollar-sign',
  desk_manager: 'monitor',
  salesperson: 'user',
  bdc_agent: 'phone',
  service_advisor: 'clipboard',
  technician: 'wrench',
  porter: 'car',
  detailer: 'sparkles',
  parts: 'package',
} as const;

/**
 * Role hierarchy levels — matches iOS UserRole.hierarchyLevel
 * Lower number = more authority
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 0,
  general_manager: 1,
  sales_manager: 2,
  service_manager: 2,
  finance_manager: 2,
  desk_manager: 3,
  salesperson: 4,
  bdc_agent: 4,
  service_advisor: 4,
  technician: 5,
  porter: 5,
  detailer: 5,
  parts: 5,
} as const;

// ---------------------------------------------------------------------------
// UserPermissions — matches iOS UserPermissions struct
// ---------------------------------------------------------------------------

export interface UserPermissions {
  // Vehicle operations
  canViewAllVehicles: boolean;
  canChangeAnyStatus: boolean;
  canStartTestDrive: boolean;
  canMarkAsSold: boolean;
  canMoveToService: boolean;
  canCompleteDetail: boolean;

  // Administrative
  canViewAnalytics: boolean;
  canManageUsers: boolean;
  canProgramNfcTags: boolean;
  canExportData: boolean;
  canViewTelemetry: boolean;

  // Override capabilities
  canOverrideHolds: boolean;
  canDeleteInteractions: boolean;
  canAccessAllDepartments: boolean;
}

/**
 * Default permissions per role — matches iOS UserPermissions.defaults(for:)
 * Every permission flag matches the Swift source exactly.
 */
export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  owner: {
    canViewAllVehicles: true,
    canChangeAnyStatus: true,
    canStartTestDrive: true,
    canMarkAsSold: true,
    canMoveToService: true,
    canCompleteDetail: true,
    canViewAnalytics: true,
    canManageUsers: true,
    canProgramNfcTags: true,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: true,
    canDeleteInteractions: true,
    canAccessAllDepartments: true,
  },
  general_manager: {
    canViewAllVehicles: true,
    canChangeAnyStatus: true,
    canStartTestDrive: true,
    canMarkAsSold: true,
    canMoveToService: true,
    canCompleteDetail: true,
    canViewAnalytics: true,
    canManageUsers: true,
    canProgramNfcTags: true,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: true,
    canDeleteInteractions: true,
    canAccessAllDepartments: true,
  },
  sales_manager: {
    canViewAllVehicles: true,
    canChangeAnyStatus: true,
    canStartTestDrive: true,
    canMarkAsSold: true,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: true,
    canManageUsers: false,
    canProgramNfcTags: true,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: true,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  service_manager: {
    canViewAllVehicles: true,
    canChangeAnyStatus: true,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: true,
    canCompleteDetail: true,
    canViewAnalytics: true,
    canManageUsers: false,
    canProgramNfcTags: true,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  finance_manager: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: true,
    canMarkAsSold: true,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: true,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  desk_manager: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: true,
    canMarkAsSold: true,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: true,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: true,
    canViewTelemetry: true,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  salesperson: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: true,
    canMarkAsSold: false,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  bdc_agent: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: true,
    canMarkAsSold: false,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  service_advisor: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  technician: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: true,
    canCompleteDetail: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  porter: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: false,
    canCompleteDetail: true,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: true,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  detailer: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: false,
    canCompleteDetail: true,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: true,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
  parts: {
    canViewAllVehicles: true,
    canChangeAnyStatus: false,
    canStartTestDrive: false,
    canMarkAsSold: false,
    canMoveToService: false,
    canCompleteDetail: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canProgramNfcTags: false,
    canExportData: false,
    canViewTelemetry: false,
    canOverrideHolds: false,
    canDeleteInteractions: false,
    canAccessAllDepartments: false,
  },
} as const;

// ---------------------------------------------------------------------------
// UserPreferences — matches iOS UserPreferences struct
// ---------------------------------------------------------------------------

export interface UserPreferences {
  defaultMapView?: string; // "satellite" or "map"
  enableHaptics: boolean;
  enableSounds: boolean;
  showDistanceInMetric: boolean;
  autoFollowMode: boolean;
  notificationsEnabled: boolean;
  darkModeOverride?: string; // "light", "dark", or undefined for system
}

// ---------------------------------------------------------------------------
// DealerUser — matches iOS DealerUser struct (Firestore document structure)
// ---------------------------------------------------------------------------

export interface DealerUser {
  id?: string; // Firestore document ID

  // Identity
  email: string;
  displayName: string;
  phone?: string;
  photoURL?: string;

  // Association
  dealershipId: string;
  role: UserRole;
  permissions: UserPermissions;

  // Push notifications
  fcmTokens?: string[];

  // Activity tracking
  createdAt: Date;
  lastActiveAt?: Date;

  // Preferences
  preferences?: UserPreferences;
}

// ---------------------------------------------------------------------------
// UserAction — matches iOS UserAction enum (for permission gates)
// ---------------------------------------------------------------------------

export type UserAction =
  | 'viewVehicle'
  | 'changeStatus'
  | 'startTestDrive'
  | 'markSold'
  | 'moveToService'
  | 'completeDetail'
  | 'viewAnalytics'
  | 'manageUsers'
  | 'programNfc'
  | 'exportData'
  | 'viewTelemetry';

/** Map a UserAction to its corresponding permission key */
export const ACTION_PERMISSION_MAP: Record<UserAction, keyof UserPermissions> = {
  viewVehicle: 'canViewAllVehicles',
  changeStatus: 'canChangeAnyStatus',
  startTestDrive: 'canStartTestDrive',
  markSold: 'canMarkAsSold',
  moveToService: 'canMoveToService',
  completeDetail: 'canCompleteDetail',
  viewAnalytics: 'canViewAnalytics',
  manageUsers: 'canManageUsers',
  programNfc: 'canProgramNfcTags',
  exportData: 'canExportData',
  viewTelemetry: 'canViewTelemetry',
} as const;

/** Check if a user can perform a given action — matches iOS DealerUser.canPerform(_:) */
export function canPerformAction(permissions: UserPermissions, action: UserAction): boolean {
  return permissions[ACTION_PERMISSION_MAP[action]];
}

/** Check if a role is manager level (hierarchyLevel <= 3) — matches iOS UserRole.isManager */
export function isManagerRole(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] <= 3;
}

/** Check if a role has sales responsibilities — matches iOS UserRole.isSalesRole */
export function isSalesRole(role: UserRole): boolean {
  const salesRoles: UserRole[] = [
    'owner', 'general_manager', 'sales_manager', 'desk_manager',
    'salesperson', 'bdc_agent', 'finance_manager',
  ];
  return salesRoles.includes(role);
}

/** Check if a role has service responsibilities — matches iOS UserRole.isServiceRole */
export function isServiceRole(role: UserRole): boolean {
  const serviceRoles: UserRole[] = [
    'owner', 'general_manager', 'service_manager',
    'service_advisor', 'technician', 'parts',
  ];
  return serviceRoles.includes(role);
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

const userPermissionsSchema = z.object({
  canViewAllVehicles: z.boolean(),
  canChangeAnyStatus: z.boolean(),
  canStartTestDrive: z.boolean(),
  canMarkAsSold: z.boolean(),
  canMoveToService: z.boolean(),
  canCompleteDetail: z.boolean(),
  canViewAnalytics: z.boolean(),
  canManageUsers: z.boolean(),
  canProgramNfcTags: z.boolean(),
  canExportData: z.boolean(),
  canViewTelemetry: z.boolean(),
  canOverrideHolds: z.boolean(),
  canDeleteInteractions: z.boolean(),
  canAccessAllDepartments: z.boolean(),
});

const userPreferencesSchema = z.object({
  defaultMapView: z.string().optional(),
  enableHaptics: z.boolean(),
  enableSounds: z.boolean(),
  showDistanceInMetric: z.boolean(),
  autoFollowMode: z.boolean(),
  notificationsEnabled: z.boolean(),
  darkModeOverride: z.string().optional(),
});

export const dealerUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email(),
  displayName: z.string().min(1),
  phone: z.string().optional(),
  photoURL: z.string().url().optional(),
  dealershipId: z.string().min(1),
  role: z.enum(USER_ROLE_VALUES),
  permissions: userPermissionsSchema,
  fcmTokens: z.array(z.string()).optional(),
  createdAt: z.coerce.date(),
  lastActiveAt: z.coerce.date().optional(),
  preferences: userPreferencesSchema.optional(),
});

export type DealerUserSchema = z.infer<typeof dealerUserSchema>;
