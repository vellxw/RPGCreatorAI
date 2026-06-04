import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AIRequestQueuePanel } from '../AIRequestQueuePanel';
import { createAiRequestQueueState, type AiRequestJob } from '../../../stores/aiRequestQueueStore';

function job(overrides: Partial<AiRequestJob>): AiRequestJob {
  return {
    id: 'job-1',
    title: 'Generate quest outline',
    providerId: 'local',
    capability: 'text',
    state: 'queued',
    progress: 0,
    attempt: 1,
    maxRetries: 2,
    createdAt: '2026-06-02T12:00:00.000Z',
    updatedAt: '2026-06-02T12:00:00.000Z',
    idempotencyKey: 'quest-outline',
    writeIntentId: 'preview-quest-outline',
    ...overrides,
  };
}

function renderPanel(
  initialJobs: AiRequestJob[],
  handlers: { onCancel?: (id: string) => void; onRetry?: (id: string) => void } = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const state = createAiRequestQueueState({ initialJobs });

  act(() => {
    root = createRoot(container);
    root.render(
      <AIRequestQueuePanel
        queue={state}
        onCancel={handlers.onCancel ?? vi.fn()}
        onRetry={handlers.onRetry ?? vi.fn()}
      />,
    );
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('AIRequestQueuePanel', () => {
  it('shows an honest empty state without live provider actions', () => {
    const view = renderPanel([]);
    const text = view.container.textContent ?? '';

    expect(text).toContain('AI Request Queue');
    expect(text).toContain('No AI work is running');
    expect(text).toContain('normal validation uses mocks');
    expect(text).not.toMatch(/Generate|Connect|Test Connection/i);

    view.unmount();
  });

  it('shows running progress and invokes cancellation', () => {
    const onCancel = vi.fn();
    const view = renderPanel([
      job({ id: 'running-1', state: 'running', progress: 48, title: 'Draft map notes' }),
    ], { onCancel });

    expect(view.container.textContent).toContain('Draft map notes');
    expect(view.container.textContent).toContain('Running');
    expect(view.container.textContent).toContain('48%');

    const cancel = view.container.querySelector<HTMLButtonElement>('button[aria-label="Cancel Draft map notes"]');
    expect(cancel).toBeDefined();
    act(() => {
      cancel?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCancel).toHaveBeenCalledWith('running-1');
    view.unmount();
  });

  it('shows failure copy and retry affordance', () => {
    const onRetry = vi.fn();
    const view = renderPanel([
      job({
        id: 'failed-1',
        state: 'failed',
        progress: 25,
        title: 'Plan item icons',
        error: 'Fixture provider failure',
      }),
    ], { onRetry });

    expect(view.container.textContent).toContain('Plan item icons');
    expect(view.container.textContent).toContain('Failed');
    expect(view.container.textContent).toContain('Fixture provider failure');

    const retry = view.container.querySelector<HTMLButtonElement>('button[aria-label="Retry Plan item icons"]');
    expect(retry).toBeDefined();
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledWith('failed-1');
    view.unmount();
  });

  it('shows rate-limit retry timing and safe write-intent retry copy', () => {
    const onRetry = vi.fn();
    const view = renderPanel([
      job({
        id: 'rate-limited-1',
        state: 'failed',
        progress: 25,
        title: 'Generate portrait',
        error: 'Mock provider rate limit reached.',
        rateLimit: {
          status: 'rate-limited',
          retryAfterSeconds: 90,
          retryGuidance: 'Wait 90 seconds before retrying this provider request.',
        },
      }),
    ], { onRetry });
    const text = view.container.textContent ?? '';

    expect(text).toContain('Rate limited; retry after 90s');
    expect(text).toContain('Wait 90 seconds before retrying this provider request.');
    expect(text).toContain('Retry keeps the same write intent.');

    const retry = view.container.querySelector<HTMLButtonElement>('button[aria-label="Retry Generate portrait"]');
    expect(retry).toBeDefined();
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledWith('rate-limited-1');
    view.unmount();
  });
});
