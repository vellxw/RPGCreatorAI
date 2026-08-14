import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AiStudioGenerationGateway,
  AiStudioTextGenerationRequest,
  AiStudioTextGenerationResult,
} from '../../../providers/aiStudio';
import { defaultProviderConfigs } from '../../../stores/providerStore';
import type { Candidate } from '../../../aiCandidates/candidateTypes';
import type { CandidateProjectApplyResult } from '../../../aiCandidates/candidateProjectCommit';
import { AIStudioScreen } from '../AIStudioScreen';

const NOW = '2026-08-14T12:00:00.000Z';

function setTextareaValue(input: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function cancellableThenSuccessfulGateway() {
  let attempts = 0;
  const generateText = (
    request: AiStudioTextGenerationRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<AiStudioTextGenerationResult> => {
    attempts += 1;
    const provenance = {
      providerId: 'local',
      modelId: 'offline-mock',
      operation: 'text.generate' as const,
      mode: 'offline' as const,
      createdAt: request.createdAt ?? NOW,
    };
    if (attempts > 1) {
      return Promise.resolve({
        status: 'succeeded',
        generationKind: 'text',
        requestId: request.id,
        provenance,
        output: { text: 'Do not answer the bell after midnight.' },
      });
    }
    return new Promise(resolve => {
      const cancel = () => resolve({
        status: 'cancelled',
        generationKind: 'text',
        requestId: request.id,
        provenance,
        failure: { kind: 'cancelled', message: 'Cancelled by test creator.' },
      });
      if (options.signal?.aborted) cancel();
      else options.signal?.addEventListener('abort', cancel, { once: true });
    });
  };

  const gateway: AiStudioGenerationGateway = {
    generateText,
    generateImage: async () => {
      throw new Error('Image generation is not expected in this test.');
    },
  };
  return { gateway, attempts: () => attempts };
}

function renderStudio(
  gateway: AiStudioGenerationGateway,
  onApplyCandidate = vi.fn<(candidate: Candidate) => CandidateProjectApplyResult>(() => ({
    ok: false,
    code: 'commit-rejected',
    message: 'Test host is inert.',
  })),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(
      <AIStudioScreen
        providers={defaultProviderConfigs}
        projectId="horror-project"
        projectTitle="The Bell Below"
        selectedMap={{
          id: 'chapel',
          name: 'Abandoned Chapel',
          width: 20,
          height: 14,
          tilesetId: null,
        }}
        generationGateway={gateway}
        onApplyCandidate={onApplyCandidate}
      />,
    );
  });
  return {
    container,
    onApplyCandidate,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('AI Studio provider generation integration', () => {
  it('cancels safely, retries the original prompt, and gates the event behind candidate review', async () => {
    const provider = cancellableThenSuccessfulGateway();
    const view = renderStudio(provider.gateway);
    const prompt = view.container.querySelector<HTMLTextAreaElement>(
      '[data-testid="ai-studio-generation-prompt"]',
    );
    const submit = view.container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-studio-generation-submit"]',
    );
    if (!prompt || !submit) throw new Error('Generation controls are missing.');

    act(() => setTextareaValue(prompt, 'Write the chapel bell warning.'));
    act(() => submit.click());
    expect(provider.attempts()).toBe(1);

    const cancel = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Cancel Offline event-text draft"]',
    );
    if (!cancel) throw new Error('Running queue item has no cancel action.');
    await act(async () => {
      cancel.click();
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain('Cancelled');
    expect(view.container.querySelector('[data-testid="ai-candidate-card"]')).toBeNull();

    const retry = view.container.querySelector<HTMLButtonElement>(
      'button[aria-label="Retry Offline event-text draft"]',
    );
    if (!retry) throw new Error('Cancelled queue item has no retry action.');
    await act(async () => {
      retry.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(provider.attempts()).toBe(2);
    const candidate = view.container.querySelector('[data-testid="ai-candidate-card"]');
    expect(candidate).toBeTruthy();
    expect(candidate?.getAttribute('data-kind')).toBe('event-draft');
    expect(view.onApplyCandidate).not.toHaveBeenCalled();

    const accept = view.container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-candidate-accept"]',
    );
    if (!accept) throw new Error('Generated candidate has no review accept action.');
    act(() => accept.click());

    expect(view.onApplyCandidate).toHaveBeenCalledTimes(1);
    expect(view.onApplyCandidate.mock.calls[0][0].payload.applyActions[0]).toMatchObject({
      type: 'ADD_EVENT',
      mapId: 'chapel',
      event: {
        trigger: 'interact',
        commands: [{ type: 'showText', text: 'Do not answer the bell after midnight.' }],
      },
    });
    view.unmount();
  });
});
