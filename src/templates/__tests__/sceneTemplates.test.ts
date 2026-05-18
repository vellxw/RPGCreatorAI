import { describe, expect, it } from 'vitest';
import { validateMap } from '../../validation/validateMap';
import { SCENE_TEMPLATES, cloneSceneTemplateMap } from '../sceneTemplates';

describe('scene templates', () => {
  it('ships the required starter scenes', () => {
    expect(SCENE_TEMPLATES.map(template => template.id)).toEqual([
      'story-room-16x9',
      'town-street-16x9',
      'forest-clearing-16x9',
      'snowy-village-16x9',
      'square-room',
      'small-interior',
      'cave-battle-approach',
    ]);
  });

  it('creates filled, bounded, interaction-ready maps', () => {
    for (const template of SCENE_TEMPLATES) {
      const report = validateMap(template.map, [template.map.id]);
      expect(report.filter(message => message.level === 'error')).toEqual([]);
      expect(report.some(message => message.message.includes('void tile'))).toBe(false);
      expect(template.map.layers[0].tiles).toHaveLength(template.map.width * template.map.height);
      expect(template.map.layers[1].tiles).toHaveLength(template.map.width * template.map.height);
      expect(template.map.layers[1].tiles.some(tile => tile === 9)).toBe(true);
      expect(template.map.events.length).toBeGreaterThanOrEqual(1);
      expect(template.map.events.some(event => event.commands.length > 0)).toBe(true);
      expect(template.startPosition.x).toBeGreaterThanOrEqual(0);
      expect(template.startPosition.x).toBeLessThan(template.map.width);
      expect(template.startPosition.y).toBeGreaterThanOrEqual(0);
      expect(template.startPosition.y).toBeLessThan(template.map.height);
    }
  });

  it('clones a template onto an existing map identity without mutating the source', () => {
    const clone = cloneSceneTemplateMap('forest-clearing-16x9', 'town', 'Town');
    expect(clone.id).toBe('town');
    expect(clone.name).toBe('Town');
    clone.layers[0].tiles[0] = 99;
    expect(SCENE_TEMPLATES.find(template => template.id === 'forest-clearing-16x9')?.map.layers[0].tiles[0]).not.toBe(99);
  });
});
