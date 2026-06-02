import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  detail: string;
  action?: ReactNode;
  align?: 'left' | 'center';
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  detail,
  action,
  align = 'left',
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-md border border-dashed border-gray-200 bg-gray-50/80 ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      } ${align === 'center' ? 'text-center mx-auto max-w-sm' : ''} ${className}`}
    >
      <div className={`flex gap-2.5 ${align === 'center' ? 'flex-col items-center' : 'items-start'}`}>
        {icon && <div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div>}
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-800">{title}</p>
          <p className="mt-1 text-[12px] leading-5 text-gray-500">{detail}</p>
          {action && <div className="mt-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}
