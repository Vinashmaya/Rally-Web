'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LotGrid, LotGridConfig, LotImageOverlay, GeoPoint } from '@rally/firebase';
import {
  generateGridLinesGeoJSON,
  generateCellsGeoJSON,
  DealerNameGenerator,
  offsetLatLng,
  rotatePoint,
  getDeltaMeters,
} from '@rally/services';

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LotConfigMapProps {
  config: LotGridConfig;
  onCellClick?: (gridId: string, row: number, col: number, dealerName: string) => void;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Source/Layer IDs
// ---------------------------------------------------------------------------

const GRID_LINES_SOURCE = 'grid-lines';
const GRID_LINES_LAYER = 'grid-lines-layer';
const GRID_CELLS_SOURCE = 'grid-cells';
const GRID_CELLS_FILL_LAYER = 'grid-cells-fill';
const GRID_CELLS_HOVER_LAYER = 'grid-cells-hover';
const IMAGE_OVERLAY_SOURCE = 'lot-image';
const IMAGE_OVERLAY_LAYER = 'lot-image-layer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute 4 corner coordinates for a Mapbox image source from an overlay config. */
function computeImageCorners(
  overlay: LotImageOverlay,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [sw, ne] = overlay.bounds;

  // Center of bounds
  const centerLat = (sw.latitude + ne.latitude) / 2;
  const centerLng = (sw.longitude + ne.longitude) / 2;
  const center: GeoPoint = { latitude: centerLat, longitude: centerLng };

  // Half-dimensions in meters
  const delta = getDeltaMeters(sw, ne);
  const halfW = (Math.abs(delta.x) * overlay.scale) / 2;
  const halfH = (Math.abs(delta.y) * overlay.scale) / 2;

  // Apply flip
  const fx = overlay.flipHorizontal ? -1 : 1;
  const fy = overlay.flipVertical ? -1 : 1;

  // Local corners (relative to center, before rotation)
  const localCorners: [number, number][] = [
    [-halfW * fx + overlay.offsetX, halfH * fy + overlay.offsetY],   // top-left
    [halfW * fx + overlay.offsetX, halfH * fy + overlay.offsetY],    // top-right
    [halfW * fx + overlay.offsetX, -halfH * fy + overlay.offsetY],   // bottom-right
    [-halfW * fx + overlay.offsetX, -halfH * fy + overlay.offsetY],  // bottom-left
  ];

  // Rotate and project each corner
  return localCorners.map(([dx, dy]) => {
    const rotated = rotatePoint(dx, dy, overlay.rotationDeg);
    const point = offsetLatLng(center, rotated.x, rotated.y);
    return [point.longitude, point.latitude] as [number, number];
  }) as [[number, number], [number, number], [number, number], [number, number]];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LotConfigMap({
  config,
  onCellClick,
  onMapClick,
  className,
}: LotConfigMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [config.center.longitude, config.center.latitude],
      zoom: config.zoom,
      bearing: config.bearing,
      pitch: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapLoaded(true);
    });

    // Click handler for coordinate capture
    map.on('click', (e) => {
      onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
    // Only init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center/zoom/bearing when config changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    mapRef.current.flyTo({
      center: [config.center.longitude, config.center.latitude],
      zoom: config.zoom,
      bearing: config.bearing,
      duration: 1000,
    });
  }, [config.center, config.zoom, config.bearing, mapLoaded]);

  // Render grid lines and cells
  const renderGrids = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing grid layers/sources
    [GRID_LINES_LAYER, GRID_CELLS_FILL_LAYER, GRID_CELLS_HOVER_LAYER].forEach((layerId) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    });
    [GRID_LINES_SOURCE, GRID_CELLS_SOURCE].forEach((sourceId) => {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    });

    const visibleGrids = config.grids.filter((g) => g.visible);
    if (visibleGrids.length === 0) return;

    // Merge all grid lines into one FeatureCollection
    const allLines: GeoJSON.Feature[] = [];
    const allCells: GeoJSON.Feature[] = [];

    for (const grid of visibleGrids) {
      const linesGeoJSON = generateGridLinesGeoJSON(grid);
      allLines.push(...linesGeoJSON.features);

      const cellsGeoJSON = generateCellsGeoJSON(grid);
      allCells.push(...cellsGeoJSON.features);
    }

    // Add grid lines
    map.addSource(GRID_LINES_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: allLines },
    });
    map.addLayer({
      id: GRID_LINES_LAYER,
      type: 'line',
      source: GRID_LINES_SOURCE,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1,
        'line-opacity': 0.6,
      },
    });

    // Add cell fills (transparent, for hover/click)
    map.addSource(GRID_CELLS_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: allCells },
    });
    map.addLayer({
      id: GRID_CELLS_FILL_LAYER,
      type: 'fill',
      source: GRID_CELLS_SOURCE,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.05,
      },
    });
    map.addLayer({
      id: GRID_CELLS_HOVER_LAYER,
      type: 'fill',
      source: GRID_CELLS_SOURCE,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.3,
      },
      filter: ['==', 'cellId', ''],
    });

    // Hover effect
    map.on('mousemove', GRID_CELLS_FILL_LAYER, (e) => {
      if (!e.features?.[0]) return;
      map.getCanvas().style.cursor = 'pointer';
      const cellId = e.features[0].properties?.cellId ?? '';
      map.setFilter(GRID_CELLS_HOVER_LAYER, ['==', 'cellId', cellId]);

      // Show popup with dealer name
      const dealerName = e.features[0].properties?.dealerName ?? '';
      const row = e.features[0].properties?.row ?? 0;
      const col = e.features[0].properties?.col ?? 0;
      const centerLng = e.features[0].properties?.centerLng ?? e.lngLat.lng;
      const centerLat = e.features[0].properties?.centerLat ?? e.lngLat.lat;

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'lot-cell-popup',
        });
      }

      popupRef.current
        .setLngLat([centerLng, centerLat])
        .setHTML(
          `<div style="font-family:monospace;font-size:12px;color:#D4A017;font-weight:bold">${dealerName}</div>` +
          `<div style="font-family:monospace;font-size:10px;color:#999">Row ${row} · Col ${col}</div>`,
        )
        .addTo(map);
    });

    map.on('mouseleave', GRID_CELLS_FILL_LAYER, () => {
      map.getCanvas().style.cursor = '';
      map.setFilter(GRID_CELLS_HOVER_LAYER, ['==', 'cellId', '']);
      popupRef.current?.remove();
    });

    // Click handler for cells
    map.on('click', GRID_CELLS_FILL_LAYER, (e) => {
      if (!e.features?.[0]) return;
      const props = e.features[0].properties;
      if (props) {
        onCellClick?.(
          props.gridId,
          props.row,
          props.col,
          props.dealerName,
        );
      }
      e.originalEvent.stopPropagation();
    });
  }, [config.grids, mapLoaded, onCellClick]);

  // Render image overlays
  const renderImageOverlays = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing image overlay
    if (map.getLayer(IMAGE_OVERLAY_LAYER)) map.removeLayer(IMAGE_OVERLAY_LAYER);
    if (map.getSource(IMAGE_OVERLAY_SOURCE)) map.removeSource(IMAGE_OVERLAY_SOURCE);

    if (config.imageOverlays.length === 0) return;

    // Render the first overlay (primary lot image)
    const overlay = config.imageOverlays[0];
    if (!overlay) return;

    const corners = computeImageCorners(overlay);

    map.addSource(IMAGE_OVERLAY_SOURCE, {
      type: 'image',
      url: overlay.imageUrl,
      coordinates: corners,
    });

    // Insert below grid lines
    const beforeLayer = map.getLayer(GRID_LINES_LAYER) ? GRID_LINES_LAYER : undefined;
    map.addLayer(
      {
        id: IMAGE_OVERLAY_LAYER,
        type: 'raster',
        source: IMAGE_OVERLAY_SOURCE,
        paint: {
          'raster-opacity': overlay.opacity,
        },
      },
      beforeLayer,
    );
  }, [config.imageOverlays, mapLoaded]);

  // Re-render when config changes
  useEffect(() => {
    renderImageOverlays();
  }, [renderImageOverlays]);

  useEffect(() => {
    renderGrids();
  }, [renderGrids]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[500px] rounded-lg overflow-hidden border border-[var(--surface-border)] ${className ?? ''}`}
    />
  );
}
