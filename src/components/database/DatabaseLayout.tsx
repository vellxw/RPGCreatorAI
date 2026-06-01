import type { ReactNode } from 'react';

interface DatabaseLayoutProps {
  title: string;
  sidebar?: ReactNode;
  children: ReactNode;
}

export function DatabaseLayout({ title, sidebar, children }: DatabaseLayoutProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {sidebar}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <h2 className="text-[14px] font-semibold mb-3 text-gray-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}
