import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import { ActorsEditor } from '../ActorsEditor';
import { ClassesEditor } from '../ClassesEditor';
import { SkillsEditor } from '../SkillsEditor';
import { EnemiesEditor } from '../EnemiesEditor';
import { TroopsEditor } from '../TroopsEditor';
import type {
  ActorData,
  AssetCatalogEntry,
  ClassData,
  EnemyData,
  ItemData,
  SkillData,
  Stats,
  TroopData,
} from '../../../types/project';
import type {
  PortraitGenerationCandidate,
  PortraitGenerationRunner,
} from '../../../providers/portraitGenerationWorkflow';

function render(ui: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const found = container.querySelector(`input[aria-label="${label}"]`);
  if (!(found instanceof HTMLInputElement)) throw new Error(`Missing input: ${label}`);
  return found;
}

function checkbox(container: HTMLElement, label: string): HTMLInputElement {
  const found = container.querySelector(`input[type="checkbox"][aria-label="${label}"]`);
  if (!(found instanceof HTMLInputElement)) throw new Error(`Missing checkbox: ${label}`);
  return found;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return found;
}

function select(container: HTMLElement, label: string): HTMLSelectElement {
  const found = container.querySelector(`select[aria-label="${label}"]`);
  if (!(found instanceof HTMLSelectElement)) throw new Error(`Missing select: ${label}`);
  return found;
}

function changeText(el: HTMLInputElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(el, value);
    } else {
      valueSetter?.call(el, value);
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function changeSelect(el: HTMLSelectElement, value: string) {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function clickCheckbox(el: HTMLInputElement) {
  act(() => {
    el.click();
  });
}

async function clickAsync(container: HTMLElement, label: string) {
  const found = button(container, label);
  await act(async () => {
    found.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

const stats: Stats = {
  maxHp: 18,
  maxMp: 6,
  attack: 6,
  defense: 4,
  magicAttack: 3,
  magicDefense: 3,
  agility: 5,
  luck: 4,
};

const classes: ClassData[] = [
  { id: 'hero', name: 'Hero', growth: stats, usableEquipment: ['weapon'], learnedSkills: [] },
  { id: 'mage', name: 'Mage', growth: stats, usableEquipment: ['armor'], learnedSkills: [] },
];

const skills: SkillData[] = [
  { id: 'slash', name: 'Slash', description: '', mpCost: 0, power: 100, target: 'singleEnemy' },
  { id: 'guard', name: 'Guard', description: '', mpCost: 2, power: 0, target: 'self', element: 'physical' },
];

const items: ItemData[] = [
  { id: 'iron_sword', name: 'Iron Sword', description: '', type: 'weapon', slot: 'weapon' },
  { id: 'potion', name: 'Potion', description: '', type: 'consumable' },
];

describe('party and combat database editors', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits actor class, levels, stats, equipment, and skills', () => {
    const onChange = vi.fn();
    const actor: ActorData = {
      id: 'arc',
      name: 'Arc',
      classId: 'hero',
      level: 1,
      hp: 18,
      mp: 6,
      baseStats: stats,
      equipment: { weapon: null, armor: null, accessory: null },
      skills: ['slash'],
    };
    const view = render(
      <ActorsEditor
        entry={actor}
        classes={classes}
        skills={skills}
        items={items}
        idField={<span />}
        onChange={onChange}
      />,
    );

    changeSelect(select(view.container, 'Class'), 'mage');
    expect(onChange).toHaveBeenLastCalledWith({ classId: 'mage' });
    changeText(input(view.container, 'Level'), '2');
    expect(onChange).toHaveBeenLastCalledWith({ level: 2 });
    changeText(input(view.container, 'HP'), '20');
    expect(onChange).toHaveBeenLastCalledWith({ hp: 20 });
    changeText(input(view.container, 'Base Attack'), '7');
    expect(onChange).toHaveBeenLastCalledWith({ baseStats: { ...stats, attack: 7 } });
    changeSelect(select(view.container, 'Equipment weapon'), 'iron_sword');
    expect(onChange).toHaveBeenLastCalledWith({
      equipment: { weapon: 'iron_sword', armor: null, accessory: null },
    });
    expect(checkbox(view.container, 'Actor skill Slash').checked).toBe(true);
    clickCheckbox(checkbox(view.container, 'Actor skill Guard'));
    expect(onChange).toHaveBeenLastCalledWith({ skills: ['slash', 'guard'] });
    clickCheckbox(checkbox(view.container, 'Actor skill Slash'));
    expect(onChange).toHaveBeenLastCalledWith({ skills: [] });

    view.unmount();
  });

  it('generates an actor portrait candidate and assigns it only after review', async () => {
    const generatedAsset: AssetCatalogEntry = {
      id: 'arc_portrait',
      name: 'Arc Portrait',
      kind: 'image',
      path: 'assets/generated/portraits/arc_portrait.png',
      source: 'generated',
      tags: ['generated', 'portrait', 'actor', 'ai-draft', 'pending-review'],
      width: 1024,
      height: 1536,
      generated: {
        prompt: 'offline portrait prompt',
        tool: 'ai-portrait-generation-workflow',
        createdAt: '2026-06-02T19:26:00.000Z',
        promptTemplateId: 'portrait-character-v1',
        promptTemplateVersion: 1,
        promptTemplateKind: 'portrait',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    };
    const candidate: PortraitGenerationCandidate = {
      id: 'portrait-gen-ui',
      reviewState: 'pending',
      owner: { kind: 'actor', id: 'arc', name: 'Arc' },
      asset: generatedAsset,
      qaPreview: {
        assetRef: 'mock://generated/portrait-gen-ui.png',
        width: 1024,
        height: 1536,
        providerFixture: 'offline-image',
      },
    };
    const portraitGenerator: PortraitGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const actor: ActorData = {
      id: 'arc',
      name: 'Arc',
      classId: 'hero',
      level: 1,
      hp: 18,
      mp: 6,
      baseStats: stats,
      equipment: { weapon: null, armor: null, accessory: null },
      skills: ['slash'],
      portraitAssetId: 'existing_portrait',
    };
    const view = render(
      <ActorsEditor
        entry={actor}
        classes={classes}
        skills={skills}
        items={items}
        idField={<span />}
        assets={[]}
        portraitGenerator={portraitGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    act(() => button(view.container, 'Generate actor portrait').click());
    expect(view.container.querySelector('[aria-label="Actor portrait generation metadata preview"]')).not.toBeNull();
    changeText(input(view.container, 'Actor portrait subject'), 'Arc hero portrait with teal cloak');

    await clickAsync(view.container, 'Run actor portrait generation');

    expect(portraitGenerator).toHaveBeenCalledWith([], expect.objectContaining({
      owner: { kind: 'actor', id: 'arc', name: 'Arc' },
      promptInputs: expect.objectContaining({
        subject: 'Arc hero portrait with teal cloak',
      }),
    }));
    expect(view.container.querySelector('[aria-label="Generated actor portrait review"]')).not.toBeNull();
    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    await clickAsync(view.container, 'Accept generated actor portrait');

    expect(onAssetImported).toHaveBeenCalledWith(expect.objectContaining({
      id: 'arc_portrait',
      source: 'generated',
      tags: expect.arrayContaining(['reviewed']),
    }));
    expect(onChange).toHaveBeenLastCalledWith({ portraitAssetId: 'arc_portrait' });

    view.unmount();
  });

  it('edits class growth, usable equipment, and learned skills by level', () => {
    const onChange = vi.fn();
    const cls: ClassData = {
      id: 'hero',
      name: 'Hero',
      growth: stats,
      usableEquipment: ['weapon'],
      learnedSkills: [{ level: 1, skillId: 'slash' }],
    };
    const view = render(
      <ClassesEditor
        entry={cls}
        types={mergeDatabases(undefined).types}
        skills={skills}
        idField={<span />}
        onChange={onChange}
      />,
    );

    changeText(input(view.container, 'Growth Attack'), '3');
    expect(onChange).toHaveBeenLastCalledWith({ growth: { ...stats, attack: 3 } });
    clickCheckbox(checkbox(view.container, 'Usable equipment Armor'));
    expect(onChange).toHaveBeenLastCalledWith({ usableEquipment: ['weapon', 'armor'] });
    clickCheckbox(checkbox(view.container, 'Usable equipment Weapon'));
    expect(onChange).toHaveBeenLastCalledWith({ usableEquipment: [] });
    changeText(input(view.container, 'Learned skill level 1'), '3');
    expect(onChange).toHaveBeenLastCalledWith({ learnedSkills: [{ level: 3, skillId: 'slash' }] });
    changeSelect(select(view.container, 'Learned skill 1'), 'guard');
    expect(onChange).toHaveBeenLastCalledWith({ learnedSkills: [{ level: 1, skillId: 'guard' }] });

    view.unmount();
  });

  it('edits skill cost, target, element, power, and description', () => {
    const onChange = vi.fn();
    const skill = skills[0];
    const view = render(
      <SkillsEditor
        entry={skill}
        types={mergeDatabases(undefined).types}
        idField={<span />}
        onChange={onChange}
      />,
    );

    changeText(input(view.container, 'MP cost'), '4');
    expect(onChange).toHaveBeenLastCalledWith({ mpCost: 4 });
    changeSelect(select(view.container, 'Skill target'), 'allEnemies');
    expect(onChange).toHaveBeenLastCalledWith({ target: 'allEnemies' });
    changeSelect(select(view.container, 'Element'), 'fire');
    expect(onChange).toHaveBeenLastCalledWith({ element: 'fire' });
    changeText(input(view.container, 'Power'), '140');
    expect(onChange).toHaveBeenLastCalledWith({ power: 140 });
    changeText(input(view.container, 'Description'), 'Hits hard');
    expect(onChange).toHaveBeenLastCalledWith({ description: 'Hits hard' });

    view.unmount();
  });

  it('edits enemy stats, rewards, and drops', () => {
    const onChange = vi.fn();
    const enemy: EnemyData = {
      id: 'slime',
      name: 'Slime',
      stats,
      exp: 4,
      gold: 8,
      drops: [{ itemId: 'potion', rate: 0.25 }],
    };
    const view = render(
      <EnemiesEditor entry={enemy} items={items} idField={<span />} onChange={onChange} />,
    );

    changeText(input(view.container, 'Enemy Attack'), '8');
    expect(onChange).toHaveBeenLastCalledWith({ stats: { ...stats, attack: 8 } });
    changeText(input(view.container, 'Exp reward'), '5');
    expect(onChange).toHaveBeenLastCalledWith({ exp: 5 });
    changeText(input(view.container, 'Gold reward'), '12');
    expect(onChange).toHaveBeenLastCalledWith({ gold: 12 });
    changeSelect(select(view.container, 'Drop item 1'), 'iron_sword');
    expect(onChange).toHaveBeenLastCalledWith({ drops: [{ itemId: 'iron_sword', rate: 0.25 }] });
    changeText(input(view.container, 'Drop chance 1'), '0.5');
    expect(onChange).toHaveBeenLastCalledWith({ drops: [{ itemId: 'potion', rate: 0.5 }] });
    act(() => button(view.container, 'Add drop').click());
    expect(onChange).toHaveBeenLastCalledWith({
      drops: [
        { itemId: 'potion', rate: 0.25 },
        { itemId: 'iron_sword', rate: 1 },
      ],
    });
    act(() => button(view.container, 'Remove drop 1').click());
    expect(onChange).toHaveBeenLastCalledWith({ drops: [] });

    view.unmount();
  });

  it('does not add empty enemy drops when no item records exist', () => {
    const onChange = vi.fn();
    const enemy: EnemyData = {
      id: 'slime',
      name: 'Slime',
      stats,
      exp: 4,
      gold: 8,
      drops: [],
    };
    const view = render(
      <EnemiesEditor entry={enemy} items={[]} idField={<span />} onChange={onChange} />,
    );

    expect(button(view.container, 'Add drop').disabled).toBe(true);
    expect(view.container.textContent).toContain('Create an item before adding drops.');

    view.unmount();
  });

  it('edits ordered troop enemy members', () => {
    const onChange = vi.fn();
    const troop: TroopData = { id: 'slime_pair', name: 'Slime x2', members: ['slime', 'bat'] };
    const enemies: EnemyData[] = [
      { id: 'slime', name: 'Slime', stats, exp: 4, gold: 8, drops: [] },
      { id: 'bat', name: 'Bat', stats, exp: 6, gold: 10, drops: [] },
    ];
    const view = render(
      <TroopsEditor entry={troop} enemies={enemies} idField={<span />} onChange={onChange} />,
    );

    changeSelect(select(view.container, 'Troop member 1'), 'bat');
    expect(onChange).toHaveBeenLastCalledWith({ members: ['bat', 'bat'] });
    expect(button(view.container, 'Move troop member 1 up').disabled).toBe(true);
    expect(button(view.container, 'Move troop member 2 down').disabled).toBe(true);
    act(() => button(view.container, 'Move troop member 1 down').click());
    expect(onChange).toHaveBeenLastCalledWith({ members: ['bat', 'slime'] });
    act(() => button(view.container, 'Move troop member 2 up').click());
    expect(onChange).toHaveBeenLastCalledWith({ members: ['bat', 'slime'] });
    act(() => button(view.container, 'Add troop member').click());
    expect(onChange).toHaveBeenLastCalledWith({ members: ['slime', 'bat', 'slime'] });
    act(() => button(view.container, 'Remove troop member 1').click());
    expect(onChange).toHaveBeenLastCalledWith({ members: ['bat'] });

    view.unmount();
  });

  it('does not add empty troop members when no enemy records exist', () => {
    const onChange = vi.fn();
    const troop: TroopData = { id: 'empty', name: 'Empty', members: [] };
    const view = render(
      <TroopsEditor entry={troop} enemies={[]} idField={<span />} onChange={onChange} />,
    );

    expect(button(view.container, 'Add troop member').disabled).toBe(true);
    expect(view.container.textContent).toContain('Create an enemy before adding troop members.');

    view.unmount();
  });
});
