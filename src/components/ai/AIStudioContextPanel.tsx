import { type ReactNode } from 'react';
import type { ProjectContext } from './projectContext';

export interface AIStudioContextPanelProps {
  projectId: string | null;
  context: ProjectContext | null;
  'data-testid'?: string;
}

export function AIStudioContextPanel({
  projectId,
  context,
  'data-testid': testId = 'ai-studio-context-panel',
}: AIStudioContextPanelProps): ReactNode {
  if (!projectId) {
    return (
      <div
        data-testid={testId}
        data-state="no-project"
        className="rounded-md border border-gray-200 bg-white p-3 text-[12px] text-gray-600"
      >
        <p className="font-medium text-gray-700">No project open</p>
        <p className="mt-1 leading-5">
          Open a project to share a bounded view of its maps, events, and databases with the AI Studio.
        </p>
      </div>
    );
  }

  if (!context) {
    return (
      <div
        data-testid={testId}
        data-state="loading"
        className="rounded-md border border-gray-200 bg-white p-3 text-[12px] text-gray-600"
      >
        <p className="font-medium text-gray-700">Loading project context…</p>
        <p className="mt-1 leading-5">
          Waiting for the first bounded project summary before any request can leave the editor.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      data-state="ready"
      className="flex flex-col gap-3"
    >
      <ContextSection title="Project" rows={[
        { label: 'Title', value: context.projectTitle || '(untitled project)' },
        { label: 'Maps', value: String(context.mapCount) },
        { label: 'Events', value: String(context.eventCount) },
        { label: 'Validation', value: context.validationStatus },
      ]} />
      <ContextSection
        title="Selected map"
        rows={
          context.selectedMap
            ? [
                { label: 'Name', value: context.selectedMap.name || context.selectedMap.id },
                { label: 'Size', value: `${context.selectedMap.width} × ${context.selectedMap.height}` },
                { label: 'Tileset', value: context.selectedMap.tilesetId ?? '(unset)' },
              ]
            : [{ label: 'Status', value: 'No map selected' }]
        }
      />
      <ContextSection
        title="Selected event"
        rows={
          context.selectedEvent
            ? [
                { label: 'Id', value: context.selectedEvent.id },
                { label: 'Page', value: String(context.selectedEvent.pageIndex ?? 0) },
                { label: 'Trigger', value: context.selectedEvent.trigger ?? 'action' },
              ]
            : [{ label: 'Status', value: 'No event selected' }]
        }
      />
      <ContextSection
        title="Database"
        rows={[
          { label: 'Selected tables', value: context.database.selectedTables.length === 0 ? '(none)' : context.database.selectedTables.join(', ') },
          { label: 'Selected records', value: String(context.database.selectedRecordCount) },
          { label: 'Truncated', value: context.database.truncated ? 'yes' : 'no' },
        ]}
      />
      <p className="text-[11px] text-gray-500" data-testid={`${testId}-redaction-note`}>
        Paths, credentials, and provider secrets are redacted before any AI request is sent.
      </p>
    </div>
  );
}

interface ContextSectionProps {
  title: string;
  rows: ReadonlyArray<{ label: string; value: string }>;
}

function ContextSection({ title, rows }: ContextSectionProps): ReactNode {
  return (
    <section
      className="rounded-md border border-gray-200 bg-white p-3"
      data-context-section={title.toLowerCase().replace(/\s+/g, '-')}
    >
      <h2 className="text-[12px] font-semibold text-gray-700">{title}</h2>
      <dl className="mt-2 grid grid-cols-1 gap-1.5">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 text-[12px]"
          >
            <dt className="text-gray-500">{row.label}</dt>
            <dd className="truncate text-right font-medium text-gray-800" title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
