'use client';

// Manage portal Mapbox GL fleet map
// Renders all GPS-tracked vehicles for the active store/group as colored markers.
// Color encodes battery health (critical/warning/healthy) when known, otherwise status.

import { useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { FleetVehicle, FleetVehicleStatus } from '@rally/firebase';

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// ---------------------------------------------------------------------------
// Color helpers — battery first, then status fallback
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<FleetVehicleStatus, string> = {
  moving: '#22C55E',
  parked: '#D4A017',
  offline: '#6B7280',
} as const;

function colorForVehicle(v: FleetVehicle, lowVoltageMap: Map<string, number>): string {
  const voltage = lowVoltageMap.get(v.vin);
  if (voltage !== undefined) {
    if (voltage < 11.5) return '#EF4444'; // critical
    if (voltage < 12.0) return '#F59E0B'; // warning
    return '#22C55E'; // healthy
  }
  return STATUS_COLORS[v.status];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FleetMapProps {
  vehicles: FleetVehicle[];
  /** Map of VIN -> voltage from useBatteryReports */
  voltageByVin: Map<string, number>;
  onVehicleClick?: (vehicle: FleetVehicle) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FleetMap({
  vehicles,
  voltageByVin,
  onVehicleClick,
  className,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-86.4564, 36.3884],
      zoom: 11,
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

  const createMarkerElement = useCallback(
    (vehicle: FleetVehicle, color: string): HTMLDivElement => {
      const el = document.createElement('div');
      el.className = 'fleet-marker';
      el.style.cssText = `
        width: 28px; height: 28px; cursor: pointer; position: relative;
        display: flex; align-items: center; justify-content: center;
      `;

      const ring = document.createElement('div');
      ring.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        border: 2px solid ${color}; background: ${color}22;
        display: flex; align-items: center; justify-content: center;
      `;
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 10px; height: 10px; border-radius: 50%; background: ${color};
      `;
      ring.appendChild(dot);
      el.appendChild(ring);

      el.title = `${vehicle.stockNumber} — ${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      return el;
    },
    [],
  );

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(vehicles.map((v) => v.id));
    const existing = markersRef.current;

    for (const [id, marker] of existing) {
      if (!currentIds.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    const valid = vehicles.filter((v) => v.latitude !== 0 || v.longitude !== 0);
    const initialEmpty = existing.size === 0;

    for (const vehicle of valid) {
      const color = colorForVehicle(vehicle, voltageByVin);
      const prev = existing.get(vehicle.id);
      if (prev) {
        prev.setLngLat([vehicle.longitude, vehicle.latitude]);
      } else {
        const el = createMarkerElement(vehicle, color);
        if (onVehicleClick) {
          el.addEventListener('click', () => onVehicleClick(vehicle));
        }
        const voltage = voltageByVin.get(vehicle.vin);
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
                  ${voltage !== undefined ? `${voltage.toFixed(2)}V` : vehicle.status}
                  ${vehicle.batteryPercentage !== undefined ? ` · ${vehicle.batteryPercentage}%` : ''}
                </div>
              </div>
            `),
          )
          .addTo(map);
        existing.set(vehicle.id, marker);
      }
    }

    if (valid.length > 0 && initialEmpty) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const v of valid) {
        bounds.extend([v.longitude, v.latitude]);
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  }, [vehicles, voltageByVin, createMarkerElement, onVehicleClick]);

  return (
    <>
      <style>{`
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
