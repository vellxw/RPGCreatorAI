import { useMemo, useState, useCallback } from 'react';
import { Tabs } from '../ui/Tabs';
import { CheckCircle2, AlertTriangle, ClipboardList, TerminalSquare, Wrench, Sparkles, X } from 'lucide-react';
import { useProject, useProjectStore } from '../../stores/projectStore';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { listBrokenReferences, type BrokenReferenceRecord } from '../../validation/referenceIndex';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  generateValidationRepairCandidate,
  validateRepairCandidate,
  approveRepairCandidate,
  type ValidationRepairCandidate,
  type RepairSuggestion,
} from '../../providers/validationRepairWorkflow';

function brokenReferenceKey(record: BrokenReferenceRecord): string {
  const { reference } = record;
  return `${reference.table}:${reference.parentId ?? ''}:${reference.id}:${reference.source}`;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-600',
};

const ACTION_LABELS: Record<string, string> = {
  manual: 'Manual Fix',
  'reference-repair': 'Reference Repair',
  'data-fix': 'Data Fix',
};

function RepairAssistantModal({
  errors,
  warnings,
  onClose,
}: {
  errors: Array<{ level: string; message: string; source?: string }>;
  warnings: Array<{ level: string; message: string; source?: string }>;
  onClose: () => void;
}) {
  const [candidate, setCandidate] = useState<ValidationRepairCandidate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setAcknowledged(false);
    try {
      const adapter = createMockProviderAdapter();
      const result = await generateValidationRepairCandidate(
        adapter,
        errors.map(e => ({ level: e.level as 'error' | 'warning', message: e.message, source: e.source })),
        warnings.map(w => ({ level: w.level as 'error' | 'warning', message: w.message, source: w.source })),
        { requestId: `repair-${Date.now()}`, createdAt: new Date().toISOString() }
      );
      const validationErrors = validateRepairCandidate(result);
      if (validationErrors.length > 0) {
        setError(`Validation failed: ${validationErrors.join(', ')}`);
        return;
      }
      setCandidate(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate repair suggestions');
    } finally {
      setGenerating(false);
    }
  }, [errors, warnings]);

  const handleAcknowledge = useCallback(() => {
    if (!candidate) return;
    try {
      const approved = approveRepairCandidate(candidate, { reviewedAt: new Date().toISOString() });
      setCandidate(approved);
      setAcknowledged(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve suggestions');
    }
  }, [candidate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-[560px] max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-500" />
            <h3 className="text-[14px] font-semibold text-gray-800">AI Repair Assistant</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI Repair Assistant"
            className="p-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2">
            <p className="text-[12px] text-indigo-800">
              <strong>{errors.length}</strong> error{errors.length === 1 ? '' : 's'} and{' '}
              <strong>{warnings.length}</strong> warning{warnings.length === 1 ? '' : 's'} detected.
              Generate AI-assisted repair suggestions below.
            </p>
            <p className="text-[11px] text-indigo-600 mt-1">
              Suggestions are guidance only; no automatic project changes are made.
            </p>
          </div>

          {!candidate && !generating && (
            <Button
              size="sm"
              variant="default"
              icon={<Sparkles size={12} />}
              aria-label="Generate AI repair suggestions"
              onClick={handleGenerate}
              disabled={generating}
            >
              Generate Suggestions
            </Button>
          )}

          {generating && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500">
              <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              Analyzing validation issues...
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          {candidate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-gray-700">{candidate.summary}</p>
                {candidate.reviewState === 'approved' && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                    Acknowledged
                  </span>
                )}
              </div>

              {candidate.suggestions.map((suggestion: RepairSuggestion, i: number) => (
                <div key={i} className="rounded border border-gray-200 bg-gray-50 px-3 py-2 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={13}
                      className={
                        suggestion.errorMessage.includes('error') || suggestion.confidence === 'high'
                          ? 'text-red-500 mt-0.5 flex-shrink-0'
                          : 'text-amber-500 mt-0.5 flex-shrink-0'
                      }
                    />
                    <p className="text-[12px] font-medium text-gray-800 flex-1">{suggestion.errorMessage}</p>
                  </div>
                  <p className="text-[12px] text-gray-600 ml-5">{suggestion.suggestion}</p>
                  <div className="flex items-center gap-2 ml-5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_COLORS[suggestion.confidence]}`}>
                      {suggestion.confidence} confidence
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      {ACTION_LABELS[suggestion.actionType] ?? suggestion.actionType}
                    </span>
                  </div>
                  {suggestion.details && (
                    <p className="text-[11px] text-gray-500 ml-5 italic">{suggestion.details}</p>
                  )}
                </div>
              ))}

              {candidate.suggestions.length === 0 && (
                <p className="text-[12px] text-gray-500">No specific repair suggestions generated.</p>
              )}

              <div className="text-[11px] text-gray-400 font-mono">
                Provider: {candidate.provenance.providerId}/{candidate.provenance.modelId} /
                Format: {candidate.provenance.responseFormat}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center">
          {candidate && !acknowledged ? (
            <Button
              size="sm"
              variant="default"
              aria-label="Acknowledge AI repair suggestions"
              onClick={handleAcknowledge}
            >
              Acknowledge Suggestions
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ValidationContent() {
  const { state: project, dispatch } = useProjectStore();
  const errors = project.errors;
  const warnings = project.warnings;
  const [repairSelections, setRepairSelections] = useState<Record<string, string>>({});
  const [showRepairModal, setShowRepairModal] = useState(false);
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
        <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-red-800">Save is blocked</p>
            <p className="text-[12px] text-red-700">Fix the blocking items below, then Save again.</p>
          </div>
          <button
            aria-label="AI Repair Assistant"
            title="AI Repair Assistant"
            className="p-1.5 rounded hover:bg-red-100 cursor-pointer flex-shrink-0"
            onClick={() => setShowRepairModal(true)}
          >
            <Sparkles size={14} className="text-indigo-500" />
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-amber-800">Save is allowed</p>
            <p className="text-[12px] text-amber-700">Warnings are review items. Save will still validate before writing.</p>
          </div>
          <button
            aria-label="AI Repair Assistant"
            title="AI Repair Assistant"
            className="p-1.5 rounded hover:bg-amber-100 cursor-pointer flex-shrink-0"
            onClick={() => setShowRepairModal(true)}
          >
            <Sparkles size={14} className="text-indigo-500" />
          </button>
        </div>
      )}
      {showRepairModal && (
        <RepairAssistantModal
          errors={errors}
          warnings={warnings}
          onClose={() => setShowRepairModal(false)}
        />
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
