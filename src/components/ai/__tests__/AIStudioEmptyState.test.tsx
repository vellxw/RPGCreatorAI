import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { AIStudioEmptyState, type AIStudioEmptyStateVariant } from '../AIStudioEmptyState';

function renderEmptyState(variant: AIStudioEmptyStateVariant, props: Partial<Parameters<typeof AIStudioEmptyState>[0]> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    const root = createRoot(container);
    root.render(
      <AIStudioEmptyState
        variant={variant}
        hasProject={props.hasProject ?? true}
        hasAnyConfiguredProvider={props.hasAnyConfiguredProvider ?? false}
        onSelectStarterTask={props.onSelectStarterTask ?? vi.fn()}
      />,
    );
  });
  return { container };
}

describe('AIStudioEmptyState', () => {
  it('renders the no-project variant with explicit guidance, not marketing copy', () => {
    const { container } = renderEmptyState('no-project', { hasProject: false });
    const text = container.textContent ?? '';
    expect(text).toMatch(/open or create a project/i);
    expect(text).not.toMatch(/revolutionary|cutting-edge|unleash/i);
  });

  it('renders the loaded-no-chat variant with project-aware starter tasks', () => {
    const { container } = renderEmptyState('project-loaded', { hasProject: true });
    const text = container.textContent ?? '';
    expect(text).toMatch(/starter/i);
    expect(container.querySelectorAll('button[data-starter-task]').length).toBeGreaterThanOrEqual(3);
  });

  it('hides provider/model detail copy from the starter variant', () => {
    const { container } = renderEmptyState('project-loaded', { hasProject: true });
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/provider/i);
    expect(text).not.toMatch(/model/i);
  });

  it('shows disabled-provider messaging when no provider is configured', () => {
    const { container } = renderEmptyState('providers-disabled', {
      hasProject: true,
      hasAnyConfiguredProvider: false,
    });
    const text = container.textContent ?? '';
    expect(text).toMatch(/provider/i);
    expect(text).toMatch(/settings/i);
  });

  it('fires onSelectStarterTask with a stable task id when a starter is clicked', () => {
    const onSelect = vi.fn();
    const { container } = renderEmptyState('project-loaded', {
      hasProject: true,
      onSelectStarterTask: onSelect,
    });
    const button = container.querySelector<HTMLButtonElement>('button[data-starter-task]');
    expect(button).toBeTruthy();
    act(() => {
      button?.click();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    const [taskId] = onSelect.mock.calls[0];
    expect(typeof taskId).toBe('string');
    expect(taskId.length).toBeGreaterThan(0);
  });

  it('does not render starter buttons in the no-project variant', () => {
    const { container } = renderEmptyState('no-project', { hasProject: false });
    expect(container.querySelectorAll('button[data-starter-task]').length).toBe(0);
  });

  it('does not render starter buttons in the providers-disabled variant', () => {
    const { container } = renderEmptyState('providers-disabled', { hasProject: true });
    expect(container.querySelectorAll('button[data-starter-task]').length).toBe(0);
  });
});
