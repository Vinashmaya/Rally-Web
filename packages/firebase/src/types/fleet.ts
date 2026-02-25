// Fleet types — matches iOS FleetVehicle.swift and BatteryReportVehicle.swift
// Firestore collections: fleetVehicles/{id}, batteryReports/{id}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// FleetVehicleSource — matches iOS FleetVehicle.source enum
// ---------------------------------------------------------------------------

export type FleetVehicleSource = 'ghost' | 'kahu';

export const FLEET_VEHICLE_SOURCE_VALUES = ['ghost', 'kahu'] as const;

// ---------------------------------------------------------------------------
// FleetVehicleStatus — matches iOS FleetVehicle.status enum
// ---------------------------------------------------------------------------

export type FleetVehicleStatus = 'moving' | 'parked' | 'offline';

export const FLEET_VEHICLE_STATUS_VALUES = ['moving', 'parked', 'offline'] as const;

/** Display metadata for FleetVehicleStatus */
export const FLEET_VEHICLE_STATUS_DISPLAY: Record<FleetVehicleStatus, { displayName: string; icon: string; color: string }> = {
  moving:  { displayName: 'Moving',  icon: 'navigation', color: 'green' },
  parked:  { displayName: 'Parked',  icon: 'parking-meter', color: 'blue' },
  offline: { displayName: 'Offline', icon: 'wifi-off', color: 'gray' },
} as const;

// ---------------------------------------------------------------------------
// FleetVehicle — matches iOS FleetVehicle struct (Firestore document)
// ---------------------------------------------------------------------------

export interface FleetVehicle {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  batteryPercentage?: number;
  lastUpdate: Date;
  source: FleetVehicleSource;
  deviceId?: string;
  status: FleetVehicleStatus;
  dealershipId: string;
}

// ---------------------------------------------------------------------------
// BatteryStatus — matches iOS BatteryReportVehicle.batteryStatus enum
// ---------------------------------------------------------------------------

export type BatteryStatus = 'critical' | 'warning' | 'healthy';

export const BATTERY_STATUS_VALUES = ['critical', 'warning', 'healthy'] as const;

/** Display metadata for BatteryStatus */
export const BATTERY_STATUS_DISPLAY: Record<BatteryStatus, { displayName: string; icon: string; color: string }> = {
  critical: { displayName: 'Critical', icon: 'battery-warning', color: 'red' },
  warning:  { displayName: 'Warning',  icon: 'battery-low', color: 'yellow' },
  healthy:  { displayName: 'Healthy',  icon: 'battery-full', color: 'green' },
} as const;

// ---------------------------------------------------------------------------
// BatteryReport — matches iOS BatteryReportVehicle struct (Firestore document)
// ---------------------------------------------------------------------------

export interface BatteryReport {
  id: string;
  vin: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  voltage: number;
  batteryStatus: BatteryStatus;
  deviceId: string;
  lastEventTime: Date;
  latitude?: number;
  longitude?: number;
  hasGPS: boolean;
  lotName?: string;
  dealershipId: string;
}

// ---------------------------------------------------------------------------
// Zod Schemas — runtime validation
// ---------------------------------------------------------------------------

export const fleetVehicleSchema = z.object({
  id: z.string(),
  vin: z.string().min(17).max(17),
  stockNumber: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  speed: z.number().nonnegative(),
  heading: z.number().min(0).max(360),
  batteryPercentage: z.number().min(0).max(100).optional(),
  lastUpdate: z.coerce.date(),
  source: z.enum(FLEET_VEHICLE_SOURCE_VALUES),
  deviceId: z.string().optional(),
  status: z.enum(FLEET_VEHICLE_STATUS_VALUES),
  dealershipId: z.string().min(1),
});

export const batteryReportSchema = z.object({
  id: z.string(),
  vin: z.string().min(17).max(17),
  stockNumber: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  voltage: z.number().nonnegative(),
  batteryStatus: z.enum(BATTERY_STATUS_VALUES),
  deviceId: z.string().min(1),
  lastEventTime: z.coerce.date(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  hasGPS: z.boolean(),
  lotName: z.string().optional(),
  dealershipId: z.string().min(1),
});

export type FleetVehicleSchema = z.infer<typeof fleetVehicleSchema>;
export type BatteryReportSchema = z.infer<typeof batteryReportSchema>;
