import { Sparkles, FolderOpen } from 'lucide-react';
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
  { id: 'project', label: 'Project', icon: <FolderOpen size={18} />, screen: 'editor' },
  { id: 'maps', label: 'Maps', icon: <img src={editorAssets.map} alt="" className="w-[18px] h-[18px]" />, screen: 'editor' },
  { id: 'events', label: 'Events', icon: <img src={editorAssets.event} alt="" className="w-[18px] h-[18px]" />, screen: 'events' },
  { id: 'database', label: 'Database', icon: <img src={editorAssets.database} alt="" className="w-[18px] h-[18px]" />, screen: 'database' },
  { id: 'dialogue', label: 'Dialogue', icon: <img src={editorAssets.dialogue} alt="" className="w-[18px] h-[18px]" />, screen: 'editor' },
  { id: 'assets', label: 'Assets', icon: <img src={editorAssets.assets} alt="" className="w-[18px] h-[18px]" />, screen: 'editor' },
  { id: 'ai-tools', label: 'AI Tools', icon: <Sparkles size={18} />, screen: 'ai-tools' },
  { id: 'settings', label: 'Settings', icon: <img src={editorAssets.settings} alt="" className="w-[18px] h-[18px]" />, screen: 'ai-tools' },
];

export function Sidebar() {
  const { state, dispatch } = useEditor();

  const isActive = (item: NavItem) => {
    if (item.screen === state.activeScreen) {
      if (item.id === 'maps' && state.activeScreen === 'editor') return true;
      if (item.id === 'events' && state.activeScreen === 'events') return true;
      if (item.id === 'database' && state.activeScreen === 'database') return true;
      if (item.id === 'ai-tools' && state.activeScreen === 'ai-tools') return true;
    }
    return false;
  };

  return (
    <nav className="w-[88px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-1">
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => item.screen && dispatch({ type: 'SET_SCREEN', screen: item.screen })}
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
