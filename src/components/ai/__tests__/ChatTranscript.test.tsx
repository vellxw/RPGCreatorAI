import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  ChatTranscript,
  type ChatTranscriptProps,
} from '../ChatTranscript';
import {
  chatRequestReducer,
  defaultChatRequestState,
  type ChatRequestState,
} from '../chatRequest';

function render(
  state: ChatRequestState,
  overrides: Partial<ChatTranscriptProps> = {},
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root;
  const props: ChatTranscriptProps = {
    request: state,
    userMessage: 'Draft a new actor',
    onCancel: overrides.onCancel ?? vi.fn(),
    onReset: overrides.onReset ?? vi.fn(),
    dataRequestId: overrides.dataRequestId ?? 'req-1',
  };
  act(() => {
    root = createRoot(container);
    root.render(<ChatTranscript {...props} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('ChatTranscript', () => {
  it('exposes a stable data-testid and data-state attribute per phase', () => {
    const streaming: ChatRequestState = chatRequestReducer(defaultChatRequestState, { type: 'start' });
    const view = render(streaming, { dataRequestId: 'req-stable' });
    const root = view.container.querySelector('[data-testid="chat-transcript"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('data-state')).toBe('streaming');
    expect(root?.getAttribute('data-request-id')).toBe('req-stable');
    view.unmount();
  });

  it('shows a non-technical streaming status with aria-live polite', () => {
    const streaming: ChatRequestState = chatRequestReducer(defaultChatRequestState, { type: 'start' });
    const view = render(streaming);
    const status = view.container.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(view.container.textContent).toMatch(/drafting/i);
    expect(view.container.textContent).not.toMatch(/model|token|api/i);
    view.unmount();
  });

  it('renders the canceled state with a "Try again" affordance, no jargon', () => {
    const onReset = vi.fn();
    const canceled: ChatRequestState = chatRequestReducer(defaultChatRequestState, { type: 'cancel' });
    const view = render(canceled, { onReset });
    const text = view.container.textContent ?? '';
    expect(text).toMatch(/canceled/i);
    expect(text).not.toMatch(/model|token|api/i);
    const button = view.container.querySelector<HTMLButtonElement>('button[data-action="reset"]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('type')).toBe('button');
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onReset).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('renders the failed state with assertive aria-live and Try again', () => {
    const onReset = vi.fn();
    const failed: ChatRequestState = chatRequestReducer(
      chatRequestReducer(defaultChatRequestState, { type: 'start' }),
      { type: 'fail', message: "We couldn't reach the provider. Try again in a moment." },
    );
    const view = render(failed, { onReset });
    const status = view.container.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('assertive');
    expect(view.container.textContent).toMatch(/try again in a moment/i);
    const button = view.container.querySelector<HTMLButtonElement>('button[data-action="reset"]');
    expect(button).toBeTruthy();
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onReset).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('shows a cancel button only while pending or streaming, and it is type=button', () => {
    const onCancel = vi.fn();
    const streaming: ChatRequestState = chatRequestReducer(defaultChatRequestState, { type: 'start' });
    const view = render(streaming, { onCancel });
    const button = view.container.querySelector<HTMLButtonElement>('button[data-action="cancel"]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('type')).toBe('button');
    act(() => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);

    const completed: ChatRequestState = chatRequestReducer(
      chatRequestReducer(
        chatRequestReducer(defaultChatRequestState, { type: 'start' }),
        { type: 'appendToken', token: 'Hi' },
      ),
      { type: 'complete' },
    );
    const done = render(completed, { onCancel });
    expect(done.container.querySelector('button[data-action="cancel"]')).toBeNull();
    done.unmount();
    view.unmount();
  });

  it('keeps the component inert by default: no provider, store, or programmatic navigation calls', () => {
    const streaming: ChatRequestState = chatRequestReducer(defaultChatRequestState, { type: 'start' });
    const view = render(streaming);
    // No forms; the only buttons are inert and have type=button. No anchors navigating away.
    const forms = view.container.querySelectorAll('form');
    expect(forms.length).toBe(0);
    const links = view.container.querySelectorAll('a[href]');
    expect(links.length).toBe(0);
    // No copy that promises an automatic run / execution.
    const text = view.container.textContent ?? '';
    expect(text).not.toMatch(/run now|execute now|deploy/i);
    view.unmount();
  });
});
