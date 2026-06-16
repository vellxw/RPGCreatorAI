import { useMemo, useState, type ReactNode } from 'react';
import { AIStudioEmptyState } from './AIStudioEmptyState';
import {
  ProviderAvailabilityBanner,
  selectProviderAvailability,
} from './ProviderAvailabilityBanner';
import type { ProviderConfig } from '../../types/project';

export interface AIStudioScreenProps {
  providers: readonly ProviderConfig[];
  projectId: string | null;
  onOpenSettings?: () => void;
  onSelectProvider?: (providerId: string) => void;
}

export function AIStudioScreen({
  providers,
  projectId,
  onOpenSettings = () => undefined,
  onSelectProvider = () => undefined,
}: AIStudioScreenProps): ReactNode {
  const [lastStarterTask, setLastStarterTask] = useState<string | null>(null);

  const view = useMemo(() => selectProviderAvailability([...providers]), [providers]);
  const hasProject = projectId !== null;
  const hasAnyConfiguredProvider = view.readyProviderIds.length > 0;

  let variant: 'no-project' | 'project-loaded' | 'providers-disabled';
  if (!hasProject) {
    variant = 'no-project';
  } else if (!hasAnyConfiguredProvider) {
    variant = 'providers-disabled';
  } else {
    variant = 'project-loaded';
  }

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4" data-testid="ai-studio-screen">
      <header className="flex items-center gap-2">
        <h1 className="text-[15px] font-semibold text-gray-800">AI Studio</h1>
        <span className="text-[11px] text-gray-500">Drafts only. Nothing is written to your project until you accept.</span>
      </header>
      <ProviderAvailabilityBanner
        view={view}
        onOpenSettings={onOpenSettings}
        onSelectProvider={onSelectProvider}
      />
      <div className="flex-1 overflow-auto">
        <AIStudioEmptyState
          variant={variant}
          hasProject={hasProject}
          hasAnyConfiguredProvider={hasAnyConfiguredProvider}
          onSelectStarterTask={(taskId) => setLastStarterTask(taskId)}
        />
        {lastStarterTask && (
          <p
            data-testid="ai-studio-last-starter"
            className="mt-3 text-[12px] text-gray-500"
          >
            Last starter: {lastStarterTask}
          </p>
        )}
      </div>
    </div>
  );
}
