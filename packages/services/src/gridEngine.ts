// Grid Engine — coordinate transforms, cell calculations, grid-to-GeoJSON
// Ported from Swift GridEngine.swift + GridModels.swift (GridNavApp)

import type { GeoPoint, LotGrid, LotGridConfig, LotSpace, SpaceType } from '@rally/firebase';
import { SPACE_TYPE_COLORS } from '@rally/firebase';
import type { Feature, FeatureCollection } from 'geojson';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EARTH_RADIUS = 6378137; // WGS84 semi-major axis in meters
const FT_TO_M = 0.3048;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Grid Hit — result of coordinate-to-cell lookup
// ---------------------------------------------------------------------------

export interface GridHit {
  gridId: string;
  row: number;
  col: number;
  cellId: string;
}

// ---------------------------------------------------------------------------
// Coordinate Transforms
// ---------------------------------------------------------------------------

/** Rotate a 2D point by angleDeg degrees (standard rotation matrix). */
export function rotatePoint(dx: number, dy: number, angleDeg: number): { x: number; y: number } {
  const rad = angleDeg * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Offset a GeoPoint by dx (east) and dy (north) in meters. */
export function offsetLatLng(origin: GeoPoint, dx: number, dy: number): GeoPoint {
  const dLat = dy / EARTH_RADIUS;
  const dLon = dx / (EARTH_RADIUS * Math.cos(origin.latitude * DEG_TO_RAD));
  return {
    latitude: origin.latitude + dLat * RAD_TO_DEG,
    longitude: origin.longitude + dLon * RAD_TO_DEG,
  };
}

/** Get the delta in meters between two GeoPoints (x = east, y = north). */
export function getDeltaMeters(origin: GeoPoint, point: GeoPoint): { x: number; y: number } {
  const dLat = (point.latitude - origin.latitude) * DEG_TO_RAD;
  const dLon = (point.longitude - origin.longitude) * DEG_TO_RAD;
  const y = dLat * EARTH_RADIUS;
  const x = dLon * EARTH_RADIUS * Math.cos(origin.latitude * DEG_TO_RAD);
  return { x, y };
}

// ---------------------------------------------------------------------------
// Grid Metric Helpers
// ---------------------------------------------------------------------------

export function cellWidthMeters(grid: LotGrid): number {
  return grid.cellWidthFt * FT_TO_M;
}

export function cellHeightMeters(grid: LotGrid): number {
  return grid.cellHeightFt * FT_TO_M;
}

export function totalWidthMeters(grid: LotGrid): number {
  return grid.cols * cellWidthMeters(grid);
}

export function totalHeightMeters(grid: LotGrid): number {
  return grid.rows * cellHeightMeters(grid);
}

// ---------------------------------------------------------------------------
// Grid Hit Detection
// ---------------------------------------------------------------------------

/** Find which grid cell (if any) a coordinate falls in. Searches grids back-to-front. */
export function getGridHit(config: LotGridConfig, point: GeoPoint): GridHit | null {
  const grids = [...config.grids].reverse();

  for (const grid of grids) {
    if (!grid.visible) continue;

    const delta = getDeltaMeters(grid.origin, point);
    const local = rotatePoint(delta.x, delta.y, -grid.rotationDeg);

    const totalW = totalWidthMeters(grid);
    const totalH = totalHeightMeters(grid);

    // Grid extends right (+x) and down (-y) from origin
    if (local.x >= 0 && local.x <= totalW && local.y <= 0 && local.y >= -totalH) {
      const col = Math.min(Math.floor(local.x / cellWidthMeters(grid)), grid.cols - 1);
      const row = Math.min(Math.floor(Math.abs(local.y) / cellHeightMeters(grid)), grid.rows - 1);
      return { gridId: grid.id, row, col, cellId: `${row}-${col}` };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cell Center Calculation
// ---------------------------------------------------------------------------

/** Get the GeoPoint at the center of a specific cell. */
export function getCellCenter(grid: LotGrid, row: number, col: number): GeoPoint {
  const cx = (col + 0.5) * cellWidthMeters(grid);
  const cy = -(row + 0.5) * cellHeightMeters(grid);
  const rotated = rotatePoint(cx, cy, grid.rotationDeg);
  return offsetLatLng(grid.origin, rotated.x, rotated.y);
}

/** Get the GeoPoint at the center of an entire grid. */
export function getGridCenter(grid: LotGrid): GeoPoint {
  const cx = totalWidthMeters(grid) / 2;
  const cy = -totalHeightMeters(grid) / 2;
  const rotated = rotatePoint(cx, cy, grid.rotationDeg);
  return offsetLatLng(grid.origin, rotated.x, rotated.y);
}

// ---------------------------------------------------------------------------
// Grid → GeoJSON (for Mapbox rendering)
// ---------------------------------------------------------------------------

/** Get a grid corner point as [lng, lat] for Mapbox. */
function getGridPoint(grid: LotGrid, row: number, col: number): [number, number] {
  const cx = col * cellWidthMeters(grid);
  const cy = -row * cellHeightMeters(grid);
  const rotated = rotatePoint(cx, cy, grid.rotationDeg);
  const point = offsetLatLng(grid.origin, rotated.x, rotated.y);
  return [point.longitude, point.latitude];
}

/** Generate GeoJSON LineString features for all grid lines (rows + cols). */
export function generateGridLinesGeoJSON(grid: LotGrid): FeatureCollection {
  const features: Feature[] = [];

  // Horizontal lines (rows)
  for (let r = 0; r <= grid.rows; r++) {
    const start = getGridPoint(grid, r, 0);
    const end = getGridPoint(grid, r, grid.cols);
    features.push({
      type: 'Feature',
      properties: { gridId: grid.id, lineType: 'row', index: r, color: grid.color },
      geometry: { type: 'LineString', coordinates: [start, end] },
    });
  }

  // Vertical lines (cols)
  for (let c = 0; c <= grid.cols; c++) {
    const start = getGridPoint(grid, 0, c);
    const end = getGridPoint(grid, grid.rows, c);
    features.push({
      type: 'Feature',
      properties: { gridId: grid.id, lineType: 'col', index: c, color: grid.color },
      geometry: { type: 'LineString', coordinates: [start, end] },
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Generate GeoJSON Polygon features for each cell in a grid. */
export function generateCellsGeoJSON(grid: LotGrid): FeatureCollection {
  const features: Feature[] = [];

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const tl = getGridPoint(grid, r, c);
      const tr = getGridPoint(grid, r, c + 1);
      const br = getGridPoint(grid, r + 1, c + 1);
      const bl = getGridPoint(grid, r + 1, c);

      const dealerName = DealerNameGenerator.generate(c, r, grid.label);
      const center = getCellCenter(grid, r, c);

      features.push({
        type: 'Feature',
        properties: {
          gridId: grid.id,
          row: r,
          col: c,
          cellId: `${r}-${c}`,
          dealerName,
          centerLat: center.latitude,
          centerLng: center.longitude,
          color: grid.color,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[tl, tr, br, bl, tl]],
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

/** Generate GeoJSON for the grid boundary polygon. */
export function generateGridBoundaryGeoJSON(grid: LotGrid): Feature {
  const tl = getGridPoint(grid, 0, 0);
  const tr = getGridPoint(grid, 0, grid.cols);
  const br = getGridPoint(grid, grid.rows, grid.cols);
  const bl = getGridPoint(grid, grid.rows, 0);

  return {
    type: 'Feature',
    properties: { gridId: grid.id, color: grid.color },
    geometry: {
      type: 'Polygon',
      coordinates: [[tl, tr, br, bl, tl]],
    },
  };
}

// ---------------------------------------------------------------------------
// Dealer Name Generator
// ---------------------------------------------------------------------------

export const DealerNameGenerator = {
  listA: [
    'Approval', 'Allowance', 'Beacon', 'Beback', 'Bonus', 'Booked', 'Bureau', 'Buy',
    'Call', 'Cap', 'Cash', 'Close', 'Cold', 'Credit', 'Deal', 'Demo', 'Desk', 'Down',
    'Drive', 'Early', 'Equity', 'FICO', 'First', 'Floor', 'Fresh', 'Front', 'Gross',
    'Heat', 'Hold', 'Hot', 'Incentive', 'Invoice', 'Late', 'Lead', 'Lease', 'Lender',
    'Liner', 'Live', 'Load', 'Maker', 'Max', 'Menu', 'Mini', 'Negative', 'Net', 'New',
    'Note', 'Offer', 'Open', 'Owner', 'Payment', 'Pencil', 'Phone', 'Plus', 'Point',
    'Prime', 'Profit', 'Quote', 'Rate', 'Rebate', 'Red', 'Retail', 'Roll', 'Score',
    'Sign', 'Sold', 'Split', 'Spot', 'Sticker', 'Sub', 'Switch', 'Tag', 'Target',
    'Term', 'Tier', 'Title', 'Top', 'Total', 'Trade', 'Traffic', 'Turn', 'Unit', 'Ups',
    'Used', 'VIP', 'Walk', 'Wash', 'Write', 'Yield', 'Zero',
  ],

  listB: [
    'Ally', 'Asphalt', 'Auction', 'Axle', 'Bank', 'Bar', 'Bay', 'Bed', 'Block', 'Body',
    'Bolt', 'Box', 'Brand', 'Bucket', 'Bumper', 'Camera', 'Chain', 'Charger', 'Check',
    'Chip', 'Clutch', 'Code', 'Color', 'Compass', 'Crew', 'Cummins', 'Detail', 'Diesel',
    'Door', 'Dually', 'Engine', 'Exhaust', 'Fence', 'Filter', 'Fleet', 'Folder', 'Form',
    'Frame', 'Fuel', 'Fuse', 'Gap', 'Gas', 'Gate', 'Gauge', 'Gear', 'Glass', 'Grill',
    'Hemi', 'Hitch', 'Hood', 'Horn', 'Hub', 'Intake', 'Jacket', 'Jeep', 'Key', 'Kit',
    'Lane', 'Lift', 'Light', 'Line', 'Link', 'Lot', 'Map', 'Mat', 'Meter', 'Mile',
    'Mirror', 'Model', 'Motor', 'Mount', 'Oil', 'Order', 'Pack', 'Paint', 'Panel',
    'Park', 'Part', 'Pipe', 'Plate', 'Plug', 'Pump', 'Rack', 'Radio', 'Rail', 'Ram',
    'Rim', 'Roof', 'Row', 'RT', 'Seat', 'Sensor', 'Shaft', 'Shift', 'Shop', 'Skid',
    'Spec', 'Sport', 'Srt', 'Stack', 'Stock', 'System', 'Tank', 'Ticket', 'Tire',
    'Tool', 'Track', 'Trail', 'Trim', 'Truck', 'Trunk', 'Turbo', 'Value', 'Valve',
    'Van', 'Vent', 'View', 'Vin', 'V8', 'Wagon', 'Warranty', 'Wheel', 'Winch',
    'Window', 'Wiper', 'Wire', 'Yard', 'Zone',
  ],

  /** Generate a deterministic two-word name for a grid cell. */
  generate(col: number, row: number, gridName: string = ''): string {
    let hash = 0;
    for (let i = 0; i < gridName.length; i++) {
      hash = gridName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const offset = Math.abs(hash);
    const word1Idx = ((Math.abs(col) * 37) + (Math.abs(row) * 13) + offset) % this.listA.length;
    const word2Idx = ((Math.abs(col) * 29) + (Math.abs(row) * 53) + offset) % this.listB.length;
    return `${this.listA[word1Idx]}-${this.listB[word2Idx]}`;
  },
} as const;

// ---------------------------------------------------------------------------
// Grid → LotSpace[] converter (v1 → v2 bridge)
// ---------------------------------------------------------------------------

export interface GenerateSpacesOptions {
  grid: LotGrid;
  type?: SpaceType;
  namingPattern?: 'dealer' | 'alpha-numeric' | 'numeric';
  prefix?: string;
}

/** Convert grid parameters into individual LotSpace polygon objects. */
export function generateSpacesFromGrid(options: GenerateSpacesOptions): LotSpace[] {
  const { grid, type = 'standard', namingPattern = 'dealer', prefix = '' } = options;
  const spaces: LotSpace[] = [];
  const timestamp = Date.now();

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const tl = getGridPoint(grid, r, c);
      const tr = getGridPoint(grid, r, c + 1);
      const br = getGridPoint(grid, r + 1, c + 1);
      const bl = getGridPoint(grid, r + 1, c);

      let name: string;
      switch (namingPattern) {
        case 'alpha-numeric': {
          const rowLetter = String.fromCharCode(65 + (r % 26));
          name = `${prefix}${rowLetter}${c + 1}`;
          break;
        }
        case 'numeric': {
          name = `${prefix}${r * grid.cols + c + 1}`;
          break;
        }
        default: {
          name = DealerNameGenerator.generate(c, r, grid.label);
          break;
        }
      }

      spaces.push({
        id: `space-${timestamp}-${r}-${c}`,
        name,
        type,
        coordinates: [tl, tr, br, bl, tl], // Closed polygon
        status: 'available',
        gridId: grid.id,
      });
    }
  }

  return spaces;
}

// ---------------------------------------------------------------------------
// LotSpace[] → GeoJSON (for Mapbox polygon rendering)
// ---------------------------------------------------------------------------

/** Convert spaces to a GeoJSON FeatureCollection for map rendering. */
export function generateSpacesGeoJSON(
  spaces: LotSpace[],
  selectedSpaceIds: Set<string> = new Set(),
  hoveredSpaceId: string | null = null,
): FeatureCollection {
  const features: Feature[] = spaces.map((space) => ({
    type: 'Feature' as const,
    properties: {
      id: space.id,
      name: space.name,
      type: space.type,
      status: space.status,
      color: space.color ?? SPACE_TYPE_COLORS[space.type],
      isSelected: selectedSpaceIds.has(space.id),
      isHovered: space.id === hoveredSpaceId,
      vin: space.vin ?? null,
      stockNumber: space.stockNumber ?? null,
      label: space.label ?? space.name,
    },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [space.coordinates],
    },
  }));

  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Vertex GeoJSON — for edit-mode vertex handles
// ---------------------------------------------------------------------------

/** Generate GeoJSON Point features for each vertex of selected spaces. */
export function generateVertexGeoJSON(
  spaces: LotSpace[],
  selectedSpaceIds: Set<string>,
): FeatureCollection {
  const features: Feature[] = [];

  for (const space of spaces) {
    if (!selectedSpaceIds.has(space.id)) continue;

    // Skip closing vertex (same as first)
    const vertices = space.coordinates.slice(0, -1);
    for (let i = 0; i < vertices.length; i++) {
      features.push({
        type: 'Feature' as const,
        properties: {
          spaceId: space.id,
          vertexIndex: i,
          isVertex: true,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: vertices[i]!,
        },
      });

      // Midpoint between this vertex and the next
      const next = vertices[(i + 1) % vertices.length]!;
      const mid: [number, number] = [
        (vertices[i]![0] + next[0]) / 2,
        (vertices[i]![1] + next[1]) / 2,
      ];
      features.push({
        type: 'Feature' as const,
        properties: {
          spaceId: space.id,
          vertexIndex: i,
          isMidpoint: true,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: mid,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Point-in-Polygon (ray casting)
// ---------------------------------------------------------------------------

/** Test if a [lng, lat] point is inside a polygon (closed coordinate ring). */
export function pointInPolygon(
  point: [number, number],
  polygon: [number, number][],
): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]![0];
    const yi = polygon[i]![1];
    const xj = polygon[j]![0];
    const yj = polygon[j]![1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/** Find which space (if any) a [lng, lat] point falls inside. Returns space ID or null. */
export function getSpaceAtPoint(
  spaces: LotSpace[],
  point: [number, number],
): string | null {
  // Search in reverse so later (visually on-top) spaces take priority
  for (let i = spaces.length - 1; i >= 0; i--) {
    if (pointInPolygon(point, spaces[i]!.coordinates)) {
      return spaces[i]!.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Polygon Centroid
// ---------------------------------------------------------------------------

/** Calculate the centroid of a polygon (for label placement). */
export function polygonCentroid(coordinates: [number, number][]): [number, number] {
  // Use all vertices except closing duplicate
  const verts = coordinates.length > 1 &&
    coordinates[0]![0] === coordinates[coordinates.length - 1]![0] &&
    coordinates[0]![1] === coordinates[coordinates.length - 1]![1]
    ? coordinates.slice(0, -1)
    : coordinates;

  let sumX = 0;
  let sumY = 0;
  for (const v of verts) {
    sumX += v[0];
    sumY += v[1];
  }
  return [sumX / verts.length, sumY / verts.length];
}

// ---------------------------------------------------------------------------
// Polygon Bounding Box
// ---------------------------------------------------------------------------

/** Get the bounding box of a set of spaces: [[minLng, minLat], [maxLng, maxLat]]. */
export function spacesBoundingBox(
  spaces: LotSpace[],
): [[number, number], [number, number]] | null {
  if (spaces.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const space of spaces) {
    for (const [lng, lat] of space.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
  }

  return [[minLng, minLat], [maxLng, maxLat]];
}
