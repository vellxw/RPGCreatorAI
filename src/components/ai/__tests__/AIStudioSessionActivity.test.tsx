import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AIStudioSessionActivity, type AIStudioActivityEntry } from '../AIStudioSessionActivity';

function renderActivity(entries: AIStudioActivityEntry[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  act(() => {
    root = createRoot(container);
    root.render(<AIStudioSessionActivity entries={entries} />);
  });
  return {
    container,
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}

describe('AIStudioSessionActivity', () => {
  it('renders an honest empty state when there are no entries', () => {
    const { container, unmount } = renderActivity([]);
    const root = container.querySelector('[data-testid="ai-studio-session-activity"]');
    expect(root?.getAttribute('data-state')).toBe('empty');
    expect(root?.textContent).toContain('No activity yet');
    unmount();
  });

  it('renders every entry with a stable data-activity-id and data-activity-kind', () => {
    const entries: AIStudioActivityEntry[] = [
      { id: 'a-1', kind: 'accept', message: 'Accepted a map draft.', at: '2026-06-16T10:00:00Z' },
      { id: 'a-2', kind: 'reject', message: 'Rejected a balance suggestion.', at: '2026-06-16T10:05:00Z' },
      { id: 'a-3', kind: 'archive', message: 'Archived an old event draft.', at: '2026-06-16T10:10:00Z' },
    ];
    const { container, unmount } = renderActivity(entries);
    const root = container.querySelector('[data-testid="ai-studio-session-activity"]');
    expect(root?.getAttribute('data-state')).toBe('populated');
    const items = container.querySelectorAll('[data-activity-id]');
    expect(items.length).toBe(3);
    expect(container.querySelector('[data-activity-id="a-1"]')?.getAttribute('data-activity-kind')).toBe('accept');
    expect(container.querySelector('[data-activity-id="a-2"]')?.getAttribute('data-activity-kind')).toBe('reject');
    expect(container.querySelector('[data-activity-id="a-3"]')?.getAttribute('data-activity-kind')).toBe('archive');
    unmount();
  });
});
