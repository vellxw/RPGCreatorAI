import { useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  rightContent?: ReactNode;
}

export function Tabs({ tabs, defaultTab, rightContent }: TabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || '');
  const activeTab = tabs.find(t => t.id === active);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-gray-200 px-4 gap-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
              active === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        {rightContent && <div className="ml-auto">{rightContent}</div>}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {activeTab?.content}
      </div>
    </div>
  );
}
