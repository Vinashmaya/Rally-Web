'use client';

import { useLotConfigStore } from '@rally/services';
import {
  SPACE_TYPE_VALUES,
  SPACE_TYPE_LABELS,
  SPACE_TYPE_COLORS,
  type SpaceType,
} from '@rally/firebase';
import { Trash2, MapPin } from 'lucide-react';
import { Card, CardContent } from '@rally/ui';

const inputClasses =
  'w-full px-3 py-2 rounded-lg bg-surface-base border border-surface-border text-text-primary text-sm focus:border-rally-gold focus:outline-none';

export default function SpaceEditor() {
  const config = useLotConfigStore((s) => s.config);
  const selectedSpaceIds = useLotConfigStore((s) => s.selectedSpaceIds);
  const updateSpace = useLotConfigStore((s) => s.updateSpace);
  const deleteSpaces = useLotConfigStore((s) => s.deleteSpaces);

  // Only render when exactly one space is selected
  if (selectedSpaceIds.size !== 1) return null;

  const selectedId = [...selectedSpaceIds][0]!;
  const space = config?.spaces.find((s) => s.id === selectedId);
  if (!space) return null;

  const displayColor = space.color ?? SPACE_TYPE_COLORS[space.type];

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-rally-gold" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-rally-gold truncate">
            Edit: {space.name}
          </h3>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={space.name}
            onChange={(e) => updateSpace(selectedId, { name: e.target.value })}
            className={inputClasses}
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs text-text-secondary mb-1">Type</label>
          <select
            value={space.type}
            onChange={(e) =>
              updateSpace(selectedId, { type: e.target.value as SpaceType })
            }
            className={inputClasses}
          >
            {SPACE_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {SPACE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-xs text-text-secondary mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={displayColor}
              onChange={(e) =>
                updateSpace(selectedId, { color: e.target.value })
              }
              className="h-9 w-9 rounded border border-surface-border bg-surface-base cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={displayColor}
              onChange={(e) => {
                const hex = e.target.value;
                if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
                  updateSpace(selectedId, { color: hex });
                }
              }}
              placeholder="#000000"
              className={`${inputClasses} font-mono`}
            />
          </div>
        </div>

        {/* Tags */}
        {space.tags && space.tags.length > 0 && (
          <div>
            <label className="block text-xs text-text-secondary mb-1">Tags</label>
            <div className="flex flex-wrap gap-1">
              {space.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-base border border-surface-border text-xs text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Coordinates */}
        <div>
          <label className="block text-xs text-text-secondary mb-1">
            Coordinates ({space.coordinates.length} vertices)
          </label>
          <div className="max-h-32 overflow-y-auto rounded-lg border border-surface-border bg-surface-base">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-secondary border-b border-surface-border">
                  <th className="px-2 py-1 text-left w-8">#</th>
                  <th className="px-2 py-1 text-left">Lng</th>
                  <th className="px-2 py-1 text-left">Lat</th>
                </tr>
              </thead>
              <tbody>
                {space.coordinates.map((coord, i) => (
                  <tr
                    key={i}
                    className="border-b border-surface-border last:border-b-0"
                  >
                    <td className="px-2 py-1 text-text-secondary">{i + 1}</td>
                    <td className="px-2 py-1 font-mono text-text-primary">
                      {coord[0].toFixed(6)}
                    </td>
                    <td className="px-2 py-1 font-mono text-text-primary">
                      {coord[1].toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => deleteSpaces([selectedId])}
          className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg text-sm text-status-error hover:bg-status-error/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Delete Space
        </button>
      </CardContent>
    </Card>
  );
}
