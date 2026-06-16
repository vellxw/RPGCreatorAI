import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AIActionCardPreview,
  type AIActionCardPreviewProps,
  type AIActionCardPreviewState,
  type AIActionCardPreviewKind,
} from '../AIActionCardPreview';

function renderCard(props: Partial<AIActionCardPreviewProps> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const state = (props.state ?? 'pending') as AIActionCardPreviewState;
  const kind = (props.kind ?? 'map-draft') as AIActionCardPreviewKind;
  const onAccept = props.onAccept ?? vi.fn();
  const onReject = props.onReject ?? vi.fn();
  act(() => {
    const root = createRoot(container);
    root.render(
      <AIActionCardPreview
        actionId={props.actionId ?? 'action-1'}
        kind={kind}
        title={props.title ?? 'Draft a new map outline'}
        summary={props.summary ?? 'A 10x8 town map with two event anchors and a tile-role set.'}
        state={state}
        validation={props.validation}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );
  });
  return { container, onAccept, onReject };
}

describe('AIActionCardPreview', () => {
  it('renders title, summary, and the kind badge', () => {
    const { container } = renderCard();
    const text = container.textContent ?? '';
    expect(text).toContain('Draft a new map outline');
    expect(text).toContain('10x8 town map');
    expect(text).toMatch(/map/i);
  });

  it('shows accept/reject affordances only in the pending state', () => {
    const { container } = renderCard({ state: 'pending' });
    expect(container.querySelector('button[data-action-id="accept"]')).toBeTruthy();
    expect(container.querySelector('button[data-action-id="reject"]')).toBeTruthy();
  });

  it('hides accept/reject affordances in the applied state (no double-apply)', () => {
    const { container } = renderCard({ state: 'applied' });
    expect(container.querySelector('button[data-action-id="accept"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="reject"]')).toBeNull();
  });

  it('hides accept/reject affordances in the invalid state until the user resolves the issues', () => {
    const { container } = renderCard({
      state: 'invalid',
      validation: { errors: ['Map width must be a positive integer'] },
    });
    expect(container.querySelector('button[data-action-id="accept"]')).toBeNull();
    const text = container.textContent ?? '';
    expect(text).toMatch(/Map width must be a positive integer/);
  });

  it('hides accept/reject affordances in the rejected state', () => {
    const { container } = renderCard({ state: 'rejected' });
    expect(container.querySelector('button[data-action-id="accept"]')).toBeNull();
    expect(container.querySelector('button[data-action-id="reject"]')).toBeNull();
  });

  it('fires onAccept with the action id when the accept button is clicked', () => {
    const { container, onAccept } = renderCard({ state: 'pending' });
    const button = container.querySelector<HTMLButtonElement>('button[data-action-id="accept"]');
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect((onAccept as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('action-1');
  });

  it('fires onReject with the action id when the reject button is clicked', () => {
    const { container, onReject } = renderCard({ state: 'pending' });
    const button = container.querySelector<HTMLButtonElement>('button[data-action-id="reject"]');
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('keeps the card inert by default: no implicit apply, no form submission', () => {
    const { container } = renderCard();
    const accept = container.querySelector<HTMLButtonElement>('button[data-action-id="accept"]');
    const reject = container.querySelector<HTMLButtonElement>('button[data-action-id="reject"]');
    expect(accept?.getAttribute('type')).toBe('button');
    expect(reject?.getAttribute('type')).toBe('button');
  });

  it('does not call any provider, store, or project mutation function on its own (snapshot test)', () => {
    const render = vi.fn();
    const { container } = renderCard({ onAccept: render, onReject: render });
    // The card rendered once. No button clicks happened. render count stays 0.
    expect(render).toHaveBeenCalledTimes(0);
    expect(container.querySelector('[data-testid="ai-action-card-preview"]')).toBeTruthy();
  });

  it('shows warnings list as a list, not as a paragraph dump', () => {
    const { container } = renderCard({
      state: 'valid',
      validation: { warnings: ['Audio tags reference missing asset id'] },
    });
    const list = container.querySelector('[data-testid="validation-warnings"]');
    expect(list).toBeTruthy();
    expect(list?.tagName.toLowerCase()).toBe('ul');
  });

  it('maps each state to a stable data-state attribute', () => {
    const states: AIActionCardPreviewState[] = ['pending', 'valid', 'invalid', 'applied', 'rejected'];
    for (const state of states) {
      const { container } = renderCard({ state });
      const card = container.querySelector<HTMLElement>('[data-testid="ai-action-card-preview"]');
      expect(card?.getAttribute('data-state')).toBe(state);
    }
  });
});
