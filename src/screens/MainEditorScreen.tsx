import { TilePalette } from '../components/editor/TilePalette';
import { MapCanvas } from '../components/editor/MapCanvas';
import { Inspector } from '../components/editor/Inspector';
import { BottomPanel } from '../components/editor/BottomPanel';
import { MapTreePanel } from '../components/editor/MapTreePanel';

export function MainEditorScreen() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[260px] flex-shrink-0 border-r border-gray-200 flex flex-col min-h-0">
          <MapTreePanel />
          <div className="flex-1 min-h-0">
            <TilePalette embedded />
          </div>
        </div>
        <MapCanvas />
        <Inspector />
      </div>
      <BottomPanel />
    </div>
  );
}
