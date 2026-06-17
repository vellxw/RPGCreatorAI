import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { AIStudioContextPanel } from '../AIStudioContextPanel';
import { buildProjectContext } from '../projectContext';

function renderPanel(projectId: string | null, context: ReturnType<typeof buildProjectContext>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: ReturnType<typeof createRoot> | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      <AIStudioContextPanel projectId={projectId} context={context} />,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}

describe('AIStudioContextPanel', () => {
  it('shows the no-project state when there is no projectId', () => {
    const { container, unmount } = renderPanel(null, null);
    const root = container.querySelector('[data-testid="ai-studio-context-panel"]');
    expect(root?.getAttribute('data-state')).toBe('no-project');
    expect(root?.textContent).toContain('No project open');
    unmount();
  });

  it('shows a loading state when the project exists but no context has been built yet', () => {
    const { container, unmount } = renderPanel('project-1', null);
    const root = container.querySelector('[data-testid="ai-studio-context-panel"]');
    expect(root?.getAttribute('data-state')).toBe('loading');
    expect(root?.textContent).toContain('Loading project context');
    unmount();
  });

  it('renders every bounded context section with a stable data attribute', () => {
    const context = buildProjectContext({
      projectId: 'project-1',
      projectTitle: 'Sample RPG',
      mapCount: 3,
      eventCount: 12,
      validationStatus: 'warnings',
      selectedMap: { id: 'map-1', name: 'Town', width: 20, height: 15, tilesetId: 'tileset-1' },
      selectedEvent: { id: 'event-1', pageIndex: 0, trigger: 'action' },
      database: { selectedTables: ['actors', 'items'], selectedRecordCount: 4, truncated: false },
    });
    const { container, unmount } = renderPanel('project-1', context);
    const root = container.querySelector('[data-testid="ai-studio-context-panel"]');
    expect(root?.getAttribute('data-state')).toBe('ready');
    for (const section of ['project', 'selected-map', 'selected-event', 'database']) {
      expect(container.querySelector(`[data-context-section="${section}"]`)).toBeTruthy();
    }
    expect(root?.textContent).toContain('Sample RPG');
    expect(root?.textContent).toContain('Town');
    expect(root?.textContent).toContain('20 × 15');
    expect(root?.textContent).toContain('actors, items');
    unmount();
  });

  it('never exposes paths, credentials, or provider secrets in the rendered copy', () => {
    const context = buildProjectContext({
      projectId: 'project-1',
      projectTitle: 'Sample RPG',
      database: { selectedTables: ['actors'], selectedRecordCount: 0, truncated: false },
    });
    const { container, unmount } = renderPanel('project-1', context);
    const copy = container.textContent?.toLowerCase() ?? '';
    expect(copy).not.toContain('c:\\\\');
    expect(copy).not.toContain('oneda');
    expect(copy).not.toContain('apikey');
    expect(copy).not.toContain('api_key');
    unmount();
  });
});
