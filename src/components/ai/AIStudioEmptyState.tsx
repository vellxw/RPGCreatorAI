import { Bot, FolderOpen, Settings2, Sparkles, TriangleAlert } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

export type AIStudioEmptyStateVariant =
  | 'no-project'
  | 'project-loaded'
  | 'providers-disabled';

export interface StarterTask {
  id: string;
  title: string;
  detail: string;
}

const STARTER_TASKS: StarterTask[] = [
  {
    id: 'actors',
    title: 'Draft a new actor',
    detail: 'Generate a character with name, class, and a starting skill set.',
  },
  {
    id: 'map',
    title: 'Draft a new map outline',
    detail: 'Generate a small map with event anchors and tile roles.',
  },
  {
    id: 'event',
    title: 'Draft event commands',
    detail: 'Generate a small event script that fits the selected event page.',
  },
  {
    id: 'balancing',
    title: 'Balance an existing actor',
    detail: 'Suggest stat and skill adjustments for an existing character.',
  },
];

export interface AIStudioEmptyStateProps {
  variant: AIStudioEmptyStateVariant;
  hasProject: boolean;
  hasAnyConfiguredProvider: boolean;
  onSelectStarterTask: (taskId: string) => void;
}

export function AIStudioEmptyState({
  variant,
  hasProject: _hasProject,
  hasAnyConfiguredProvider: _hasAnyConfiguredProvider,
  onSelectStarterTask,
}: AIStudioEmptyStateProps) {
  if (variant === 'no-project') {
    return (
      <EmptyState
        icon={<FolderOpen size={18} />}
        title="No project open"
        detail="Open or create a project to start using AI Studio. Drafts always preview before they touch your project files."
        align="left"
      />
    );
  }

  if (variant === 'providers-disabled') {
    return (
      <EmptyState
        icon={<Settings2 size={18} />}
        title="AI providers are not configured"
        detail="AI Studio works offline with drafts and previews. To enable live generation, open Settings and connect a provider. Local workflows remain available until you do."
        align="left"
      />
    );
  }

  // variant === 'project-loaded'
  return (
    <div className="space-y-3" data-testid="ai-studio-empty-state-project-loaded">
      <EmptyState
        icon={<Sparkles size={18} />}
        title="Pick a starter task"
        detail="AI Studio can draft new content for your open project. Every draft is a preview until you accept it."
        align="left"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="list" aria-label="Starter tasks">
        {STARTER_TASKS.map((task) => (
          <button
            key={task.id}
            type="button"
            role="listitem"
            data-starter-task={task.id}
            onClick={() => onSelectStarterTask(task.id)}
            className="rounded-md border border-gray-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <div className="flex items-start gap-2">
              <Bot size={14} className="mt-0.5 text-indigo-600" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-800">{task.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-gray-500">{task.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
