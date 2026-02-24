// VehicleList types — matches iOS VehicleList.swift EXACTLY
// Firestore collection: vehicleLists/{listId}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// VehicleList — matches iOS VehicleList struct
// ---------------------------------------------------------------------------

export interface VehicleList {
  id?: string; // Firestore document ID

  // Core properties
  name: string;
  dealershipId: string;
  ownerId: string;
  ownerName: string;

  // Appearance
  color: string; // Key into AVAILABLE_COLORS (e.g. "blue", "red")
  icon: string; // SF Symbol name / Lucide icon name (e.g. "flame.fill")

  // Flags
  isDefault: boolean; // true for the migrated "My List"
  isShared: boolean; // shared with entire dealership?
  sharedWith: string[]; // specific user IDs granted access

  // Metadata
  vehicleCount: number; // denormalized count of items subcollection
  createdAt?: Date; // @ServerTimestamp
  updatedAt?: Date; // @ServerTimestamp
  sortOrder: number; // user-defined display ordering
}

/** Predefined color options — matches iOS VehicleList.availableColors */
export const AVAILABLE_COLORS = [
  'blue', 'red', 'green', 'purple', 'orange', 'pink', 'teal', 'indigo',
] as const;

/** Predefined icon options — matches iOS VehicleList.availableIcons */
export const AVAILABLE_ICONS = [
  'list.bullet', 'flame.fill', 'star.fill', 'heart.fill',
  'tag.fill', 'clock.fill', 'bolt.fill', 'flag.fill',
  'wrench.fill', 'phone.fill', 'dollarsign.circle.fill', 'person.fill',
] as const;

/** List template for quick creation — matches iOS VehicleList.Template */
export interface VehicleListTemplate {
  name: string;
  color: string;
  icon: string;
}

/** Predefined templates — matches iOS VehicleList.templates */
export const LIST_TEMPLATES: VehicleListTemplate[] = [
  { name: 'Hot Leads', color: 'red', icon: 'flame.fill' },
  { name: 'Service Follow-Up', color: 'orange', icon: 'wrench.fill' },
  { name: 'Weekend Specials', color: 'purple', icon: 'star.fill' },
  { name: 'Customer Showroom', color: 'blue', icon: 'person.fill' },
] as const;

// ---------------------------------------------------------------------------
// Zod Schema — runtime validation
// ---------------------------------------------------------------------------

export const vehicleListSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  dealershipId: z.string().min(1),
  ownerId: z.string().min(1),
  ownerName: z.string().min(1),
  color: z.string().min(1),
  icon: z.string().min(1),
  isDefault: z.boolean(),
  isShared: z.boolean(),
  sharedWith: z.array(z.string()),
  vehicleCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  sortOrder: z.number().int(),
});

export type VehicleListSchema = z.infer<typeof vehicleListSchema>;
