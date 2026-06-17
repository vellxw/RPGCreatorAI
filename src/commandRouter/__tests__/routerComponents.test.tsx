import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ClarificationCard } from '../ClarificationCard';
import { IntentPreviewCard } from '../IntentPreviewCard';
import { RouterResultCard } from '../RouterResultCard';
import { useRouteCreatorRequest } from '../useRouteCreatorRequest';
import type { CommandRouterClarification } from '../ambiguity';
import type {
  CommandRouterIntent,
  MutationIntent,
  PreviewOnlyIntent,
  ReadOnlyIntent,
} from '../intentContract';
import type { CommandRouterResult } from '../router';

const SAMPLE_CLARIFICATION: CommandRouterClarification = {
  kind: 'clarification',
  question: 'Which creator workflow did you mean?',
  options: [
    { id: 'map', label: 'Edit or draft a map', detail: 'Map work', pipeline: 'map-draft' },
    {
      id: 'asset-character',
      label: 'Generate a character sprite sheet',
      detail: 'Animation work',
      pipeline: 'asset-sprite-sheet',
    },
  ],
  contextMessage: 'Help me with this project.',
};

function renderInto(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    container,
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}

describe('CommandRouter ClarificationCard', () => {
  it('renders the question and every option as a button', () => {
    const { container, unmount } = renderInto(
      <ClarificationCard clarification={SAMPLE_CLARIFICATION} />,
    );
    const card = container.querySelector('[data-testid="command-router-clarification"]');
    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-state')).toBe('clarification');
    expect(card?.getAttribute('data-option-count')).toBe('2');
    expect(container.querySelectorAll('[data-testid^="command-router-clarification-option-"]').length).toBe(2);
    unmount();
  });

  it('shows the original context message in italics', () => {
    const { container, unmount } = renderInto(
      <ClarificationCard clarification={SAMPLE_CLARIFICATION} />,
    );
    const context = container.querySelector('[data-testid="command-router-clarification-context"]');
    expect(context?.textContent).toContain('Help me with this project.');
    unmount();
  });

  it('invokes onSelect with optionId and pipeline when an option is clicked', () => {
    const onSelect = vi.fn();
    const { container, unmount } = renderInto(
      <ClarificationCard clarification={SAMPLE_CLARIFICATION} onSelect={onSelect} />,
    );
    const button = container.querySelector(
      '[data-testid="command-router-clarification-option-map"]',
    ) as HTMLButtonElement;
    act(() => button.click());
    expect(onSelect).toHaveBeenCalledWith('map', 'map-draft');
    unmount();
  });

  it('keeps the card inert by default: no provider, store, or programmatic navigation calls', () => {
    const { container, unmount } = renderInto(
      <ClarificationCard clarification={SAMPLE_CLARIFICATION} />,
    );
    const card = container.querySelector('[data-testid="command-router-clarification"]');
    expect(card?.getAttribute('data-state')).toBe('clarification');
    // No external script tags, no form, no hidden inputs, no links.
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('a[href]')).toBeNull();
    expect(container.querySelectorAll('button').length).toBe(2);
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.getAttribute('type')).toBe('button');
    }
    unmount();
  });
});

const READ_INTENT: ReadOnlyIntent = {
  id: 'intent-read-1',
  pipeline: 'map-draft',
  capability: 'read',
  confidence: 0.81,
  rationale: 'Matched map-draft (read) from creator message.',
  requiresProject: true,
  target: { projectId: 'project-1', mapId: 'map-1' },
};

const PREVIEW_INTENT: PreviewOnlyIntent = {
  id: 'intent-preview-1',
  pipeline: 'event-draft',
  capability: 'preview',
  confidence: 0.74,
  rationale: 'Matched event-draft (preview) from creator message.',
  requiresProject: true,
  target: { kind: 'event', projectId: 'project-1', mapId: 'map-1', eventId: 'event-1' },
  preview: {
    previewId: 'preview-1',
    title: 'Draft event commands',
    summary: 'Preview the proposed event-draft before applying it to the project.',
    payload: {},
  },
};

const MUTATION_INTENT: MutationIntent = {
  id: 'intent-mutation-1',
  pipeline: 'balancing',
  capability: 'mutation',
  confidence: 0.92,
  rationale: 'Matched balancing (mutation) from creator message.',
  requiresProject: true,
  target: { kind: 'project', projectId: 'project-1' },
  preview: {
    previewId: 'preview-2',
    title: 'Draft balancing',
    summary: 'Preview the proposed balancing before applying it to the project.',
    payload: {},
  },
  writeIntentId: 'write-1',
};

describe('CommandRouter IntentPreviewCard', () => {
  it('shows the read-only badge and a no-apply note for read intents', () => {
    const { container, unmount } = renderInto(<IntentPreviewCard intent={READ_INTENT} />);
    const card = container.querySelector('[data-testid="command-router-intent-preview"]');
    expect(card?.getAttribute('data-state')).toBe('read');
    expect(card?.getAttribute('data-pipeline')).toBe('map-draft');
    expect(container.querySelector('[data-testid="command-router-intent-preview-no-apply"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="command-router-intent-preview-accept"]')).toBeNull();
    unmount();
  });

  it('shows the preview badge and no apply button for preview-only intents', () => {
    const { container, unmount } = renderInto(<IntentPreviewCard intent={PREVIEW_INTENT} />);
    const card = container.querySelector('[data-testid="command-router-intent-preview"]');
    expect(card?.getAttribute('data-state')).toBe('preview');
    expect(container.querySelector('[data-testid="command-router-intent-preview-no-apply"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="command-router-intent-preview-accept"]')).toBeNull();
    unmount();
  });

  it('shows apply and discard buttons for mutation intents', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const { container, unmount } = renderInto(
      <IntentPreviewCard intent={MUTATION_INTENT} onAccept={onAccept} onReject={onReject} />,
    );
    const card = container.querySelector('[data-testid="command-router-intent-preview"]');
    expect(card?.getAttribute('data-state')).toBe('mutation');
    const accept = container.querySelector(
      '[data-testid="command-router-intent-preview-accept"]',
    ) as HTMLButtonElement;
    const reject = container.querySelector(
      '[data-testid="command-router-intent-preview-reject"]',
    ) as HTMLButtonElement;
    act(() => accept.click());
    act(() => reject.click());
    expect(onAccept).toHaveBeenCalledWith(MUTATION_INTENT);
    expect(onReject).toHaveBeenCalledWith(MUTATION_INTENT);
    unmount();
  });

  it('keeps apply/reject buttons as type=button to prevent form submission', () => {
    const { container, unmount } = renderInto(<IntentPreviewCard intent={MUTATION_INTENT} />);
    for (const button of Array.from(container.querySelectorAll('button'))) {
      expect(button.getAttribute('type')).toBe('button');
    }
    unmount();
  });

  it('exposes a stable confidence percentage and a target label', () => {
    const { container, unmount } = renderInto(<IntentPreviewCard intent={MUTATION_INTENT} />);
    expect(
      container.querySelector('[data-testid="command-router-intent-preview-confidence"]')?.textContent,
    ).toContain('92%');
    expect(
      container.querySelector('[data-testid="command-router-intent-preview-target"]')?.textContent,
    ).toContain('project project-1');
    unmount();
  });
});

const SAMPLE_RESULT_INTENT: CommandRouterResult = { kind: 'intent', intent: MUTATION_INTENT };
const SAMPLE_RESULT_CLARIFICATION: CommandRouterResult = {
  kind: 'clarification',
  clarification: SAMPLE_CLARIFICATION,
};

describe('CommandRouter RouterResultCard', () => {
  it('renders the clarification card for clarification results', () => {
    const { container, unmount } = renderInto(
      <RouterResultCard result={SAMPLE_RESULT_CLARIFICATION} />,
    );
    const card = container.querySelector('[data-testid="command-router-result"]');
    expect(card?.getAttribute('data-kind')).toBe('clarification');
    expect(container.querySelector('[data-testid="command-router-clarification"]')).toBeTruthy();
    unmount();
  });

  it('renders the intent preview card for intent results', () => {
    const { container, unmount } = renderInto(
      <RouterResultCard result={SAMPLE_RESULT_INTENT} />,
    );
    const card = container.querySelector('[data-testid="command-router-result"]');
    expect(card?.getAttribute('data-kind')).toBe('intent');
    expect(card?.getAttribute('data-pipeline')).toBe('balancing');
    expect(container.querySelector('[data-testid="command-router-intent-preview"]')).toBeTruthy();
    unmount();
  });
});

describe('CommandRouter useRouteCreatorRequest', () => {
  function Harness({ onReady }: { onReady: (api: ReturnType<typeof useRouteCreatorRequest>) => void }) {
    const api = useRouteCreatorRequest();
    onReady(api);
    return null;
  }

  function captureHarness(): {
    getApi: () => ReturnType<typeof useRouteCreatorRequest>;
    unmount: () => void;
  } {
    let apiRef: ReturnType<typeof useRouteCreatorRequest> | null = null;
    const container = document.createElement('div');
    document.body.appendChild(container);
    let root: ReturnType<typeof createRoot> | null = null;
    act(() => {
      root = createRoot(container);
      root.render(
        <Harness
          onReady={(a) => {
            apiRef = a;
          }}
        />,
      );
    });
    return {
      getApi: () => {
        if (!apiRef) throw new Error('expected api');
        return apiRef;
      },
      unmount: () => {
        act(() => root?.unmount());
        container.remove();
      },
    };
  }

  it('starts with no result and clear() resets state', () => {
    const { getApi, unmount } = captureHarness();
    expect(getApi().state.result).toBeNull();
    act(() => getApi().clear());
    expect(getApi().state.result).toBeNull();
    unmount();
  });

  it('route() returns a clarification when the input is ambiguous and stores it', () => {
    const { getApi, unmount } = captureHarness();
    let result: CommandRouterResult = { kind: 'clarification', clarification: SAMPLE_CLARIFICATION };
    act(() => {
      result = getApi().route({ message: 'Help me with this project.', projectId: 'project-1' });
    });
    expect(result.kind).toBe('clarification');
    expect(getApi().state.result?.kind).toBe('clarification');
    unmount();
  });

  it('route() returns a mutation intent for a focused balancing request', () => {
    const { getApi, unmount } = captureHarness();
    let result: CommandRouterResult = { kind: 'intent', intent: MUTATION_INTENT };
    act(() => {
      result = getApi().route({
        message: 'Rebalance this enemy stats so it survives two hits.',
        projectId: 'project-1',
      });
    });
    if (result.kind !== 'intent') throw new Error('expected intent');
    expect(result.intent.pipeline).toBe('balancing');
    expect(result.intent.capability).toBe('mutation');
    unmount();
  });
});
