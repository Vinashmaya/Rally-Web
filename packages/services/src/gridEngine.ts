// Grid Engine — coordinate transforms, cell calculations, grid-to-GeoJSON
// Ported from Swift GridEngine.swift + GridModels.swift (GridNavApp)

import type { GeoPoint, LotGrid, LotGridConfig } from '@rally/firebase';
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
