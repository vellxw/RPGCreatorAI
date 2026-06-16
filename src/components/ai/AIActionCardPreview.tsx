import { CircleCheck, CircleX, Sparkles, TriangleAlert, View } from 'lucide-react';
import { Badge } from '../ui/Badge';

export type AIActionCardPreviewState = 'pending' | 'valid' | 'invalid' | 'applied' | 'rejected';
export type AIActionCardPreviewKind =
  | 'map-draft'
  | 'event-draft'
  | 'database-draft'
  | 'asset-draft'
  | 'validation-repair';

export interface AIActionCardPreviewValidation {
  errors?: string[];
  warnings?: string[];
}

export interface AIActionCardPreviewProps {
  actionId: string;
  kind: AIActionCardPreviewKind;
  title: string;
  summary: string;
  state: AIActionCardPreviewState;
  validation?: AIActionCardPreviewValidation;
  onAccept: (actionId: string) => void;
  onReject: (actionId: string) => void;
}

const STATE_LABEL: Record<AIActionCardPreviewState, string> = {
  pending: 'Pending review',
  valid: 'Valid preview',
  invalid: 'Invalid preview',
  applied: 'Applied',
  rejected: 'Rejected',
};

const STATE_VARIANT: Record<AIActionCardPreviewState, 'info' | 'warning' | 'success' | 'error' | 'muted'> = {
  pending: 'info',
  valid: 'success',
  invalid: 'error',
  applied: 'success',
  rejected: 'muted',
};

const KIND_LABEL: Record<AIActionCardPreviewKind, string> = {
  'map-draft': 'Map draft',
  'event-draft': 'Event draft',
  'database-draft': 'Database draft',
  'asset-draft': 'Asset draft',
  'validation-repair': 'Validation repair',
};

export function AIActionCardPreview({
  actionId,
  kind,
  title,
  summary,
  state,
  validation,
  onAccept,
  onReject,
}: AIActionCardPreviewProps) {
  const errors = validation?.errors ?? [];
  const warnings = validation?.warnings ?? [];
  const canApply = state === 'pending' || state === 'valid';

  return (
    <section
      data-testid="ai-action-card-preview"
      data-action-id={actionId}
      data-state={state}
      data-kind={kind}
      className="rounded-md border border-gray-200 bg-white p-3"
    >
      <div className="flex items-start gap-2.5">
        <View size={16} className="mt-0.5 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-gray-800">{title}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">
                {KIND_LABEL[kind]}
              </p>
            </div>
            <Badge variant={STATE_VARIANT[state]} dot>
              {STATE_LABEL[state]}
            </Badge>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-gray-600">{summary}</p>

          {errors.length > 0 && (
            <ul
              data-testid="validation-errors"
              className="mt-2 space-y-1 rounded border border-red-100 bg-red-50/60 p-2"
            >
              {errors.map((e) => (
                <li key={e} className="flex items-start gap-1.5 text-[12px] text-red-700">
                  <CircleX size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}

          {warnings.length > 0 && (
            <ul
              data-testid="validation-warnings"
              className="mt-2 space-y-1 rounded border border-amber-100 bg-amber-50/60 p-2"
            >
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-[12px] text-amber-700">
                  <TriangleAlert size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          {canApply && (
            <div className="mt-3 flex items-center gap-1.5">
              <button
                type="button"
                data-action-id="accept"
                data-action-kind="primary"
                onClick={() => onAccept(actionId)}
                className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-[12px] text-indigo-700 hover:bg-indigo-100"
              >
                <CircleCheck size={12} className="mr-1 inline-block" />
                Accept preview
              </button>
              <button
                type="button"
                data-action-id="reject"
                data-action-kind="muted"
                onClick={() => onReject(actionId)}
                className="rounded border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-700 hover:border-gray-300"
              >
                <Sparkles size={12} className="mr-1 inline-block" />
                Reject preview
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
