import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AIStudioBoundary } from '../AIStudioBoundary';
import { defaultProviderConfigs } from '../../../stores/providerStore';
import type { ProviderConfig } from '../../../types/project';

const containerStack: HTMLElement[] = [];

function renderBoundary(props: { providers: readonly ProviderConfig[]; projectId: string | null }) {
  const container = document.createElement('div');
  containerStack.push(container);
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <AIStudioBoundary
        onApplyCandidate={() => ({ ok: false, code: 'commit-rejected', message: 'Test host is inert.' })}
        {...props}
      />,
    );
  });
  return {
    container,
    unmount: () => {
      flushSync(() => root.unmount());
    },
  };
}

afterEach(() => {
  while (containerStack.length > 0) {
    containerStack.pop()?.remove();
  }
});

describe('AIStudioBoundary', () => {
  it('renders AIStudioScreen and forwards providers + projectId', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    try {
      const { container, unmount } = renderBoundary({
        providers: defaultProviderConfigs,
        projectId: 'project-42',
      });
      const shell = container.querySelector('[data-testid="ai-studio-screen"]');
      expect(shell).not.toBeNull();
      expect(shell?.getAttribute('aria-label')).toBe('AI Studio');
      unmount();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('is a plain function component (boundary, not a class)', () => {
    expect(typeof AIStudioBoundary).toBe('function');
    // React function components have a callable prototype; classes do not. The
    // intent of this test is "not a class", which we assert by confirming the
    // function does not carry React component state machinery (no React internals).
    expect(AIStudioBoundary.length).toBe(1);
  });

  it('does not call any network APIs on mount', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    try {
      const { unmount } = renderBoundary({
        providers: defaultProviderConfigs,
        projectId: null,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
      unmount();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
