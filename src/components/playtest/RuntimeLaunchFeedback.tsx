import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

export type RuntimeLaunchFeedbackTone = 'info' | 'loading' | 'success' | 'warning' | 'error';

export interface RuntimeLaunchFeedbackState {
  tone: RuntimeLaunchFeedbackTone;
  title: string;
  detail?: string;
  sessionRoot?: string;
  diagnosticsHint?: string;
}

const toneStyles: Record<RuntimeLaunchFeedbackTone, { box: string; icon: string }> = {
  info: {
    box: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: 'text-slate-500',
  },
  loading: {
    box: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    icon: 'text-indigo-600',
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'text-emerald-600',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: 'text-amber-600',
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-800',
    icon: 'text-red-600',
  },
};

function iconFor(tone: RuntimeLaunchFeedbackTone) {
  if (tone === 'loading') return Loader2;
  if (tone === 'success') return CheckCircle2;
  if (tone === 'error') return XCircle;
  if (tone === 'warning') return AlertTriangle;
  return Info;
}

export function RuntimeLaunchFeedback({ feedback }: { feedback: RuntimeLaunchFeedbackState | null }) {
  if (!feedback) return null;

  const styles = toneStyles[feedback.tone];
  const Icon = iconFor(feedback.tone);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${styles.box}`}
    >
      <div className="flex items-start gap-2">
        <Icon
          size={15}
          className={`mt-0.5 shrink-0 ${styles.icon} ${feedback.tone === 'loading' ? 'animate-spin' : ''}`}
        />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{feedback.title}</div>
          {feedback.detail && (
            <div className="mt-0.5 leading-5">{feedback.detail}</div>
          )}
          {feedback.sessionRoot && (
            <div className="mt-1 truncate font-mono text-[11px]" title={feedback.sessionRoot}>
              Session: {feedback.sessionRoot}
            </div>
          )}
          {feedback.diagnosticsHint && (
            <div className="mt-1 text-[11px] leading-5">{feedback.diagnosticsHint}</div>
          )}
        </div>
      </div>
    </div>
  );
}
