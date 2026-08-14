import { describe, expect, it } from 'vitest';
import { createProjectStateFromTemplate } from '../projectTemplates';

describe('project templates', () => {
  it('seeds the horror/BL template with its visual runtime profile', () => {
    const state = createProjectStateFromTemplate('horror-bl');
    expect(state.templateId).toBe('horror-bl');
    expect(state.project.title).toBe('La Novena Promesa');
    expect(state.project.visualProfile).toMatchObject({
      baseResolution: { width: 960, height: 540 },
      tileSize: 48,
      cameraMode: 'fixed-room',
    });
  });
});

