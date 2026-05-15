import { TilePalette } from '../components/editor/TilePalette';
import { MapCanvas } from '../components/editor/MapCanvas';
import { Inspector } from '../components/editor/Inspector';
import { BottomPanel } from '../components/editor/BottomPanel';

export function MainEditorScreen() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <TilePalette />
        <MapCanvas />
        <Inspector />
      </div>
      <BottomPanel />
    </div>
  );
}
