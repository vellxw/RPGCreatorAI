import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  dirty: boolean;
  errorCount: number;
}

export function SaveIndicator({ dirty, errorCount }: Props) {
  if (errorCount > 0) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-red-600">
        <AlertCircle size={14} />
        <span>{errorCount} validation error{errorCount === 1 ? '' : 's'}</span>
      </div>
    );
  }
  if (dirty) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-amber-600">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span>Unsaved changes</span>
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
