// VehicleActivity types — matches iOS VehicleActivity.swift EXACTLY
// Firestore collection: vehicleActivities/{vin}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// VehicleActivityState — matches iOS VehicleActivityState enum raw values
// ---------------------------------------------------------------------------

export type VehicleActivityState =
  | 'AVAILABLE'
  | 'SHOWING'
  | 'TEST_DRIVE'
  | 'OFF_LOT'
  | 'FUELING'
  | 'CHARGING_RUNNING'
  | 'SOLD';

export const VEHICLE_ACTIVITY_STATE_VALUES = [
  'AVAILABLE', 'SHOWING', 'TEST_DRIVE', 'OFF_LOT',
  'FUELING', 'CHARGING_RUNNING', 'SOLD',
] as const;

/** The 6 selectable states (everything except AVAILABLE) — matches iOS selectableStates */
export const SELECTABLE_ACTIVITY_STATES: VehicleActivityState[] = [
  'SHOWING', 'TEST_DRIVE', 'OFF_LOT', 'FUELING', 'CHARGING_RUNNING', 'SOLD',
] as const;

/** Display names — matches iOS VehicleActivityState.displayName */
export const ACTIVITY_DISPLAY_NAME: Record<VehicleActivityState, string> = {
  AVAILABLE: 'Available',
  SHOWING: 'Show / Video',
  TEST_DRIVE: 'Test Drive',
  OFF_LOT: 'Off Lot',
  FUELING: 'Fueling',
  CHARGING_RUNNING: 'Run / Charge',
  SOLD: 'Mark Sold',
} as const;

/** Subtitles — matches iOS VehicleActivityState.subtitle */
export const ACTIVITY_SUBTITLE: Record<VehicleActivityState, string> = {
  AVAILABLE: 'On Lot',
  SHOWING: 'Customer Present',
  TEST_DRIVE: 'Active Tracking',
  OFF_LOT: 'Extended Absence',
  FUELING: 'Gas Station Trip',
  CHARGING_RUNNING: 'On Lot Operation',
  SOLD: 'Final Process',
} as const;

/** Icon names (Lucide equivalents of iOS SF Symbols) — matches iOS VehicleActivityState.icon */
export const ACTIVITY_ICON: Record<VehicleActivityState, string> = {
  AVAILABLE: 'check-circle',
  SHOWING: 'camera',
  TEST_DRIVE: 'route',
  OFF_LOT: 'map',
  FUELING: 'fuel',
  CHARGING_RUNNING: 'zap',
  SOLD: 'thumbs-up',
} as const;

/** Accent colors — matches iOS VehicleActivityState.color */
export const ACTIVITY_COLOR: Record<VehicleActivityState, string> = {
  AVAILABLE: 'green',
  SHOWING: 'blue',
  TEST_DRIVE: 'red',
  OFF_LOT: 'orange',
  FUELING: 'green',
  CHARGING_RUNNING: 'yellow',
  SOLD: 'purple',
} as const;

/** Action button labels — matches iOS VehicleActivityState.actionLabel */
export const ACTIVITY_ACTION_LABEL: Record<VehicleActivityState, string> = {
  AVAILABLE: 'Available',
  SHOWING: 'Start Showing',
  TEST_DRIVE: 'Start Test Drive',
  OFF_LOT: 'Mark Off Lot',
  FUELING: 'Start Fueling',
  CHARGING_RUNNING: 'Start Charging',
  SOLD: 'Complete Sale',
} as const;

/** Active descriptions — matches iOS VehicleActivityState.activeDescription */
export const ACTIVITY_ACTIVE_DESCRIPTION: Record<VehicleActivityState, string> = {
  AVAILABLE: 'Available on lot',
  SHOWING: 'Showing vehicle...',
  TEST_DRIVE: 'On test drive...',
  OFF_LOT: 'Off lot...',
  FUELING: 'Fueling...',
  CHARGING_RUNNING: 'Running / Charging...',
  SOLD: 'Sold...',
} as const;

/** Whether the activity state requires fuel level input — matches iOS requiresFuelInput */
export const ACTIVITY_REQUIRES_FUEL_INPUT: Record<VehicleActivityState, boolean> = {
  AVAILABLE: false,
  SHOWING: false,
  TEST_DRIVE: true,
  OFF_LOT: true,
  FUELING: true,
  CHARGING_RUNNING: true,
  SOLD: false,
} as const;

/** End button labels — matches iOS endButtonLabel */
export const ACTIVITY_END_BUTTON_LABEL: Record<VehicleActivityState, string> = {
  AVAILABLE: 'RETURN TO LOT',
  SHOWING: 'RETURN TO LOT',
  TEST_DRIVE: 'START SHOWING',
  OFF_LOT: 'RETURN TO LOT',
  FUELING: 'RETURN TO LOT',
  CHARGING_RUNNING: 'RETURN TO LOT',
  SOLD: 'RETURN TO LOT',
} as const;

// ---------------------------------------------------------------------------
// VehicleActivity — matches iOS VehicleActivity struct (Firestore document)
// ---------------------------------------------------------------------------

export interface VehicleActivity {
  id?: string; // Firestore document ID

  vin: string;
  dealershipId: string;
  state: VehicleActivityState;
  isActive: boolean;
  startedAt: Date;
  endedAt?: Date;
  startedByUserId: string;
  startedByName: string; // "T. Adcox" format
  stockNumber: string;
  yearMakeModel: string;
  durationSeconds?: number;
  startingFuelLevel?: number; // Fuel % at session start
}

/**
 * Format a user's full display name as "T. Adcox" (first initial + last name)
 * Matches iOS VehicleActivity.abbreviatedName(from:)
 */
export function abbreviatedName(displayName: string): string {
  const parts = displayName.split(' ');
  const first = parts[0];
  if (!first) return displayName;
  const initial = `${first.charAt(0)}.`;
  const lastName = parts.slice(1).join(' ');
  return lastName ? `${initial} ${lastName}` : first;
}

// ---------------------------------------------------------------------------
// Zod Schema — runtime validation
// ---------------------------------------------------------------------------

export const vehicleActivitySchema = z.object({
  id: z.string().optional(),
  vin: z.string().min(17).max(17),
  dealershipId: z.string().min(1),
  state: z.enum(VEHICLE_ACTIVITY_STATE_VALUES),
  isActive: z.boolean(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().optional(),
  startedByUserId: z.string().min(1),
  startedByName: z.string().min(1),
  stockNumber: z.string().min(1),
  yearMakeModel: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  startingFuelLevel: z.number().int().min(0).max(100).optional(),
});

export type VehicleActivitySchema = z.infer<typeof vehicleActivitySchema>;
