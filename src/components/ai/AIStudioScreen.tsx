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
import { RouterResultCard } from '../../commandRouter/RouterResultCard';
import { useRouteCreatorRequest } from '../../commandRouter/useRouteCreatorRequest';
import type { CommandRouterInput } from '../../commandRouter/router';
import type { CommandRouterIntent } from '../../commandRouter/intentContract';

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
  const [draftMessage, setDraftMessage] = useState('');
  const router = useRouteCreatorRequest();
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

  const buildRouterInput = (message: string): CommandRouterInput => {
    const input: CommandRouterInput = {
      message,
      projectId: projectId,
    };
    if (projectContext?.selectedMap) {
      input.selectedMapId = projectContext.selectedMap.id;
      if (projectContext.selectedEvent) {
        input.selectedEventId = projectContext.selectedEvent.id;
      }
    }
    if (projectContext?.database?.selectedTables[0]) {
      input.selectedDatabaseTable = projectContext.database.selectedTables[0];
    }
    return input;
  };

  const handleSubmitMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draftMessage.trim();
    if (trimmed.length === 0) return;
    const result = router.route(buildRouterInput(trimmed));
    if (result.kind === 'clarification') {
      recordActivity('clarify', `Asked for clarification on: "${trimmed}".`);
    } else {
      recordActivity(
        'route',
        `Routed "${trimmed}" to ${result.intent.pipeline} (${result.intent.capability}).`,
      );
    }
    setDraftMessage('');
  };

  const handleSelectClarification = (optionId: string, pipeline: string) => {
    const last = router.state.lastInput;
    if (!last) return;
    const result = router.route({
      ...last,
      message: `Apply the ${pipeline} workflow (${optionId}).`,
    });
    if (result.kind === 'intent') {
      recordActivity(
        'clarify-pick',
        `Picked ${optionId}; routed to ${result.intent.pipeline} (${result.intent.capability}).`,
      );
    } else {
      recordActivity('clarify-pick', `Picked ${optionId}; still needs clarification.`);
    }
  };

  const handleAcceptIntent = (intent: CommandRouterIntent) => {
    recordActivity(
      'apply',
      `Recorded acceptance for ${intent.pipeline} (${intent.id}); the host is responsible for any apply step.`,
    );
    router.clear();
  };

  const handleRejectIntent = (intent: CommandRouterIntent) => {
    recordActivity('reject', `Discarded draft for ${intent.pipeline} (${intent.id}).`);
    router.clear();
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
        {router.state.result ? (
          <div className="mt-3" data-testid="ai-studio-router-result">
            <RouterResultCard
              result={router.state.result}
              onSelectClarification={handleSelectClarification}
              onAcceptIntent={handleAcceptIntent}
              onRejectIntent={handleRejectIntent}
            />
          </div>
        ) : null}
      </div>
      <form
        data-testid="ai-studio-router-form"
        onSubmit={handleSubmitMessage}
        className="flex items-end gap-2 rounded-md border border-gray-200 bg-white p-2"
      >
        <label className="flex-1">
          <span className="sr-only">Describe what you want to draft</span>
          <textarea
            data-testid="ai-studio-router-input"
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder={
              hasProject
                ? 'Describe what you want to draft. The router will route it to the right pipeline or ask for clarification.'
                : 'Open a project to start routing creator messages through the AI Studio router.'
            }
            rows={2}
            disabled={!hasProject}
            className="block w-full resize-none rounded border border-gray-200 p-2 text-[12px] text-gray-800 focus:border-indigo-300 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          data-testid="ai-studio-router-submit"
          data-action="submit"
          disabled={!hasProject || draftMessage.trim().length === 0}
          className="rounded border border-indigo-300 bg-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
        >
          Route request
        </button>
      </form>
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
