import { Play, Settings2 } from 'lucide-react';
import { useEditor } from '../../stores/editorStore';
import type { Screen } from '../../types/project';
import { editorAssets } from '../../assets/generated/assetCatalog';

interface NavItem {
  id: Screen | string;
  label: string;
  icon: React.ReactNode;
  screen?: Screen;
}

const navItems: NavItem[] = [
  { id: 'maps', label: 'Maps', icon: <img src={editorAssets.map} alt="" className="w-[18px] h-[18px]" />, screen: 'editor' },
  { id: 'events', label: 'Events', icon: <img src={editorAssets.event} alt="" className="w-[18px] h-[18px]" />, screen: 'events' },
  { id: 'database', label: 'Database', icon: <img src={editorAssets.database} alt="" className="w-[18px] h-[18px]" />, screen: 'database' },
  { id: 'assets', label: 'Assets', icon: <img src={editorAssets.assets} alt="" className="w-[18px] h-[18px]" />, screen: 'assets' },
  { id: 'playtest', label: 'Playtest', icon: <Play size={18} />, screen: 'playtest' },
  { id: 'settings', label: 'Settings', icon: <Settings2 size={18} />, screen: 'settings' },
];

export function Sidebar() {
  const { state, dispatch } = useEditor();

  const isActive = (item: NavItem) => {
    return item.screen === state.activeScreen;
  };

  return (
    <nav className="w-[88px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => item.screen && dispatch({ type: 'SET_SCREEN', screen: item.screen })}
          aria-current={isActive(item) ? 'page' : undefined}
          className={`w-[72px] flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg transition-colors cursor-pointer ${
            isActive(item)
              ? 'bg-indigo-50 text-indigo-600'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          }`}
        >
          {item.icon}
          <span className="text-[11px] font-medium">{item.label}</span>
        </button>
      ))}
      {/* Bottom section */}
      <div className="mt-auto flex flex-col items-center gap-2 pt-4 border-t border-gray-100 w-full px-3">
        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-[11px] font-bold text-indigo-600">GD</span>
        </div>
        <span className="text-[10px] text-gray-400">Creator</span>
      </div>
    </nav>
  );
}
