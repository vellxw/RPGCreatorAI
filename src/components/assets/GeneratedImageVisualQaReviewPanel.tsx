import { useEffect, useMemo, useState } from 'react';
import type {
  AssetCatalogEntry,
  GeneratedImageVisualQaCheckId,
  GeneratedImageVisualQaCheckResult,
  GeneratedImageVisualQaCheckStatus,
} from '../../types/project';
import {
  buildGeneratedImageVisualQaDraft,
  finalizeGeneratedImageVisualQaReview,
  type GeneratedImageVisualQaCheckOverrides,
  type GeneratedImageVisualQaPreview,
} from '../../providers/generatedImageVisualQa';
import { Input, Select } from '../ui/Input';

export interface GeneratedImageVisualQaReviewValue {
  notes: string;
  tags: string;
  rejectionReason: string;
  checks: GeneratedImageVisualQaCheckOverrides;
}

interface GeneratedImageVisualQaReviewPanelProps {
  asset: AssetCatalogEntry;
  preview: GeneratedImageVisualQaPreview;
  value: GeneratedImageVisualQaReviewValue;
  onChange: (value: GeneratedImageVisualQaReviewValue) => void;
}

const STATUS_OPTIONS = [
  { value: 'pass', label: 'Pass' },
  { value: 'warning', label: 'Warning' },
  { value: 'fail', label: 'Fail' },
];

function parseTags(value: string): string[] {
  return value.split(',').map(tag => tag.trim()).filter(Boolean);
}

function statusTone(status: GeneratedImageVisualQaCheckStatus): string {
  if (status === 'pass') return 'text-emerald-700';
  if (status === 'fail') return 'text-red-700';
  return 'text-amber-700';
}

export function GeneratedImageVisualQaReviewPanel({
  asset,
  preview,
  value,
  onChange,
}: GeneratedImageVisualQaReviewPanelProps) {
  const draft = useMemo(() => buildGeneratedImageVisualQaDraft(asset, preview), [asset, preview]);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const reviewed = finalizeGeneratedImageVisualQaReview(draft, {
    status: 'accepted',
    reviewedAt: new Date(0).toISOString(),
    notes: localValue.notes,
    tags: parseTags(localValue.tags),
    checks: localValue.checks,
  });
  const unresolved = reviewed.unresolvedWarnings.map(id => draft.checks[id].label);

  const update = (next: GeneratedImageVisualQaReviewValue) => {
    setLocalValue(next);
    onChange(next);
  };

  const updateCheck = (
    id: GeneratedImageVisualQaCheckId,
    patch: Partial<Pick<GeneratedImageVisualQaCheckResult, 'status' | 'notes'>>,
  ) => {
    update({
      ...localValue,
      checks: {
        ...localValue.checks,
        [id]: {
          ...(localValue.checks[id] ?? {}),
          ...patch,
        },
      },
    });
  };

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-slate-800">Visual QA checklist</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Score {reviewed.score}/100 before final review.
          </p>
        </div>
        {unresolved.length > 0 && (
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
            Unresolved QA warnings: {unresolved.join(', ')}
          </span>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {(Object.keys(draft.checks) as GeneratedImageVisualQaCheckId[]).map(id => {
          const base = draft.checks[id];
          const current = {
            ...base,
            ...(localValue.checks[id] ?? {}),
          };
          return (
            <div key={id} className="grid grid-cols-[minmax(0,1fr)_120px] gap-2 items-end">
              <div>
                <p className="text-[12px] font-medium text-slate-700">{base.label}</p>
                <p className={`text-[11px] ${statusTone(current.status)}`}>{current.status}</p>
              </div>
              <Select
                ariaLabel={`Visual QA ${base.label} status`}
                value={current.status}
                options={STATUS_OPTIONS}
                onChange={status => updateCheck(id, { status: status as GeneratedImageVisualQaCheckStatus })}
              />
              <div className="col-span-2 flex flex-col gap-1">
                <textarea
                  aria-label={`Visual QA ${base.label} notes`}
                  value={current.notes}
                  onInput={event => updateCheck(id, { notes: event.currentTarget.value })}
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="visual-qa-notes" className="text-[12px] font-medium text-gray-500">
            QA notes
          </label>
          <textarea
            id="visual-qa-notes"
            aria-label="Visual QA notes"
            value={localValue.notes}
            onInput={event => update({ ...localValue, notes: event.currentTarget.value })}
            rows={2}
            className="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
          />
        </div>
        <Input
          label="QA tags"
          aria-label="Visual QA tags"
          value={localValue.tags}
          onInput={event => update({ ...localValue, tags: event.currentTarget.value })}
          placeholder="qa-reviewed, manual-pass"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="visual-qa-rejection-reason" className="text-[12px] font-medium text-gray-500">
            Rejection reason
          </label>
          <textarea
            id="visual-qa-rejection-reason"
            aria-label="Visual QA rejection reason"
            value={localValue.rejectionReason}
            onInput={event => update({ ...localValue, rejectionReason: event.currentTarget.value })}
            rows={2}
            className="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 resize-y"
          />
        </div>
      </div>
    </div>
  );
}
