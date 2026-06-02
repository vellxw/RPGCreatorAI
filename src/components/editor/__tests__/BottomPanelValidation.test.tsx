import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BottomPanel } from '../BottomPanel';
import {
  initialProjectStoreState,
  ProjectContext,
  type ProjectAction,
  type ProjectStoreState,
} from '../../../stores/projectStore';

function renderPanel(state: ProjectStoreState): string {
  return renderToStaticMarkup(
    <ProjectContext.Provider value={{ state, dispatch: vi.fn<(action: ProjectAction) => void>() }}>
      <BottomPanel />
    </ProjectContext.Provider>,
  );
}

describe('BottomPanel validation recovery copy', () => {
  it('explains that validation errors block Save and how to recover', () => {
    const html = renderPanel({
      ...initialProjectStoreState,
      errors: [{ level: 'error', message: 'Start map is missing', source: 'project.startMapId' }],
    });

    expect(html).toContain('Save is blocked');
    expect(html).toContain('Fix the blocking items');
    expect(html).toContain('Start map is missing');
    expect(html).toContain('project.startMapId');
  });

  it('explains that warnings do not block Save', () => {
    const html = renderPanel({
      ...initialProjectStoreState,
      warnings: [{ level: 'warning', message: 'Map has no encounters', source: 'maps/town' }],
    });

    expect(html).toContain('Save is allowed');
    expect(html).toContain('Warnings are review items');
    expect(html).toContain('Map has no encounters');
  });

  it('keeps the valid state explicit about the save gate', () => {
    const html = renderPanel(initialProjectStoreState);

    expect(html).toContain('Project passes validation');
    expect(html).toContain('Save will still re-check before writing');
  });
});
