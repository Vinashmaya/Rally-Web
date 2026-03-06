'use client';

import {
  Layers,
  Grid3X3,
  Image as ImageIcon,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useLotConfigStore } from '@rally/services';
import type { SidebarPanel } from '@rally/services';
import SpacesPanel from './SpacesPanel';
import SpaceEditor from './SpaceEditor';
import GridGeneratorPanel from './GridGeneratorPanel';
import OverlayPanel from './OverlayPanel';
import ImportExportPanel from './ImportExportPanel';

const PANEL_TABS: { id: SidebarPanel; label: string; icon: typeof Layers }[] = [
  { id: 'spaces', label: 'Spaces', icon: Layers },
  { id: 'grids', label: 'Grid Gen', icon: Grid3X3 },
  { id: 'overlays', label: 'Overlays', icon: ImageIcon },
  { id: 'import-export', label: 'I/O', icon: FileDown },
] as const;

export default function EditorSidebar() {
  const activePanel = useLotConfigStore((s) => s.activeSidebarPanel);
  const setActivePanel = useLotConfigStore((s) => s.setActiveSidebarPanel);
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-2 bg-surface-overlay border border-surface-border rounded-lg w-10">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md text-text-secondary hover:text-rally-gold transition-colors"
          title="Expand sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {PANEL_TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActivePanel(id);
              setCollapsed(false);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              activePanel === id
                ? 'text-rally-gold bg-rally-gold/10'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
            title={PANEL_TABS.find((t) => t.id === id)?.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-[340px] min-w-[300px] bg-surface-overlay border border-surface-border rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center bg-surface-base border-b border-surface-border">
        {PANEL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-medium transition-colors border-b-2 ${
              activePanel === id
                ? 'border-rally-gold text-rally-gold bg-rally-gold/5'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
        <button
          onClick={() => setCollapsed(true)}
          className="px-2 py-2 text-text-tertiary hover:text-text-secondary transition-colors"
          title="Collapse sidebar"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activePanel === 'spaces' && (
          <>
            <SpacesPanel />
            <SpaceEditor />
          </>
        )}
        {activePanel === 'grids' && <GridGeneratorPanel />}
        {activePanel === 'overlays' && <OverlayPanel />}
        {activePanel === 'import-export' && <ImportExportPanel />}
      </div>
    </div>
  );
}
