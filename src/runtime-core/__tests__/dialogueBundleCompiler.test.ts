import { describe, expect, it } from 'vitest';
import { createNewProjectState } from '../../adapters/projectTemplates';
import { compileGameBundleV1 } from '../gameBundleCompiler';

describe('GameBundle visual novel integration', () => {
  it('embeds validated renderer-neutral scenes in the offline bundle', () => {
    const state = createNewProjectState('VN bundle');
    state.dialogue = {
      schemaVersion: 1,
      scenes: {
        intro: {
          id: 'intro',
          entryNodeId: 'line',
          nodes: [
            { id: 'line', type: 'dialogue', speaker: 'Narrador', text: 'La puerta respiró.', next: 'end' },
            { id: 'end', type: 'ending', endingId: 'intro_complete' },
          ],
        },
      },
    };

    const result = compileGameBundleV1(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.dialogue?.scenes.intro.nodes[0]).toMatchObject({
      type: 'dialogue',
      speaker: 'Narrador',
    });
  });

  it('fails compilation when a scene contains a dangling node reference', () => {
    const state = createNewProjectState('Invalid VN bundle');
    state.dialogue = {
      schemaVersion: 1,
      scenes: {
        intro: {
          id: 'intro',
          entryNodeId: 'line',
          nodes: [{ id: 'line', type: 'dialogue', text: 'Sin salida.', next: 'missing' }],
        },
      },
    };
    const result = compileGameBundleV1(state);
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-value', path: 'dialogue.scenes.intro.nodes[0]' }),
    ]));
  });
});
