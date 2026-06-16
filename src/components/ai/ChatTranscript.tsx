import type { ReactNode } from 'react';
import type { ChatRequestState } from './chatRequest';

export interface ChatTranscriptProps {
  request: ChatRequestState;
  userMessage: string;
  onCancel: () => void;
  onReset: () => void;
  dataRequestId: string;
}

interface StatusCopy {
  ariaLive: 'polite' | 'assertive';
  badge: string;
  message: string;
}

function statusCopy(state: ChatRequestState): StatusCopy {
  switch (state.phase) {
    case 'pending':
      return {
        ariaLive: 'polite',
        badge: 'Queued',
        message: 'Preparing your draft…',
      };
    case 'streaming':
      return {
        ariaLive: 'polite',
        badge: 'Drafting',
        message: 'Drafting your outline. You can stop it any time.',
      };
    case 'completed':
      return {
        ariaLive: 'polite',
        badge: 'Done',
        message: 'Your draft is ready below.',
      };
    case 'canceled':
      return {
        ariaLive: 'polite',
        badge: 'Canceled',
        message: 'You canceled this draft. Nothing was written to your project.',
      };
    case 'failed':
      return {
        ariaLive: 'assertive',
        badge: 'Couldn’t finish',
        message:
          state.errorMessage ??
          "We couldn't reach the provider. Try again in a moment.",
      };
    default:
      return { ariaLive: 'polite', badge: 'Idle', message: '' };
  }
}

export function ChatTranscript({
  request,
  userMessage,
  onCancel,
  onReset,
  dataRequestId,
}: ChatTranscriptProps): ReactNode {
  const copy = statusCopy(request);
  const canCancel = request.phase === 'pending' || request.phase === 'streaming';
  const showReset = request.phase === 'canceled' || request.phase === 'failed';
  const partialText = request.tokens.join('');

  return (
    <section
      data-testid="chat-transcript"
      data-state={request.phase}
      data-request-id={dataRequestId}
      className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700"
        >
          {copy.badge}
        </span>
        <p
          role="status"
          aria-live={copy.ariaLive}
          className="text-[12px] text-gray-600"
        >
          {copy.message}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <article
          aria-label="Your message"
          className="rounded-md bg-gray-50 px-3 py-2 text-[12px] leading-5 text-gray-700"
        >
          {userMessage}
        </article>
        <article
          aria-label="Assistant draft"
          className="rounded-md border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[12px] leading-5 text-gray-800"
        >
          {request.phase === 'completed'
            ? (request.finalText ?? '')
            : request.phase === 'streaming' || request.phase === 'pending'
              ? partialText || '…'
              : request.phase === 'failed'
                ? request.errorMessage ?? ''
                : request.phase === 'canceled'
                  ? (partialText || '(nothing was generated yet)')
                  : ''}
        </article>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canCancel && (
          <button
            type="button"
            data-action="cancel"
            data-testid="chat-transcript-cancel"
            onClick={onCancel}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
          >
            Stop drafting
          </button>
        )}
        {showReset && (
          <button
            type="button"
            data-action="reset"
            data-testid="chat-transcript-reset"
            onClick={onReset}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-[12px] text-gray-700 hover:border-indigo-300"
          >
            Try again
          </button>
        )}
      </div>
    </section>
  );
}
