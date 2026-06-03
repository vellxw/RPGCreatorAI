import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActorsEditor } from '../ActorsEditor';
import { EnemiesEditor } from '../EnemiesEditor';
import { ItemsEditor } from '../ItemsEditor';
import type { ActorData, EnemyData, ItemData, ItemDatabase, TypesDatabaseData } from '../../../types/project';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const classes = [{ id: 'warrior', name: 'Warrior' }];
const items: ItemData[] = [{ id: 'potion', name: 'Potion', description: '', type: 'consumable', price: 10 }];
const skills = [{ id: 'slash', name: 'Slash', description: '' }];

const sampleActor: ActorData = {
  id: 'warrior_1',
  name: 'Conan',
  classId: 'warrior',
  level: 1,
  hp: 100,
  mp: 20,
  baseStats: {
    maxHp: 100,
    maxMp: 20,
    attack: 10,
    defense: 10,
    magicAttack: 5,
    magicDefense: 5,
    agility: 8,
    luck: 5,
  },
  equipment: { weapon: null, armor: null, accessory: null },
  skills: [],
};

const sampleEnemy: EnemyData = {
  id: 'slime_1',
  name: 'Green Slime',
  stats: {
    maxHp: 50,
    maxMp: 0,
    attack: 5,
    defense: 3,
    magicAttack: 0,
    magicDefense: 2,
    agility: 4,
    luck: 1,
  },
  exp: 10,
  gold: 5,
  drops: [],
};

const sampleItemDb: ItemDatabase = {
  items: [
    {
      id: 'sword_1',
      name: 'Iron Sword',
      description: 'A basic iron sword.',
      type: 'weapon',
      price: 50,
      effect: {},
      modifiers: {},
    },
  ],
};

const mockTypes: TypesDatabaseData = {
  itemCategories: [{ id: 'weapon', name: 'Weapon' }, { id: 'consumable', name: 'Consumable' }],
  equipmentSlots: [{ id: 'weapon', name: 'Weapon' }],
  weaponTypes: [],
  armorTypes: [],
  elements: [],
  skillTypes: [],
};

describe('AI Database Draft Generator UI Integration', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('generates an actor draft in ActorsEditor and applies it on Accept', async () => {
    const onChangeMock = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        <ActorsEditor
          entry={sampleActor}
          classes={classes as any}
          skills={skills as any}
          items={items}
          idField={<div>ID</div>}
          onChange={onChangeMock}
        />
      );
    });

    const sparklesBtn = container.querySelector('button[aria-label="Generate actor draft"]');
    expect(sparklesBtn).not.toBeNull();

    // Open modal
    act(() => {
      (sparklesBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Generate Actor Draft');

    const generateBtn = document.body.querySelector('button[aria-label="Generate Draft"]');
    expect(generateBtn).not.toBeNull();

    // Generate draft
    await act(async () => {
      (generateBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Candidate Review Details');

    const acceptBtn = document.body.querySelector('button[aria-label="Accept and Insert"]');
    expect(acceptBtn).not.toBeNull();

    // Accept draft
    act(() => {
      (acceptBtn as HTMLButtonElement).click();
    });

    expect(onChangeMock).toHaveBeenCalled();
    const calledWith = onChangeMock.mock.calls[0][0];
    expect(calledWith.name).toBe('Conan');
    expect(calledWith.classId).toBe('warrior');
    expect(calledWith.hp).toBe(450);
  });

  it('generates an enemy draft in EnemiesEditor and applies it on Accept', async () => {
    const onChangeMock = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        <EnemiesEditor
          entry={sampleEnemy}
          items={items}
          idField={<div>ID</div>}
          onChange={onChangeMock}
        />
      );
    });

    const sparklesBtn = container.querySelector('button[aria-label="Generate enemy draft"]');
    expect(sparklesBtn).not.toBeNull();

    // Open modal
    act(() => {
      (sparklesBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Generate Enemy Draft');

    const generateBtn = document.body.querySelector('button[aria-label="Generate Draft"]');
    expect(generateBtn).not.toBeNull();

    // Generate draft
    await act(async () => {
      (generateBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Candidate Review Details');

    const acceptBtn = document.body.querySelector('button[aria-label="Accept and Insert"]');
    expect(acceptBtn).not.toBeNull();

    // Accept draft
    act(() => {
      (acceptBtn as HTMLButtonElement).click();
    });

    expect(onChangeMock).toHaveBeenCalled();
    const calledWith = onChangeMock.mock.calls[0][0];
    expect(calledWith.name).toBe('Green Slime');
    expect(calledWith.exp).toBe(35);
    expect(calledWith.gold).toBe(20);
    expect(calledWith.drops[0].itemId).toBe('potion');
  });

  it('generates an item draft in ItemsEditor and applies it on Accept', async () => {
    const onChangeMock = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEditor
          value={sampleItemDb}
          types={mockTypes}
          onChange={onChangeMock}
        />
      );
    });

    const sparklesBtn = container.querySelector('button[aria-label="Generate item draft"]');
    expect(sparklesBtn).not.toBeNull();

    // Open modal
    act(() => {
      (sparklesBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Generate Item Draft');

    const generateBtn = document.body.querySelector('button[aria-label="Generate Draft"]');
    expect(generateBtn).not.toBeNull();

    // Generate draft
    await act(async () => {
      (generateBtn as HTMLButtonElement).click();
    });
    expect(document.body.innerHTML).toContain('Candidate Review Details');

    const acceptBtn = document.body.querySelector('button[aria-label="Accept and Insert"]');
    expect(acceptBtn).not.toBeNull();

    // Accept draft
    act(() => {
      (acceptBtn as HTMLButtonElement).click();
    });

    expect(onChangeMock).toHaveBeenCalled();
    const calledWith = onChangeMock.mock.calls[0][0];
    expect(calledWith.items[0].name).toBe('Iron Sword');
    expect(calledWith.items[0].price).toBe(50);
  });
});
