'use client';

import { useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FleetVehicle, FleetVehicleStatus } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Status → marker color
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<FleetVehicleStatus, string> = {
  moving: '#22C55E',
  parked: '#D4A017',
  offline: '#6B7280',
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FleetMapProps {
  vehicles: FleetVehicle[];
  onVehicleClick?: (vehicle: FleetVehicle) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FleetMap({ vehicles, onVehicleClick, className }: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) return;

    // Default center: Gallatin, TN (Rally HQ area)
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-86.4564, 36.3884],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-right',
    );

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-left',
    );

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Build marker HTML
  const createMarkerElement = useCallback(
    (vehicle: FleetVehicle): HTMLDivElement => {
      const color = STATUS_COLORS[vehicle.status];
      const el = document.createElement('div');
      el.className = 'fleet-marker';
      el.style.cssText = `
        width: 28px; height: 28px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      `;

      // Outer ring
      const ring = document.createElement('div');
      ring.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        border: 2px solid ${color}; background: ${color}22;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s;
      `;

      // Inner dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 10px; height: 10px; border-radius: 50%;
        background: ${color};
      `;

      // Pulse animation for moving vehicles
      if (vehicle.status === 'moving') {
        const pulse = document.createElement('div');
        pulse.style.cssText = `
          position: absolute; width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; opacity: 0; animation: markerPulse 2s infinite;
        `;
        el.appendChild(pulse);
      }

      ring.appendChild(dot);
      el.appendChild(ring);

      // Hover: show stock number tooltip
      el.title = `${vehicle.stockNumber} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`;

      return el;
    },
    [],
  );

  // Sync markers with vehicle data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(vehicles.map((v) => v.id));
    const existingMarkers = markersRef.current;

    // Remove markers for vehicles no longer in the list
    for (const [id, marker] of existingMarkers) {
      if (!currentIds.has(id)) {
        marker.remove();
        existingMarkers.delete(id);
      }
    }

    // Add or update markers
    const validVehicles = vehicles.filter(
      (v) => v.latitude !== 0 || v.longitude !== 0,
    );

    for (const vehicle of validVehicles) {
      const existing = existingMarkers.get(vehicle.id);

      if (existing) {
        // Update position
        existing.setLngLat([vehicle.longitude, vehicle.latitude]);
      } else {
        // Create new marker
        const el = createMarkerElement(vehicle);

        if (onVehicleClick) {
          el.addEventListener('click', () => onVehicleClick(vehicle));
        }

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([vehicle.longitude, vehicle.latitude])
          .setPopup(
            new mapboxgl.Popup({
              offset: 20,
              closeButton: false,
              className: 'fleet-popup',
            }).setHTML(`
              <div style="font-family: var(--font-geist-mono); padding: 4px 0;">
                <div style="font-weight: 700; color: #D4A017; font-size: 14px;">
                  ${vehicle.stockNumber}
                </div>
                <div style="font-size: 12px; color: #E4E4E7; margin-top: 2px;">
                  ${vehicle.year} ${vehicle.make} ${vehicle.model}
                </div>
                <div style="font-size: 11px; color: #A1A1AA; margin-top: 4px;">
                  ${vehicle.speed > 0 ? `${Math.round(vehicle.speed)} mph` : 'Stationary'}
                  ${vehicle.batteryPercentage !== undefined ? ` · ${vehicle.batteryPercentage}% battery` : ''}
                </div>
              </div>
            `),
          )
          .addTo(map);

        existingMarkers.set(vehicle.id, marker);
      }
    }

    // Fit bounds to all markers if we have vehicles
    if (validVehicles.length > 0 && !existingMarkers.size) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const v of validVehicles) {
        bounds.extend([v.longitude, v.latitude]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, [vehicles, createMarkerElement, onVehicleClick]);

  return (
    <>
      <style>{`
        @keyframes markerPulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .fleet-popup .mapboxgl-popup-content {
          background: #18181B;
          border: 1px solid #27272A;
          border-radius: 8px;
          padding: 8px 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .fleet-popup .mapboxgl-popup-tip {
          border-top-color: #18181B;
        }
      `}</style>
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', minHeight: 400, borderRadius: 'var(--radius-rally)' }}
      />
    </>
  );
}
