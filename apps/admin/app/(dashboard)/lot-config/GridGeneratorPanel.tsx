'use client';

import { useState } from 'react';
import { Grid3X3, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@rally/ui';
import { useLotConfigStore, generateSpacesFromGrid } from '@rally/services';
import {
  type LotGrid,
  type GeoPoint,
  SPACE_TYPE_VALUES,
  SPACE_TYPE_LABELS,
  type SpaceType,
} from '@rally/firebase';

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none';
const NUMBER_INPUT_CLASS = `${INPUT_CLASS} font-mono`;
const LABEL_CLASS = 'block text-xs font-medium text-text-secondary mb-1';

export default function GridGeneratorPanel() {
  const config = useLotConfigStore((s) => s.config);
  const addSpaces = useLotConfigStore((s) => s.addSpaces);

  // ── Local form state ──
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const [cellWidthFt, setCellWidthFt] = useState(9);
  const [cellHeightFt, setCellHeightFt] = useState(18);
  const [rotationDeg, setRotationDeg] = useState(43);
  const [originLat, setOriginLat] = useState(36.36966);
  const [originLng, setOriginLng] = useState(-86.48707);
  const [color, setColor] = useState('#3b82f6');
  const [gridLabel, setGridLabel] = useState('Main Lot');
  const [namingPattern, setNamingPattern] = useState<'dealer' | 'alpha-numeric' | 'numeric'>('dealer');
  const [spaceType, setSpaceType] = useState<SpaceType>('standard');

  const totalSpaces = rows * cols;

  function handleGenerate() {
    if (!config) return;

    const grid: LotGrid = {
      id: `grid-${Date.now()}`,
      label: gridLabel,
      type: 'base',
      origin: { latitude: originLat, longitude: originLng },
      rotationDeg,
      rows,
      cols,
      cellWidthFt,
      cellHeightFt,
      color,
      opacity: 1,
      visible: true,
    };

    const spaces = generateSpacesFromGrid({
      grid,
      type: spaceType,
      namingPattern,
    });

    addSpaces(spaces);
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-text-tertiary text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Load a config to generate spaces.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-rally-gold" />
          <h3 className="text-sm font-bold text-text-primary">Grid Generator</h3>
        </div>

        {/* Grid dimensions — 2-col grid */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLASS}>Rows</label>
            <input
              type="number"
              min={1}
              max={200}
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 1)}
              className={NUMBER_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Columns</label>
            <input
              type="number"
              min={1}
              max={200}
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value) || 1)}
              className={NUMBER_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Cell Width (ft)</label>
            <input
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={cellWidthFt}
              onChange={(e) => setCellWidthFt(parseFloat(e.target.value) || 1)}
              className={NUMBER_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Cell Height (ft)</label>
            <input
              type="number"
              min={1}
              max={100}
              step={0.5}
              value={cellHeightFt}
              onChange={(e) => setCellHeightFt(parseFloat(e.target.value) || 1)}
              className={NUMBER_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Rotation (deg)</label>
            <input
              type="number"
              min={-360}
              max={360}
              step={1}
              value={rotationDeg}
              onChange={(e) => setRotationDeg(parseFloat(e.target.value) || 0)}
              className={NUMBER_INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Label</label>
            <input
              type="text"
              value={gridLabel}
              onChange={(e) => setGridLabel(e.target.value)}
              placeholder="Main Lot"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Origin coordinates */}
        <div>
          <label className={LABEL_CLASS}>Origin</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step={0.00001}
              value={originLat}
              onChange={(e) => setOriginLat(parseFloat(e.target.value) || 0)}
              placeholder="Latitude"
              className={NUMBER_INPUT_CLASS}
            />
            <input
              type="number"
              step={0.00001}
              value={originLng}
              onChange={(e) => setOriginLng(parseFloat(e.target.value) || 0)}
              placeholder="Longitude"
              className={NUMBER_INPUT_CLASS}
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className={LABEL_CLASS}>Grid Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-9 rounded-lg border border-surface-border bg-surface-base cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className={`${INPUT_CLASS} font-mono flex-1`}
            />
          </div>
        </div>

        {/* Naming pattern dropdown */}
        <div>
          <label className={LABEL_CLASS}>Naming Pattern</label>
          <select
            value={namingPattern}
            onChange={(e) => setNamingPattern(e.target.value as typeof namingPattern)}
            className={`${INPUT_CLASS} appearance-none cursor-pointer`}
          >
            <option value="dealer">Dealer Names</option>
            <option value="alpha-numeric">Alpha-Numeric (A1, A2...)</option>
            <option value="numeric">Numeric (1, 2, 3...)</option>
          </select>
        </div>

        {/* Space type dropdown */}
        <div>
          <label className={LABEL_CLASS}>Space Type</label>
          <select
            value={spaceType}
            onChange={(e) => setSpaceType(e.target.value as SpaceType)}
            className={`${INPUT_CLASS} appearance-none cursor-pointer`}
          >
            {SPACE_TYPE_VALUES.map((type) => (
              <option key={type} value={type}>
                {SPACE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Preview text */}
        <div className="rounded-lg bg-surface-overlay border border-surface-border px-3 py-2">
          <p className="text-xs text-text-secondary">
            This will generate{' '}
            <span className="font-mono font-bold text-rally-gold">{totalSpaces}</span>{' '}
            spaces
          </p>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-rally-gold text-black font-bold text-sm hover:brightness-110 transition-all"
        >
          <Grid3X3 className="h-4 w-4" />
          Generate Spaces
        </button>
      </CardContent>
    </Card>
  );
}
