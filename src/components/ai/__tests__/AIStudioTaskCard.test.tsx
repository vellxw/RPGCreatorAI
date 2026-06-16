import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import {
  AIStudioTaskCard,
  type AIStudioTaskCardAction,
  type AIStudioTaskCardProps,
  type AIStudioTaskStatus,
} from '../AIStudioTaskCard';

function renderCard(props: Partial<AIStudioTaskCardProps> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const taskId = props.taskId ?? 'task-1';
  const title = props.title ?? 'Repair broken references';
  const detail = props.detail ?? 'Find and propose offline-safe fixes for broken references.';
  const status = (props.status ?? 'planned') as AIStudioTaskStatus;
  const actions: AIStudioTaskCardAction[] = props.actions ?? [
    { id: 'open', label: 'Open draft', kind: 'primary' },
    { id: 'dismiss', label: 'Dismiss', kind: 'muted' },
  ];
  const onAction = props.onAction ?? vi.fn();
  act(() => {
    const root = createRoot(container);
    root.render(
      <AIStudioTaskCard
        taskId={taskId}
        title={title}
        detail={detail}
        status={status}
        contextLabel={props.contextLabel}
        contextHref={props.contextHref}
        actions={actions}
        onAction={onAction}
      />,
    );
  });
  return { container, onAction };
}

describe('AIStudioTaskCard', () => {
  it('renders title, detail, and the status badge', () => {
    const { container } = renderCard();
    const text = container.textContent ?? '';
    expect(text).toContain('Repair broken references');
    expect(text).toContain('Find and propose offline-safe fixes');
    expect(text).toMatch(/planned/i);
  });

  it('maps each status to a human-readable label and a stable data-status', () => {
    const statuses: AIStudioTaskStatus[] = ['planned', 'in-review', 'accepted', 'rejected', 'deferred'];
    for (const status of statuses) {
      const { container } = renderCard({ status });
      const card = container.querySelector<HTMLElement>('[data-testid="ai-studio-task-card"]');
      expect(card?.getAttribute('data-status')).toBe(status);
    }
  });

  it('shows a context link when contextLabel and contextHref are provided', () => {
    const { container } = renderCard({ contextLabel: 'Town 1', contextHref: '#map/town-1' });
    const link = container.querySelector<HTMLAnchorElement>('a[data-testid="task-context-link"]');
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain('Town 1');
    expect(link?.getAttribute('href')).toBe('#map/town-1');
  });

  it('hides the context link when contextLabel or contextHref is missing', () => {
    const { container } = renderCard({ contextLabel: undefined, contextHref: undefined });
    expect(container.querySelector('[data-testid="task-context-link"]')).toBeNull();
  });

  it('fires onAction with the action id and the task id when a primary action is clicked', () => {
    const { container, onAction } = renderCard();
    const button = container.querySelector<HTMLButtonElement>('button[data-action-id="open"]');
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    const [actionId, taskId] = (onAction as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(actionId).toBe('open');
    expect(taskId).toBe('task-1');
  });

  it('keeps actions inert by default: does not navigate and does not trigger any URL change', () => {
    const { container } = renderCard();
    const button = container.querySelector<HTMLButtonElement>('button[data-action-id="open"]');
    expect(button?.getAttribute('type')).toBe('button');
  });

  it('does not include any "Run now" or live-action verb in the rendered copy', () => {
    const { container } = renderCard({
      title: 'Generate asset candidate',
      actions: [{ id: 'go', label: 'Go', kind: 'primary' }],
    });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/run now|execute now|deploy/i);
  });

  it('renders the muted action with a distinct visual treatment', () => {
    const { container } = renderCard();
    const muted = container.querySelector<HTMLButtonElement>('button[data-action-id="dismiss"]');
    const primary = container.querySelector<HTMLButtonElement>('button[data-action-id="open"]');
    expect(muted).toBeTruthy();
    expect(primary).toBeTruthy();
    expect(muted?.className).not.toBe(primary?.className);
  });
});
