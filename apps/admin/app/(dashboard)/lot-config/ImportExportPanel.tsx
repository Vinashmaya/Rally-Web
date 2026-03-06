'use client';

import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { useLotConfigStore } from '@rally/services';
import type { LotSpace, LotGridConfig } from '@rally/firebase';
import { Upload, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@rally/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSpaceId(): string {
  return `space-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function computeCentroid(coordinates: [number, number][]): { lat: number; lng: number } {
  const verts = coordinates.slice(0, -1);
  const lat = verts.reduce((s, v) => s + v[1], 0) / verts.length;
  const lng = verts.reduce((s, v) => s + v[0], 0) / verts.length;
  return { lat, lng };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportExportPanel() {
  const store = useLotConfigStore();
  const config = store.config;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Import ──────────────────────────────────────────────────────────────

  function clearMessages() {
    setImportMessage(null);
    setImportError(null);
  }

  async function handleFile(file: File) {
    clearMessages();

    try {
      const text = await file.text();

      if (file.name.endsWith('.csv')) {
        setImportError('CSV import is not supported. Use JSON or GeoJSON.');
        return;
      }

      const parsed = JSON.parse(text);
      let importedSpaces: LotSpace[] = [];

      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        // GeoJSON FeatureCollection
        let featureIndex = 0;
        for (const feature of parsed.features) {
          if (
            feature.type === 'Feature' &&
            feature.geometry?.type === 'Polygon' &&
            Array.isArray(feature.geometry.coordinates?.[0])
          ) {
            featureIndex++;
            importedSpaces.push({
              id: generateSpaceId(),
              name: feature.properties?.name || `Space-${featureIndex}`,
              type: feature.properties?.type || 'standard',
              coordinates: feature.geometry.coordinates[0] as [number, number][],
              status: 'available',
            });
          }
        }
      } else if (Array.isArray(parsed.spaces)) {
        // Rally JSON config with spaces array
        for (const space of parsed.spaces) {
          importedSpaces.push({
            ...space,
            id: generateSpaceId(),
            status: space.status || 'available',
            type: space.type || 'standard',
          });
        }
      } else {
        setImportError('Unrecognized file format. Expected a JSON with a "spaces" array or a GeoJSON FeatureCollection.');
        return;
      }

      if (importedSpaces.length === 0) {
        setImportError('No valid spaces found in file.');
        return;
      }

      store.addSpaces(importedSpaces);
      setImportMessage(`Imported ${importedSpaces.length} space${importedSpaces.length === 1 ? '' : 's'}.`);
    } catch {
      setImportError('Failed to parse file. Ensure it is valid JSON or GeoJSON.');
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so re-selecting the same file triggers onChange again
    e.target.value = '';
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Export ──────────────────────────────────────────────────────────────

  const safeName = (config?.name || 'untitled').replace(/\s+/g, '-').toLowerCase();

  function exportJSON() {
    if (!config) return;
    const payload: Partial<LotGridConfig> = {
      name: config.name,
      spaces: config.spaces,
    };
    downloadFile(JSON.stringify(payload, null, 2), `lot-config-${safeName}.json`, 'application/json');
  }

  function exportGeoJSON() {
    if (!config) return;
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: config.spaces.map((space) => ({
        type: 'Feature' as const,
        properties: {
          name: space.name,
          type: space.type,
          status: space.status,
          id: space.id,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [space.coordinates],
        },
      })),
    };
    downloadFile(
      JSON.stringify(featureCollection, null, 2),
      `lot-config-${safeName}.geojson`,
      'application/geo+json',
    );
  }

  function exportCSV() {
    if (!config) return;
    const header = 'name,type,status,centroid_lat,centroid_lng,vertex_count';
    const rows = config.spaces.map((space) => {
      const centroid = computeCentroid(space.coordinates);
      const vertexCount = space.coordinates.length > 0 ? space.coordinates.length - 1 : 0;
      return `${space.name},${space.type},${space.status},${centroid.lat.toFixed(6)},${centroid.lng.toFixed(6)},${vertexCount}`;
    });
    downloadFile([header, ...rows].join('\n'), `lot-config-${safeName}.csv`, 'text/csv');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const btnClass =
    'flex items-center gap-2 px-3 py-2.5 rounded-lg border border-surface-border text-text-secondary text-sm hover:border-rally-gold hover:text-rally-gold transition-colors w-full justify-center';

  return (
    <Card>
      <CardContent className="space-y-5">
        {/* Import */}
        <div>
          <h3 className="text-xs font-semibold text-rally-gold uppercase tracking-wider mb-2">
            Import
          </h3>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.geojson,.csv"
            className="hidden"
            onChange={handleFileInput}
          />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragOver
                ? 'border-rally-gold text-rally-gold'
                : 'border-surface-border hover:border-rally-gold'
            }`}
          >
            <Upload className="w-5 h-5 mx-auto mb-2 text-text-secondary" />
            <p className="text-sm text-text-secondary">
              Drop a file here or click to browse
            </p>
            <p className="text-xs text-text-tertiary mt-1">
              .json, .geojson, .csv
            </p>
          </div>

          {importMessage && (
            <p className="text-sm text-green-400 mt-2">{importMessage}</p>
          )}
          {importError && (
            <p className="text-sm text-red-400 mt-2">{importError}</p>
          )}
        </div>

        {/* Export */}
        <div>
          <h3 className="text-xs font-semibold text-rally-gold uppercase tracking-wider mb-2">
            Export
          </h3>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={btnClass}
              onClick={exportJSON}
              disabled={!config || config.spaces.length === 0}
            >
              <FileJson className="w-4 h-4" />
              Export JSON
            </button>

            <button
              type="button"
              className={btnClass}
              onClick={exportGeoJSON}
              disabled={!config || config.spaces.length === 0}
            >
              <Download className="w-4 h-4" />
              Export GeoJSON
            </button>

            <button
              type="button"
              className={btnClass}
              onClick={exportCSV}
              disabled={!config || config.spaces.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
