import { useMemo, useState } from 'react';
import { Tabs } from '../ui/Tabs';
import { CheckCircle2, AlertTriangle, ClipboardList, TerminalSquare, Wrench } from 'lucide-react';
import { useProject, useProjectStore } from '../../stores/projectStore';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { listBrokenReferences, type BrokenReferenceRecord } from '../../validation/referenceIndex';

function brokenReferenceKey(record: BrokenReferenceRecord): string {
  const { reference } = record;
  return `${reference.table}:${reference.parentId ?? ''}:${reference.id}:${reference.source}`;
}

function ValidationContent() {
  const { state: project, dispatch } = useProjectStore();
  const errors = project.errors;
  const warnings = project.warnings;
  const [repairSelections, setRepairSelections] = useState<Record<string, string>>({});
  const projectState = useMemo(() => ({
    project: project.project,
    maps: project.maps,
    items: project.items,
    databases: project.databases,
  }), [project.databases, project.items, project.maps, project.project]);
  const repairableReferences = useMemo(() => {
    const seen = new Set<string>();
    return listBrokenReferences(projectState)
      .filter(record => record.options.length > 0)
      .filter(record => {
        const key = brokenReferenceKey(record);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 4);
  }, [projectState]);

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-gray-800">Project passes validation</p>
          <p className="text-[12px] text-gray-500">Save will still re-check before writing project files.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 ? (
        <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-red-800">Save is blocked</p>
          <p className="text-[12px] text-red-700">Fix the blocking items below, then Save again.</p>
        </div>
      ) : (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-[12px] font-semibold text-amber-800">Save is allowed</p>
          <p className="text-[12px] text-amber-700">Warnings are review items. Save will still validate before writing.</p>
        </div>
      )}
      {repairableReferences.length > 0 && (
        <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2">
          <div className="mb-2 flex items-start gap-2">
            <Wrench size={14} className="mt-0.5 flex-shrink-0 text-indigo-600" />
            <div>
              <p className="text-[12px] font-semibold text-indigo-900">Reference repair</p>
              <p className="text-[12px] text-indigo-700">Replace broken references with an existing record.</p>
            </div>
          </div>
          <div className="space-y-2">
            {repairableReferences.map(record => {
              const key = brokenReferenceKey(record);
              const selectedId = repairSelections[key] ?? record.options[0].replacementId;
              const selectedOption = record.options.find(option => option.replacementId === selectedId) ?? record.options[0];
              const selectId = `repair-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
              return (
                <div key={key} className="grid grid-cols-[1fr_auto] gap-2 rounded border border-indigo-100 bg-white px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-medium text-gray-800" title={record.reason}>
                      {record.reason}
                    </p>
                    <p className="truncate text-[11px] text-gray-500" title={record.reference.source}>
                      {record.reference.source}
                    </p>
                    <label className="sr-only" htmlFor={selectId}>
                      Replacement for missing {record.reference.table} reference {record.reference.id}
                    </label>
                    <select
                      id={selectId}
                      aria-label={`Replacement for missing ${record.reference.table} reference ${record.reference.id}`}
                      className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      value={selectedOption.replacementId}
                      onChange={event => setRepairSelections(prev => ({ ...prev, [key]: event.target.value }))}
                    >
                      {record.options.map(option => (
                        <option key={option.replacementId} value={option.replacementId}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    aria-label={`Apply repair for missing ${record.reference.table} reference ${record.reference.id}`}
                    className="self-end"
                    onClick={() => dispatch({ type: 'REPAIR_REFERENCE', repair: selectedOption.action })}
                  >
                    Apply
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {errors.map((msg, i) => (
        <div key={`e${i}`} className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-gray-800">{msg.message}</p>
            {msg.source && <p className="text-[12px] text-gray-500">{msg.source}</p>}
          </div>
        </div>
      ))}
      {warnings.map((msg, i) => (
        <div key={`w${i}`} className="flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-gray-800">{msg.message}</p>
            {msg.source && <p className="text-[12px] text-gray-500">{msg.source}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiagnosticsContent() {
  const project = useProject();
  const errorCount = project.errors.length;
  const warningCount = project.warnings.length;
  const validationStatus =
    errorCount > 0
      ? `${errorCount} blocking issue${errorCount === 1 ? '' : 's'}`
      : warningCount > 0
        ? `${warningCount} warning${warningCount === 1 ? '' : 's'}`
        : 'No blocking errors';
  return (
    <div className="space-y-3">
      <h4 className="text-[12px] font-semibold text-gray-700">MVP Diagnostics</h4>
      <div className="space-y-2">
        <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100">
          {errorCount > 0 ? (
            <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="text-green-500 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-[12px] font-medium text-gray-800">Validation</p>
            <p className="text-[11px] text-gray-500">{validationStatus}</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <TerminalSquare size={15} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-gray-800">Playtest Logs</p>
            <p className="text-[11px] text-gray-500">Runtime output appears after launching a playtest.</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <ClipboardList size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[12px] font-medium text-gray-800">Runtime Debug Panels</p>
            <p className="text-[11px] text-gray-500">Use Runtime Log, Event Trace, and Runtime State in Playtest.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BottomPanel() {
  const project = useProject();
  const errorCount = project.errors.length;
  const warningCount = project.warnings.length;
  const validationBadge = errorCount > 0 ? errorCount : warningCount;

  return (
    <div className="h-[200px] flex-shrink-0 bg-white border-t border-gray-200 flex">
      <div className="flex-1 border-r border-gray-100">
        <Tabs
          tabs={[
            {
              id: 'output',
              label: 'Output',
              content: (
                <EmptyState
                  compact
                  icon={<ClipboardList size={15} />}
                  title="No editor output yet"
                  detail="Validation, save, and playtest messages appear here after you run an editor command."
                />
              ),
            },
            {
              id: 'validation',
              label: 'Validation',
              badge: validationBadge,
              content: <ValidationContent />,
            },
            {
              id: 'logs',
              label: 'Playtest Logs',
              content: (
                <EmptyState
                  compact
                  icon={<TerminalSquare size={15} />}
                  title="No playtest log selected"
                  detail="Open Playtest and launch the native runtime to create local logs, event traces, and state snapshots."
                />
              ),
            },
          ]}
          defaultTab="validation"
        />
      </div>
      <div className="w-[320px] p-4">
        <DiagnosticsContent />
      </div>
    </div>
  );
}
