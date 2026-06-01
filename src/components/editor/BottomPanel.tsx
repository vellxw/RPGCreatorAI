import { Tabs } from '../ui/Tabs';
import { CheckCircle2, AlertTriangle, ClipboardList, TerminalSquare } from 'lucide-react';
import { useProject } from '../../stores/projectStore';

function ValidationContent() {
  const project = useProject();
  const errors = project.errors;
  const warnings = project.warnings;

  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-[13px] font-medium text-gray-800">Map has no blocking errors</p>
          <p className="text-[12px] text-gray-500">Great job! Your project is valid and ready for playtesting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

  return (
    <div className="h-[200px] flex-shrink-0 bg-white border-t border-gray-200 flex">
      <div className="flex-1 border-r border-gray-100">
        <Tabs
          tabs={[
            {
              id: 'output',
              label: 'Output',
              content: <p className="text-[13px] text-gray-500">No output messages</p>,
            },
            {
              id: 'validation',
              label: 'Validation',
              badge: errorCount,
              content: <ValidationContent />,
            },
            {
              id: 'logs',
              label: 'Playtest Logs',
              content: <p className="text-[13px] text-gray-500">Start a playtest to see logs</p>,
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
