import { describe, expect, it } from 'vitest';
import type { GameEvent, MapData } from '../../types/project';
import { findDuplicatePlacement, isEditableTarget } from '../eventEditing';

function mapWithEvents(events: GameEvent[]): MapData {
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    width: 3,
    height: 2,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: new Array(6).fill(1) },
      { name: 'collision', type: 'collision', tiles: new Array(6).fill(0) },
    ],
    events,
  };
}

describe('eventEditing', () => {
  it('chooses a unique duplicate id and the next free cell after the source', () => {
    const source: GameEvent = {
      id: 'npc_1',
      type: 'npc',
      x: 0,
      y: 0,
      solid: true,
      trigger: 'interact',
      commands: [],
    };
    const placement = findDuplicatePlacement(
      mapWithEvents([
        source,
        { ...source, id: 'npc_1_copy', x: 1, y: 0 },
        { ...source, id: 'blocker', x: 2, y: 0 },
      ]),
      source,
    );

    expect(placement).toEqual({ newId: 'npc_1_copy2', x: 0, y: 1 });
  });

  it('falls back to the source cell when every map cell is occupied', () => {
    const source: GameEvent = {
      id: 'npc_1',
      type: 'npc',
      x: 0,
      y: 0,
      solid: true,
      trigger: 'interact',
      commands: [],
    };
    const placement = findDuplicatePlacement(
      mapWithEvents([
        source,
        { ...source, id: 'a', x: 1, y: 0 },
        { ...source, id: 'b', x: 2, y: 0 },
        { ...source, id: 'c', x: 0, y: 1 },
        { ...source, id: 'd', x: 1, y: 1 },
        { ...source, id: 'e', x: 2, y: 1 },
      ]),
      source,
    );

    expect(placement).toEqual({ newId: 'npc_1_copy', x: 0, y: 0 });
  });

  it('treats editable DOM targets as shortcut shields', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');

    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(div)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
  });
});
