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
import {
  AIStudioDockLayout,
  type AIStudioDockPane,
} from './AIStudioDockLayout';
import {
  AIStudioContextPanel,
} from './AIStudioContextPanel';
import {
  AIStudioSessionActivity,
  type AIStudioActivityEntry,
} from './AIStudioSessionActivity';
import { AIRequestQueuePanel } from './AIRequestQueuePanel';
import {
  useAiRequestQueue,
  type AiRequestQueueState,
} from '../../stores/aiRequestQueueStore';
import { buildProjectContext, type ProjectContext } from './projectContext';

export interface AIStudioScreenProps {
  providers: readonly ProviderConfig[];
  projectId: string | null;
  projectTitle?: string;
  mapCount?: number;
  eventCount?: number;
  validationStatus?: ProjectContext['validationStatus'];
  selectedMap?: ProjectContext['selectedMap'];
  selectedEvent?: ProjectContext['selectedEvent'];
  database?: ProjectContext['database'];
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
  projectTitle,
  mapCount,
  eventCount,
  validationStatus,
  selectedMap,
  selectedEvent,
  database,
  onOpenSettings = () => undefined,
  onSelectProvider = () => undefined,
}: AIStudioScreenProps): ReactNode {
  const [activePane, setActivePane] = useState<AIStudioDockPane>('chat');
  const [lastStarterTask, setLastStarterTask] = useState<string | null>(null);
  const [request, dispatchRequest] = useReducer(chatRequestReducer, defaultChatRequestState);
  const [activity, setActivity] = useState<AIStudioActivityEntry[]>([]);
  const tokenIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const view = useMemo(() => selectProviderAvailability([...providers]), [providers]);
  const hasProject = projectId !== null;
  const hasAnyConfiguredProvider = view.readyProviderIds.length > 0;

  const projectContext = useMemo(
    () =>
      buildProjectContext({
        projectId,
        projectTitle,
        mapCount,
        eventCount,
        validationStatus,
        selectedMap,
        selectedEvent,
        database,
      }),
    [
      projectId,
      projectTitle,
      mapCount,
      eventCount,
      validationStatus,
      selectedMap,
      selectedEvent,
      database,
    ],
  );

  const queueStore = useAiRequestQueue();
  const queueSnapshot: AiRequestQueueState = queueStore.queue;

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
    setActivePane('chat');
  };

  const handleDockKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const panes: AIStudioDockPane[] = ['context', 'chat', 'queue', 'activity'];
    const currentIndex = panes.indexOf(activePane);
    if (currentIndex === -1) return;
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + panes.length) % panes.length;
    event.preventDefault();
    setActivePane(panes[nextIndex]);
  };

  const handleCancel = () => {
    clearTimer();
    dispatchRequest({ type: 'cancel' });
    recordActivity('cancel', `Canceled draft for ${lastStarterTask ?? 'starter task'}.`);
  };

  const handleReset = () => {
    clearTimer();
    dispatchRequest({ type: 'reset' });
    setLastStarterTask(null);
    recordActivity('reset', 'Cleared the current draft.');
  };

  const recordActivity = (kind: AIStudioActivityEntry['kind'], message: string) => {
    setActivity((current) => [
      {
        id: `${kind}-${Date.now()}-${current.length}`,
        kind,
        message,
        at: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 25));
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

  const contextPane = (
    <AIStudioContextPanel projectId={projectId} context={projectContext} />
  );

  const chatPane = (
    <>
      <ProviderAvailabilityBanner
        view={view}
        onOpenSettings={onOpenSettings}
        onSelectProvider={onSelectProvider}
      />
      <div className="flex-1 overflow-auto" data-testid="ai-studio-chat-pane">
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
    </>
  );

  const queuePane = (
    <div data-testid="ai-studio-queue-pane" className="flex h-full w-full flex-col gap-2">
      <p className="text-[12px] text-gray-600">
        Pending, running, and recent AI Studio requests for this project. Rejected and failed
        requests stay here until you dismiss them.
      </p>
      <div className="flex-1 overflow-auto">
        <AIRequestQueuePanel
          queue={queueSnapshot}
          onCancel={queueStore.cancel}
          onRetry={queueStore.retry}
        />
      </div>
    </div>
  );

  const activityPane = (
    <div data-testid="ai-studio-activity-pane" className="flex h-full w-full flex-col gap-2">
      <p className="text-[12px] text-gray-600">
        Recent accept, reject, archive, cancel, and reset events for the current AI Studio
        session. Activity resets when you switch projects.
      </p>
      <div className="flex-1 overflow-auto">
        <AIStudioSessionActivity entries={activity} />
      </div>
    </div>
  );

  return (
    <div
      className="flex h-full w-full flex-col gap-3 p-4"
      data-testid="ai-studio-screen"
      data-active-pane={activePane}
      role="region"
      aria-label="AI Studio"
    >
      <header className="flex items-center gap-2">
        <h1 className="text-[15px] font-semibold text-gray-800">AI Studio</h1>
        <span className="text-[11px] text-gray-500">Drafts only. Nothing is written to your project until you accept.</span>
      </header>
      <AIStudioDockLayout
        activePane={activePane}
        onSelectPane={setActivePane}
        contextPane={contextPane}
        chatPane={chatPane}
        queuePane={queuePane}
        activityPane={activityPane}
        onKeyDown={handleDockKeyDown}
      />
    </div>
  );
}
