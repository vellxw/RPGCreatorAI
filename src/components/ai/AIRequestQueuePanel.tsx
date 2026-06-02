import { Bot, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import {
  canRetryAiJob,
  selectAiRequestQueueSummary,
  type AiRequestJob,
  type AiRequestQueueState,
} from '../../stores/aiRequestQueueStore';

interface AIRequestQueuePanelProps {
  queue: AiRequestQueueState;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
}

function statusVariant(job: AiRequestJob): 'success' | 'warning' | 'error' | 'info' | 'muted' {
  if (job.state === 'succeeded') return 'success';
  if (job.state === 'failed') return 'error';
  if (job.state === 'cancelled') return 'muted';
  if (job.state === 'running') return 'info';
  return 'warning';
}

function statusLabel(job: AiRequestJob): string {
  return job.state.charAt(0).toUpperCase() + job.state.slice(1);
}

function costLabel(job: AiRequestJob): string | null {
  if (!job.cost) return null;
  if (job.cost.availability === 'free') return 'Cost: free/offline';
  if (job.cost.availability === 'estimated') {
    const estimate = job.cost.estimatedUsd;
    return estimate !== undefined ? `Estimated cost: $${estimate.toFixed(2)}` : 'Estimated cost unavailable';
  }
  return 'Cost: unknown';
}

function rateLimitLabel(job: AiRequestJob): string | null {
  if (!job.rateLimit) return null;
  if (job.rateLimit.status === 'rate-limited') {
    return job.rateLimit.retryAfterSeconds !== undefined
      ? `Rate limited; retry after ${job.rateLimit.retryAfterSeconds}s`
      : 'Rate limited; wait for provider retry guidance';
  }
  if (job.rateLimit.status === 'quota-exceeded') return 'Quota exceeded';
  if (job.rateLimit.status === 'not-applicable') return 'No remote rate limit';
  if (job.rateLimit.status === 'provider-managed') return 'Provider-managed limits';
  return 'Rate limits unknown';
}

export function AIRequestQueuePanel({ queue, onCancel, onRetry }: AIRequestQueuePanelProps) {
  const summary = selectAiRequestQueueSummary(queue);

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-indigo-600" />
            <h3 className="text-[13px] font-semibold text-gray-800">AI Request Queue</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Optional editor work only; normal validation uses mocks and fixtures.
          </p>
        </div>
        <Badge variant={summary.active > 0 ? 'info' : 'muted'} dot>
          {summary.active} active
        </Badge>
      </div>

      {queue.jobs.length === 0 ? (
        <div className="rounded border border-dashed border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-[12px] font-medium text-gray-700">No AI work is running</p>
          <p className="mt-1 text-[11px] leading-4 text-gray-500">
            Queued provider tasks will appear here with progress, cancellation, retry, and failure state.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queue.jobs.map(job => (
            <article key={job.id} className="rounded border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[12px] font-semibold text-gray-800">{job.title}</p>
                    <Badge variant={statusVariant(job)}>{statusLabel(job)}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {job.providerId} · {job.capability} · attempt {job.attempt}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {(job.state === 'queued' || job.state === 'running') && (
                    <button
                      type="button"
                      aria-label={`Cancel ${job.title}`}
                      onClick={() => onCancel(job.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <XCircle size={13} />
                    </button>
                  )}
                  {canRetryAiJob(job) && (
                    <button
                      type="button"
                      aria-label={`Retry ${job.title}`}
                      onClick={() => onRetry(job.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full ${
                      job.state === 'failed'
                        ? 'bg-red-400'
                        : job.state === 'succeeded'
                          ? 'bg-green-500'
                          : 'bg-indigo-500'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <span className="w-9 text-right text-[11px] text-gray-500">{job.progress}%</span>
              </div>

              {(job.message || job.error || job.resultSummary) && (
                <p className={`mt-2 text-[11px] leading-4 ${job.error ? 'text-red-700' : 'text-gray-500'}`}>
                  {job.error ?? job.resultSummary ?? job.message}
                </p>
              )}
              {(costLabel(job) || rateLimitLabel(job) || job.budgetConfirmation?.status === 'required') && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {costLabel(job) && <Badge variant="muted">{costLabel(job)}</Badge>}
                  {rateLimitLabel(job) && <Badge variant={job.rateLimit?.status === 'quota-exceeded' ? 'error' : 'muted'}>{rateLimitLabel(job)}</Badge>}
                  {job.budgetConfirmation?.status === 'required' && (
                    <Badge variant="warning">Budget confirmation required</Badge>
                  )}
                </div>
              )}
              {job.rateLimit?.retryGuidance && (
                <p className="mt-1 text-[10px] leading-4 text-gray-400">{job.rateLimit.retryGuidance}</p>
              )}
              {job.writeIntentId && (
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-400">
                  <ShieldCheck size={11} />
                  Retry keeps the same write intent.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
