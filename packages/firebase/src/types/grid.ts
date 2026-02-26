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
  imageUrl: string; // Firebase Storage download URL
  storagePath?: string; // gs:// path for deletion
  bounds: [GeoPoint, GeoPoint]; // [SW corner, NE corner]
  opacity: number; // 0-1
  rotationDeg: number;
  scale: number;
  offsetX: number; // Meters offset
  offsetY: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export const lotImageOverlaySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  imageUrl: z.string().url(),
  storagePath: z.string().optional(),
  bounds: z.tuple([geoPointSchema, geoPointSchema]),
  opacity: z.number().min(0).max(1),
  rotationDeg: z.number(),
  scale: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  flipHorizontal: z.boolean(),
  flipVertical: z.boolean(),
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

  // Grid overlays
  grids: LotGrid[];

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
  imageOverlays: z.array(lotImageOverlaySchema),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  createdBy: z.string().optional(),
});
