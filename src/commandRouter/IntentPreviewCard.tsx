/**
 * Phase 12 M03 — Command Router Intent Preview Card (PX-082, FRA-516).
 *
 * Renders a typed intent (read | preview | mutation) as a presentational
 * card. The host owns the apply / reject callbacks; this component never
 * mutates project data, never calls providers, and never navigates.
 */

import type { ReactNode } from 'react';
import type { CommandRouterIntent } from './intentContract';

export interface IntentPreviewCardProps {
  intent: CommandRouterIntent;
  onAccept?: (intent: CommandRouterIntent) => void;
  onReject?: (intent: CommandRouterIntent) => void;
  'data-testid'?: string;
}

function intentSummary(intent: CommandRouterIntent): string {
  if (intent.capability === 'read') {
    return `Read-only summary for the ${intent.pipeline.replace(/-/g, ' ')} pipeline. Nothing is written.`;
  }
  return intent.preview.summary;
}

function intentTitle(intent: CommandRouterIntent): string {
  if (intent.capability === 'read') {
    return `Summary: ${intent.pipeline.replace(/-/g, ' ')}`;
  }
  return intent.preview.title;
}

export function IntentPreviewCard({
  intent,
  onAccept,
  onReject,
  'data-testid': testId = 'command-router-intent-preview',
}: IntentPreviewCardProps): ReactNode {
  const isMutation = intent.capability === 'mutation';
  const isReadOnly = intent.capability === 'read';
  const targetLabel = describeTarget(intent);

  return (
    <section
      data-testid={testId}
      data-state={intent.capability}
      data-pipeline={intent.pipeline}
      data-intent-id={intent.id}
      aria-label="AI Studio intent preview"
      className="flex flex-col gap-3 rounded-md border border-indigo-200 bg-indigo-50/30 p-3"
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            data-testid={`${testId}-capability-badge`}
            className={
              'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
              (isReadOnly
                ? 'bg-gray-100 text-gray-700'
                : isMutation
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800')
            }
          >
            {isReadOnly ? 'Read only' : isMutation ? 'Draft (preview required)' : 'Preview only'}
          </span>
          <span
            data-testid={`${testId}-confidence`}
            className="text-[11px] text-gray-500"
          >
            Confidence {Math.round(intent.confidence * 100)}%
          </span>
        </div>
        <p className="text-[13px] font-semibold text-gray-800">{intentTitle(intent)}</p>
        <p
          className="text-[12px] leading-5 text-gray-600"
          data-testid={`${testId}-summary`}
        >
          {intentSummary(intent)}
        </p>
      </header>
      <p
        className="text-[11px] leading-5 text-gray-500"
        data-testid={`${testId}-target`}
      >
        Target: {targetLabel}
      </p>
      <p
        className="text-[11px] italic leading-5 text-gray-500"
        data-testid={`${testId}-rationale`}
      >
        {intent.rationale}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {isMutation ? (
          <>
            <button
              type="button"
              data-action="accept"
              data-testid={`${testId}-accept`}
              onClick={() => onAccept?.(intent)}
              className="rounded border border-indigo-300 bg-indigo-600 px-2 py-1 text-[12px] font-medium text-white hover:bg-indigo-700"
            >
              Apply this draft
            </button>
            <button
              type="button"
              data-action="reject"
              data-testid={`${testId}-reject`}
              onClick={() => onReject?.(intent)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-gray-300"
            >
              Discard draft
            </button>
          </>
        ) : (
          <span
            className="text-[11px] text-gray-500"
            data-testid={`${testId}-no-apply`}
          >
            No apply action. Use the read-only summary to inform your next draft.
          </span>
        )}
      </div>
    </section>
  );
}

function describeTarget(intent: CommandRouterIntent): string {
  if (intent.capability === 'read') {
    const t = intent.target;
    if (t.mapId && t.eventId) return `event ${t.eventId} on map ${t.mapId}`;
    if (t.mapId) return `map ${t.mapId}`;
    if (t.databaseTable) {
      return t.recordId
        ? `${t.databaseTable} record ${t.recordId}`
        : `${t.databaseTable} table`;
    }
    return `project ${t.projectId}`;
  }
  const t = intent.target;
  switch (t.kind) {
    case 'event':
      return `event ${t.eventId} on map ${t.mapId}`;
    case 'map':
      return `map ${t.mapId}`;
    case 'database':
      return t.recordId ? `${t.table} record ${t.recordId}` : `${t.table} table`;
    case 'asset':
      return `${t.assetKind} asset${t.assetId ? ` ${t.assetId}` : ''}`;
    case 'project':
      return `project ${t.projectId}`;
    default:
      return 'project';
  }
}
