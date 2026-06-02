import { CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  dirty: boolean;
  errorCount: number;
  warningCount?: number;
  saving?: boolean;
}

export function SaveIndicator({ dirty, errorCount, warningCount = 0, saving = false }: Props) {
  if (saving) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-sky-700" title="Save is writing project data">
        <Loader2 size={14} className="animate-spin" />
        <span>Saving - writing project data</span>
      </div>
    );
  }
  if (errorCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-red-600" title="Save blocked until validation errors are fixed">
        <AlertCircle size={14} />
        <span>{errorCount} validation error{errorCount === 1 ? '' : 's'} - Save blocked</span>
      </div>
    );
  }
  if (warningCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-amber-600" title="Warnings do not block Save">
        <AlertTriangle size={14} />
        <span>{warningCount} warning{warningCount === 1 ? '' : 's'} - Save allowed</span>
      </div>
    );
  }
  if (dirty) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-amber-600" title="Save will validate before writing">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>Unsaved changes - Save will validate first</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-green-600">
      <CheckCircle2 size={14} />
      <span>All changes saved</span>
    </div>
  );
}
