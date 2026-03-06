// Lot Grid Configuration types — used by admin lot config tool
// Firestore path: groups/{groupId}/stores/{storeId}/lotConfigs/{configId}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// GeoPoint — simple lat/lng (not Firestore GeoPoint class)
// ---------------------------------------------------------------------------

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export const geoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ---------------------------------------------------------------------------
// LotCell — individual parking spot in a grid
// ---------------------------------------------------------------------------

export interface LotCell {
  row: number;
  col: number;
  name: string; // Two-word radio name, e.g. "Approval-Axle"
  occupied?: boolean;
  vin?: string;
}

export const lotCellSchema = z.object({
  row: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
  name: z.string().min(1),
  occupied: z.boolean().optional(),
  vin: z.string().optional(),
});

// ---------------------------------------------------------------------------
// LotGrid — a single grid overlay on the map
// ---------------------------------------------------------------------------

export type GridType = 'base' | 'sub';

export const GRID_TYPE_VALUES = ['base', 'sub'] as const;

export interface LotGrid {
  id: string;
  label: string; // e.g. "Front Row", "Back Lot"
  type: GridType;
  origin: GeoPoint; // Top-left corner
  rotationDeg: number; // Degrees clockwise from north
  rows: number;
  cols: number;
  cellWidthFt: number;
  cellHeightFt: number;
  color: string; // Hex color for grid lines
  opacity: number; // 0-1
  visible: boolean;
}

export const lotGridSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(GRID_TYPE_VALUES),
  origin: geoPointSchema,
  rotationDeg: z.number().min(-360).max(360),
  rows: z.number().int().min(1).max(200),
  cols: z.number().int().min(1).max(200),
  cellWidthFt: z.number().positive().max(100),
  cellHeightFt: z.number().positive().max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
});

// ---------------------------------------------------------------------------
// LotImageOverlay — positioned aerial photo on the map
// ---------------------------------------------------------------------------

export interface LotImageOverlay {
  id: string;
  label: string;
  imageUrl: string; // Firebase Storage download URL or relative path
  storagePath?: string; // gs:// path for deletion
  bounds: [GeoPoint, GeoPoint]; // [SW corner, NE corner]
  opacity: number; // 0-1
  rotationDeg: number;
  scale: number;
  offsetX: number; // Meters offset
  offsetY: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  /** Pre-computed corners [TL, TR, BR, BL] — bypasses computeImageCorners if present */
  corners?: [GeoPoint, GeoPoint, GeoPoint, GeoPoint];
}

export const lotImageOverlaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  imageUrl: z.string().min(1),
  storagePath: z.string().optional(),
  bounds: z.tuple([geoPointSchema, geoPointSchema]),
  opacity: z.number().min(0).max(1),
  rotationDeg: z.number(),
  scale: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  flipHorizontal: z.boolean(),
  flipVertical: z.boolean(),
  corners: z.tuple([geoPointSchema, geoPointSchema, geoPointSchema, geoPointSchema]).optional(),
});

// ---------------------------------------------------------------------------
// LotSpace — individual parking space as a polygon (v2)
// Replaces grid-computed cells with explicit coordinates per space.
// ---------------------------------------------------------------------------

export type SpaceType = 'standard' | 'handicap' | 'ev' | 'reserved' | 'service' | 'delivery';

export const SPACE_TYPE_VALUES = ['standard', 'handicap', 'ev', 'reserved', 'service', 'delivery'] as const;

export type SpaceStatus = 'available' | 'occupied' | 'blocked' | 'maintenance';

export const SPACE_STATUS_VALUES = ['available', 'occupied', 'blocked', 'maintenance'] as const;

/** Color map for space types — used by map rendering and UI */
export const SPACE_TYPE_COLORS: Record<SpaceType, string> = {
  standard: '#3b82f6',  // blue
  handicap: '#8b5cf6',  // purple
  ev: '#10b981',        // green
  reserved: '#f59e0b',  // amber
  service: '#ef4444',   // red
  delivery: '#6366f1',  // indigo
} as const;

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  standard: 'Standard',
  handicap: 'Handicap',
  ev: 'EV Charging',
  reserved: 'Reserved',
  service: 'Service',
  delivery: 'Delivery',
} as const;

export interface LotSpace {
  id: string;
  name: string;                    // Radio name, e.g. "Alpha-1"
  type: SpaceType;
  coordinates: [number, number][]; // GeoJSON order: [lng, lat] — closed polygon (first === last)
  status: SpaceStatus;
  vin?: string;
  stockNumber?: string;
  color?: string;                  // Override color (null = use type default)
  label?: string;                  // Custom display label
  tags?: string[];                 // Grouping tags, e.g. ["front-row", "new-inventory"]
  gridId?: string;                 // Source grid ID if generated from grid params
}

export const lotSpaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(SPACE_TYPE_VALUES),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(4), // min 3 vertices + closing vertex
  status: z.enum(SPACE_STATUS_VALUES),
  vin: z.string().optional(),
  stockNumber: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  label: z.string().optional(),
  tags: z.array(z.string()).optional(),
  gridId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// LotGridConfig — top-level config document per store
// ---------------------------------------------------------------------------

export interface LotGridConfig {
  id?: string; // Firestore doc ID
  storeId: string;
  groupId: string;
  name: string; // e.g. "Main Lot", "Overflow Lot"

  // Map center
  center: GeoPoint;
  zoom: number; // Mapbox zoom level (15-20 for lot)
  bearing: number; // Map rotation in degrees

  // Grid overlays (v1 — kept for GridGeneratorPanel input)
  grids: LotGrid[];

  // Polygon spaces (v2 — the rendered output)
  spaces: LotSpace[];

  // Image overlays
  imageOverlays: LotImageOverlay[];

  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string; // UID of admin who created
}

export const lotGridConfigSchema = z.object({
  id: z.string().optional(),
  storeId: z.string().min(1),
  groupId: z.string().min(1),
  name: z.string().min(1),
  center: geoPointSchema,
  zoom: z.number().min(1).max(22),
  bearing: z.number().min(-360).max(360),
  grids: z.array(lotGridSchema),
  spaces: z.array(lotSpaceSchema).default([]),
  imageOverlays: z.array(lotImageOverlaySchema),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  createdBy: z.string().optional(),
});
