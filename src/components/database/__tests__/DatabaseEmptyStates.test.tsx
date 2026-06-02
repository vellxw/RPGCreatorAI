import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';
import { DatabaseScreen } from '../../../screens/DatabaseScreen';
import { DatabaseList } from '../DatabaseList';

function renderWithProject(ui: React.ReactNode, state: ProjectStoreState): string {
  return renderToStaticMarkup(
    <ProjectContext.Provider value={{ state, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
      {ui}
    </ProjectContext.Provider>,
  );
}

describe('database empty states', () => {
  it('keeps an empty database list actionable', () => {
    const html = renderWithProject(
      <DatabaseList table="actors" entries={[]} selectedId={null} onSelect={vi.fn()} />,
      initialProjectStoreState,
    );

    expect(html).toContain('No actors yet');
    expect(html).toContain('Use New actor to define the first actor record');
    expect(html).toContain('New actor');
  });

  it('guides the detail pane when the active database tab has no entries', () => {
    const state: ProjectStoreState = {
      ...initialProjectStoreState,
      databases: {
        ...initialProjectStoreState.databases,
        actors: [],
      },
    };

    const html = renderWithProject(<DatabaseScreen />, state);

    expect(html).toContain('No actors selected');
    expect(html).toContain('Create an actor from the list to edit stats');
  });

  it('names every database tab in the horizontally scrollable tab strip', () => {
    const html = renderWithProject(<DatabaseScreen />, initialProjectStoreState);

    expect(html).toContain('aria-label="Database tables"');
    expect(html).toContain('aria-label="Open Actors database tab"');
    expect(html).toContain('aria-label="Open Common Events database tab"');
    expect(html).toContain('aria-label="Open System database tab"');
  });
});
