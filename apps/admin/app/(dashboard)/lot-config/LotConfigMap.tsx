'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LotGridConfig, LotImageOverlay, GeoPoint } from '@rally/firebase';
import {
  generateSpacesGeoJSON,
  generateVertexGeoJSON,
  getSpaceAtPoint,
  offsetLatLng,
  rotatePoint,
  getDeltaMeters,
} from '@rally/services';
import type { EditorMode } from '@rally/services';

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Source/Layer IDs
// ---------------------------------------------------------------------------

const SPACES_SOURCE = 'lot-spaces';
const SPACES_FILL_LAYER = 'lot-spaces-fill';
const SPACES_OUTLINE_LAYER = 'lot-spaces-outline';
const SPACES_LABELS_LAYER = 'lot-spaces-labels';
const VERTICES_SOURCE = 'lot-vertices';
const VERTICES_LAYER = 'lot-vertices-circles';
const MIDPOINTS_LAYER = 'lot-midpoints-circles';
const DRAWING_SOURCE = 'lot-drawing';
const DRAWING_LINE_LAYER = 'lot-drawing-line';
const DRAWING_FILL_LAYER = 'lot-drawing-fill';
const DRAWING_POINTS_LAYER = 'lot-drawing-points';
const IMAGE_OVERLAY_PREFIX = 'lot-image';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LotConfigMapProps {
  config: LotGridConfig;
  editorMode: EditorMode;
  selectedSpaceIds: Set<string>;
  hoveredSpaceId: string | null;
  drawingVertices: [number, number][];
  showLabels: boolean;
  onSpaceClick?: (spaceId: string, additive: boolean) => void;
  onEmptyClick?: (lngLat: [number, number]) => void;
  onDrawVertex?: (lngLat: [number, number]) => void;
  onDrawFinish?: () => void;
  onVertexDrag?: (spaceId: string, vertexIndex: number, lngLat: [number, number]) => void;
  onMidpointClick?: (spaceId: string, vertexIndex: number, lngLat: [number, number]) => void;
  onSpaceHover?: (spaceId: string | null) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeImageCorners(
  overlay: LotImageOverlay,
): [[number, number], [number, number], [number, number], [number, number]] {
  const [sw, ne] = overlay.bounds;
  const centerLat = (sw.latitude + ne.latitude) / 2;
  const centerLng = (sw.longitude + ne.longitude) / 2;
  const center: GeoPoint = { latitude: centerLat, longitude: centerLng };
  const delta = getDeltaMeters(sw, ne);
  const halfW = (Math.abs(delta.x) * overlay.scale) / 2;
  const halfH = (Math.abs(delta.y) * overlay.scale) / 2;
  const fx = overlay.flipHorizontal ? -1 : 1;
  const fy = overlay.flipVertical ? -1 : 1;
  const localCorners: [number, number][] = [
    [-halfW * fx + overlay.offsetX, halfH * fy + overlay.offsetY],
    [halfW * fx + overlay.offsetX, halfH * fy + overlay.offsetY],
    [halfW * fx + overlay.offsetX, -halfH * fy + overlay.offsetY],
    [-halfW * fx + overlay.offsetX, -halfH * fy + overlay.offsetY],
  ];
  return localCorners.map(([dx, dy]) => {
    const rotated = rotatePoint(dx, dy, overlay.rotationDeg);
    const point = offsetLatLng(center, rotated.x, rotated.y);
    return [point.longitude, point.latitude] as [number, number];
  }) as [[number, number], [number, number], [number, number], [number, number]];
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LotConfigMap({
  config,
  editorMode,
  selectedSpaceIds,
  hoveredSpaceId,
  drawingVertices,
  showLabels,
  onSpaceClick,
  onEmptyClick,
  onDrawVertex,
  onDrawFinish,
  onVertexDrag,
  onMidpointClick,
  onSpaceHover,
  className,
}: LotConfigMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const dragStateRef = useRef<{ spaceId: string; vertexIndex: number } | null>(null);

  // Stable callback refs
  const onSpaceClickRef = useRef(onSpaceClick);
  onSpaceClickRef.current = onSpaceClick;
  const onEmptyClickRef = useRef(onEmptyClick);
  onEmptyClickRef.current = onEmptyClick;
  const onDrawVertexRef = useRef(onDrawVertex);
  onDrawVertexRef.current = onDrawVertex;
  const onDrawFinishRef = useRef(onDrawFinish);
  onDrawFinishRef.current = onDrawFinish;
  const onVertexDragRef = useRef(onVertexDrag);
  onVertexDragRef.current = onVertexDrag;
  const onMidpointClickRef = useRef(onMidpointClick);
  onMidpointClickRef.current = onMidpointClick;
  const onSpaceHoverRef = useRef(onSpaceHover);
  onSpaceHoverRef.current = onSpaceHover;
  const editorModeRef = useRef(editorMode);
  editorModeRef.current = editorMode;

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
      // Add empty sources so layers can reference them immediately
      map.addSource(SPACES_SOURCE, { type: 'geojson', data: EMPTY_FC });
      map.addSource(VERTICES_SOURCE, { type: 'geojson', data: EMPTY_FC });
      map.addSource(DRAWING_SOURCE, { type: 'geojson', data: EMPTY_FC });

      // Space fill layer — data-driven color by type
      map.addLayer({
        id: SPACES_FILL_LAYER,
        type: 'fill',
        source: SPACES_SOURCE,
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': [
            'case',
            ['get', 'isSelected'], 0.5,
            ['get', 'isHovered'], 0.35,
            0.2,
          ],
        },
      });

      // Space outline layer — gold for selected, white for normal
      map.addLayer({
        id: SPACES_OUTLINE_LAYER,
        type: 'line',
        source: SPACES_SOURCE,
        paint: {
          'line-color': [
            'case',
            ['get', 'isSelected'], '#D4A017',
            ['get', 'isHovered'], '#D4A017',
            '#ffffff',
          ],
          'line-width': [
            'case',
            ['get', 'isSelected'], 2.5,
            1,
          ],
          'line-opacity': [
            'case',
            ['get', 'isSelected'], 1,
            ['get', 'isHovered'], 0.8,
            0.4,
          ],
        },
      });

      // Space labels
      map.addLayer({
        id: SPACES_LABELS_LAYER,
        type: 'symbol',
        source: SPACES_SOURCE,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
      });

      // Vertex circles (edit mode)
      map.addLayer({
        id: VERTICES_LAYER,
        type: 'circle',
        source: VERTICES_SOURCE,
        filter: ['==', ['get', 'isVertex'], true],
        paint: {
          'circle-radius': 6,
          'circle-color': '#D4A017',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2,
        },
      });

      // Midpoint circles (edit mode)
      map.addLayer({
        id: MIDPOINTS_LAYER,
        type: 'circle',
        source: VERTICES_SOURCE,
        filter: ['==', ['get', 'isMidpoint'], true],
        paint: {
          'circle-radius': 4,
          'circle-color': '#D4A017',
          'circle-opacity': 0.5,
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1,
        },
      });

      // Drawing preview layers
      map.addLayer({
        id: DRAWING_FILL_LAYER,
        type: 'fill',
        source: DRAWING_SOURCE,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#D4A017',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: DRAWING_LINE_LAYER,
        type: 'line',
        source: DRAWING_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#D4A017',
          'line-width': 2,
          'line-dasharray': [4, 4],
        },
      });

      map.addLayer({
        id: DRAWING_POINTS_LAYER,
        type: 'circle',
        source: DRAWING_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#D4A017',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2,
        },
      });

      setMapLoaded(true);
    });

    // Click handler — mode-dependent
    map.on('click', (e) => {
      const mode = editorModeRef.current;
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

      if (mode === 'draw') {
        onDrawVertexRef.current?.(lngLat);
        return;
      }

      if (mode === 'select') {
        // Check if clicked on a space
        const features = map.queryRenderedFeatures(e.point, { layers: [SPACES_FILL_LAYER] });
        if (features.length > 0) {
          const spaceId = features[0]?.properties?.id;
          if (spaceId) {
            onSpaceClickRef.current?.(spaceId, e.originalEvent.shiftKey);
          }
        } else {
          onEmptyClickRef.current?.(lngLat);
        }
        return;
      }

      if (mode === 'edit') {
        // Check midpoint click
        const midFeats = map.queryRenderedFeatures(e.point, { layers: [MIDPOINTS_LAYER] });
        if (midFeats.length > 0) {
          const props = midFeats[0]?.properties;
          if (props?.spaceId && props?.vertexIndex !== undefined) {
            onMidpointClickRef.current?.(props.spaceId, props.vertexIndex, lngLat);
          }
          return;
        }
        // Fallback: click space to select in edit mode
        const features = map.queryRenderedFeatures(e.point, { layers: [SPACES_FILL_LAYER] });
        if (features.length > 0) {
          const spaceId = features[0]?.properties?.id;
          if (spaceId) {
            onSpaceClickRef.current?.(spaceId, e.originalEvent.shiftKey);
          }
        }
      }
    });

    // Double-click finishes drawing
    map.on('dblclick', (e) => {
      if (editorModeRef.current === 'draw') {
        e.preventDefault();
        onDrawFinishRef.current?.();
      }
    });

    // Hover effect
    map.on('mousemove', (e) => {
      const mode = editorModeRef.current;

      if (mode === 'draw') {
        map.getCanvas().style.cursor = 'crosshair';
        return;
      }

      if (mode === 'edit') {
        const vertexFeats = map.queryRenderedFeatures(e.point, { layers: [VERTICES_LAYER, MIDPOINTS_LAYER] });
        if (vertexFeats.length > 0) {
          map.getCanvas().style.cursor = 'grab';
          return;
        }
      }

      if (mode === 'select' || mode === 'edit') {
        const features = map.queryRenderedFeatures(e.point, { layers: [SPACES_FILL_LAYER] });
        if (features.length > 0) {
          map.getCanvas().style.cursor = 'pointer';
          const spaceId = features[0]?.properties?.id ?? null;
          onSpaceHoverRef.current?.(spaceId);

          // Show popup
          if (spaceId && features[0]?.properties) {
            const props = features[0].properties;
            if (!popupRef.current) {
              popupRef.current = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'lot-space-popup',
                offset: 10,
              });
            }
            popupRef.current
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:monospace;font-size:12px;color:#D4A017;font-weight:bold">${props.name}</div>` +
                `<div style="font-family:monospace;font-size:10px;color:#999">${props.type}${props.vin ? ` · ${props.stockNumber ?? props.vin}` : ''}</div>`,
              )
              .addTo(map);
          }
        } else {
          map.getCanvas().style.cursor = mode === 'edit' ? 'crosshair' : '';
          onSpaceHoverRef.current?.(null);
          popupRef.current?.remove();
        }
        return;
      }

      map.getCanvas().style.cursor = '';
    });

    // Vertex dragging (edit mode)
    map.on('mousedown', VERTICES_LAYER, (e) => {
      if (editorModeRef.current !== 'edit') return;
      if (!e.features?.[0]?.properties) return;

      const props = e.features[0].properties;
      dragStateRef.current = { spaceId: props.spaceId, vertexIndex: props.vertexIndex };
      map.getCanvas().style.cursor = 'grabbing';

      // Disable map panning during drag
      map.dragPan.disable();

      const onMove = (moveE: mapboxgl.MapMouseEvent) => {
        if (!dragStateRef.current) return;
        onVertexDragRef.current?.(
          dragStateRef.current.spaceId,
          dragStateRef.current.vertexIndex,
          [moveE.lngLat.lng, moveE.lngLat.lat],
        );
      };

      const onUp = () => {
        dragStateRef.current = null;
        map.getCanvas().style.cursor = 'grab';
        map.dragPan.enable();
        map.off('mousemove', onMove);
        map.off('mouseup', onUp);
      };

      map.on('mousemove', onMove);
      map.on('mouseup', onUp);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
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
  }, [config.center.latitude, config.center.longitude, config.zoom, config.bearing, mapLoaded]);

  // Update spaces GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource(SPACES_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const geoJSON = generateSpacesGeoJSON(config.spaces, selectedSpaceIds, hoveredSpaceId);
    source.setData(geoJSON);
  }, [config.spaces, selectedSpaceIds, hoveredSpaceId, mapLoaded]);

  // Update vertex handles (edit mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource(VERTICES_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (editorMode === 'edit' && selectedSpaceIds.size > 0) {
      source.setData(generateVertexGeoJSON(config.spaces, selectedSpaceIds));
    } else {
      source.setData(EMPTY_FC);
    }
  }, [config.spaces, selectedSpaceIds, editorMode, mapLoaded]);

  // Update drawing preview
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const source = map.getSource(DRAWING_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    if (drawingVertices.length === 0) {
      source.setData(EMPTY_FC);
      return;
    }

    const features: GeoJSON.Feature[] = [];

    // Point markers at each vertex
    for (const v of drawingVertices) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: v },
        properties: {},
      });
    }

    // Line connecting vertices
    if (drawingVertices.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: drawingVertices },
        properties: {},
      });
    }

    // Polygon preview when 3+ vertices
    if (drawingVertices.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...drawingVertices, drawingVertices[0]!]],
        },
        properties: {},
      });
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [drawingVertices, mapLoaded]);

  // Toggle label visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer(SPACES_LABELS_LAYER)) {
      map.setLayoutProperty(SPACES_LABELS_LAYER, 'visibility', showLabels ? 'visible' : 'none');
    }
  }, [showLabels, mapLoaded]);

  // Render image overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove existing image overlays
    for (let i = 0; i < 10; i++) {
      const layerId = `${IMAGE_OVERLAY_PREFIX}-layer-${i}`;
      const sourceId = `${IMAGE_OVERLAY_PREFIX}-source-${i}`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }

    // Add each overlay
    config.imageOverlays.forEach((overlay, i) => {
      if (!overlay.imageUrl) return;

      const sourceId = `${IMAGE_OVERLAY_PREFIX}-source-${i}`;
      const layerId = `${IMAGE_OVERLAY_PREFIX}-layer-${i}`;

      const corners = overlay.corners
        ? overlay.corners.map((p) => [p.longitude, p.latitude] as [number, number]) as [[number, number], [number, number], [number, number], [number, number]]
        : computeImageCorners(overlay);

      map.addSource(sourceId, {
        type: 'image',
        url: overlay.imageUrl,
        coordinates: corners,
      });

      // Insert below space fill layer
      const beforeLayer = map.getLayer(SPACES_FILL_LAYER) ? SPACES_FILL_LAYER : undefined;
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': overlay.opacity },
      }, beforeLayer);
    });
  }, [config.imageOverlays, mapLoaded]);

  // Cursor based on editor mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (editorMode === 'draw') {
      map.getCanvas().style.cursor = 'crosshair';
    } else if (editorMode === 'pan') {
      map.getCanvas().style.cursor = '';
    }
  }, [editorMode, mapLoaded]);

  // Disable double-click zoom in draw mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (editorMode === 'draw') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [editorMode]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[500px] rounded-lg overflow-hidden border border-surface-border ${className ?? ''}`}
    />
  );
}
