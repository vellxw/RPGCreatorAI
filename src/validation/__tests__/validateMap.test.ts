import { describe, expect, it } from 'vitest';
import { validateMap } from '../validateMap';
import type { EventCommand, MapData } from '../../types/project';

function makeMap(commands: EventCommand[]): MapData {
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 2,
    height: 2,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: [1, 1, 1, 1] },
      { name: 'collision', type: 'collision', tiles: [0, 0, 0, 0] },
    ],
    events: [
      {
        id: 'mover',
        type: 'npc',
        x: 0,
        y: 0,
        solid: false,
        trigger: 'interact',
        commands,
      },
    ],
  };
}

describe('validateMap movement routes', () => {
  it('reports malformed setMovementRoute shape instead of throwing', () => {
    const missingSteps = {
      type: 'setMovementRoute',
      target: 'player',
      repeat: false,
      skippable: true,
      wait: true,
    } as unknown as EventCommand;
    const invalidSteps = {
      type: 'setMovementRoute',
      target: 'player',
      repeat: false,
      skippable: true,
      wait: true,
      steps: 'moveRight',
    } as unknown as EventCommand;
    const missingTarget = {
      type: 'setMovementRoute',
      repeat: false,
      skippable: true,
      wait: true,
      steps: [],
    } as unknown as EventCommand;

    const messages = validateMap(makeMap([missingSteps, invalidSteps, missingTarget]), ['town']);

    expect(messages.some(m => m.message.includes('setMovementRoute steps must be an array'))).toBe(true);
    expect(messages.some(m => m.message.includes('setMovementRoute has invalid target'))).toBe(true);
  });
});
