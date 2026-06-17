import { type KeyboardEvent, type ReactNode } from 'react';

export type AIStudioDockPane = 'context' | 'chat' | 'queue' | 'activity';

export interface AIStudioDockLayoutProps {
  activePane: AIStudioDockPane;
  onSelectPane: (pane: AIStudioDockPane) => void;
  contextPane: ReactNode;
  chatPane: ReactNode;
  queuePane: ReactNode;
  activityPane: ReactNode;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  'data-testid'?: string;
}

interface PaneDescriptor {
  id: AIStudioDockPane;
  label: string;
  shortLabel: string;
  description: string;
}

const PANES: PaneDescriptor[] = [
  {
    id: 'context',
    label: 'Project context',
    shortLabel: 'Context',
    description: 'Bounded view of the project, map, event, and database context shared with the AI Studio request.',
  },
  {
    id: 'chat',
    label: 'Conversation',
    shortLabel: 'Chat',
    description: 'Drafts, task cards, and action previews produced by the AI Studio request loop.',
  },
  {
    id: 'queue',
    label: 'Review queue',
    shortLabel: 'Queue',
    description: 'Pending and running AI request jobs with progress, cancel, and rate-limit feedback.',
  },
  {
    id: 'activity',
    label: 'Session activity',
    shortLabel: 'Activity',
    description: 'Recent accept / reject / archive activity for the current AI Studio session.',
  },
];

export function AIStudioDockLayout({
  activePane,
  onSelectPane,
  contextPane,
  chatPane,
  queuePane,
  activityPane,
  onKeyDown,
  'data-testid': testId = 'ai-studio-dock',
}: AIStudioDockLayoutProps): ReactNode {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
  };
  return (
    <div
      data-testid={testId}
      data-active-pane={activePane}
      onKeyDown={handleKeyDown}
      className="flex h-full w-full flex-col gap-3 outline-none"
      role="presentation"
    >
      <div
        role="tablist"
        aria-label="AI Studio dock sections"
        className="flex flex-wrap items-center gap-1 border-b border-gray-200 pb-2"
      >
        {PANES.map((pane) => {
          const selected = pane.id === activePane;
          return (
            <button
              key={pane.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`ai-studio-pane-${pane.id}`}
              data-pane={pane.id}
              data-active={selected ? 'true' : 'false'}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelectPane(pane.id)}
              className={
                'rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ' +
                (selected
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800')
              }
            >
              <span className="hidden sm:inline">{pane.label}</span>
              <span className="sm:hidden">{pane.shortLabel}</span>
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        <PanePanel id="context" active={activePane === 'context'} description={paneDescription('context')}>
          {contextPane}
        </PanePanel>
        <PanePanel id="chat" active={activePane === 'chat'} description={paneDescription('chat')}>
          {chatPane}
        </PanePanel>
        <PanePanel id="queue" active={activePane === 'queue'} description={paneDescription('queue')}>
          {queuePane}
        </PanePanel>
        <PanePanel
          id="activity"
          active={activePane === 'activity'}
          description={paneDescription('activity')}
        >
          {activityPane}
        </PanePanel>
      </div>
    </div>
  );
}

interface PanePanelProps {
  id: AIStudioDockPane;
  active: boolean;
  description: string;
  children: ReactNode;
}

function PanePanel({ id, active, description, children }: PanePanelProps): ReactNode {
  if (!active) return null;
  return (
    <section
      role="tabpanel"
      id={`ai-studio-pane-${id}`}
      aria-label={description}
      data-pane-panel={id}
      className="flex h-full w-full flex-col gap-3 overflow-auto"
    >
      {children}
    </section>
  );
}

function paneDescription(id: AIStudioDockPane): string {
  return PANES.find((pane) => pane.id === id)?.description ?? '';
}
