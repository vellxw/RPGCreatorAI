import { ListTodo, Pin } from 'lucide-react';
import { Badge } from '../ui/Badge';

export type AIStudioTaskStatus = 'planned' | 'in-review' | 'accepted' | 'rejected' | 'deferred';

export type AIStudioTaskCardActionKind = 'primary' | 'muted';

export interface AIStudioTaskCardAction {
  id: string;
  label: string;
  kind: AIStudioTaskCardActionKind;
}

export interface AIStudioTaskCardProps {
  taskId: string;
  title: string;
  detail: string;
  status: AIStudioTaskStatus;
  contextLabel?: string;
  contextHref?: string;
  actions: AIStudioTaskCardAction[];
  onAction: (actionId: string, taskId: string) => void;
}

const STATUS_LABEL: Record<AIStudioTaskStatus, string> = {
  planned: 'Planned',
  'in-review': 'In review',
  accepted: 'Accepted',
  rejected: 'Rejected',
  deferred: 'Deferred',
};

const STATUS_VARIANT: Record<AIStudioTaskStatus, 'info' | 'warning' | 'success' | 'error' | 'muted'> = {
  planned: 'info',
  'in-review': 'warning',
  accepted: 'success',
  rejected: 'error',
  deferred: 'muted',
};

function actionClasses(kind: AIStudioTaskCardActionKind): string {
  if (kind === 'primary') {
    return 'rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[12px] text-indigo-700 hover:bg-indigo-100';
  }
  return 'rounded border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-700 hover:border-gray-300';
}

export function AIStudioTaskCard({
  taskId,
  title,
  detail,
  status,
  contextLabel,
  contextHref,
  actions,
  onAction,
}: AIStudioTaskCardProps) {
  return (
    <section
      data-testid="ai-studio-task-card"
      data-task-id={taskId}
      data-status={status}
      className="rounded-md border border-gray-200 bg-white p-3"
    >
      <div className="flex items-start gap-2.5">
        <ListTodo size={16} className="mt-0.5 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold text-gray-800">{title}</p>
            <Badge variant={STATUS_VARIANT[status]} dot>
              {STATUS_LABEL[status]}
            </Badge>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-gray-600">{detail}</p>
          {contextLabel && contextHref && (
            <a
              data-testid="task-context-link"
              href={contextHref}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
            >
              <Pin size={11} />
              {contextLabel}
            </a>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                data-action-id={a.id}
                data-action-kind={a.kind}
                onClick={() => onAction(a.id, taskId)}
                className={actionClasses(a.kind)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
