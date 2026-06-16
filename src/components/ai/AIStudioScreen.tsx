import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AIStudioEmptyState } from './AIStudioEmptyState';
import { ChatTranscript } from './ChatTranscript';
import {
  ProviderAvailabilityBanner,
  selectProviderAvailability,
} from './ProviderAvailabilityBanner';
import {
  chatRequestReducer,
  defaultChatRequestState,
  type ChatRequestState,
} from './chatRequest';
import type { ProviderConfig } from '../../types/project';

export interface AIStudioScreenProps {
  providers: readonly ProviderConfig[];
  projectId: string | null;
  onOpenSettings?: () => void;
  onSelectProvider?: (providerId: string) => void;
}

const MOCK_DRAFT_TOKENS = [
  'Here is a draft ',
  'outline for your ',
  'starter task. ',
  'Review, edit, and ',
  'accept to continue.',
];

function nextMockToken(index: number): string | null {
  if (index < 0 || index >= MOCK_DRAFT_TOKENS.length) return null;
  return MOCK_DRAFT_TOKENS[index];
}

export function AIStudioScreen({
  providers,
  projectId,
  onOpenSettings = () => undefined,
  onSelectProvider = () => undefined,
}: AIStudioScreenProps): ReactNode {
  const [lastStarterTask, setLastStarterTask] = useState<string | null>(null);
  const [request, dispatchRequest] = useReducer(chatRequestReducer, defaultChatRequestState);
  const tokenIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const handleSelectStarterTask = (taskId: string) => {
    setLastStarterTask(taskId);
    tokenIndexRef.current = 0;
    dispatchRequest({ type: 'reset' });
    dispatchRequest({ type: 'start' });
  };

  const handleCancel = () => {
    clearTimer();
    dispatchRequest({ type: 'cancel' });
  };

  const handleReset = () => {
    clearTimer();
    dispatchRequest({ type: 'reset' });
    setLastStarterTask(null);
  };

  useEffect(() => {
    if (request.phase !== 'streaming') return undefined;
    timerRef.current = setTimeout(() => {
      const next = nextMockToken(tokenIndexRef.current);
      if (next === null) {
        dispatchRequest({ type: 'complete' });
        clearTimer();
        return;
      }
      dispatchRequest({ type: 'appendToken', token: next });
      tokenIndexRef.current += 1;
    }, 120);
    return () => {
      clearTimer();
    };
  }, [request]);

  const showTranscript = lastStarterTask !== null && request.phase !== 'pending';
  const userMessage = lastStarterTask
    ? `Starter task: ${lastStarterTask}`
    : '';

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
        {showTranscript ? (
          <ChatTranscript
            request={request as ChatRequestState}
            userMessage={userMessage}
            onCancel={handleCancel}
            onReset={handleReset}
            dataRequestId={lastStarterTask ?? 'ai-studio'}
          />
        ) : (
          <AIStudioEmptyState
            variant={variant}
            hasProject={hasProject}
            hasAnyConfiguredProvider={hasAnyConfiguredProvider}
            onSelectStarterTask={handleSelectStarterTask}
          />
        )}
        {!showTranscript && lastStarterTask && (
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
