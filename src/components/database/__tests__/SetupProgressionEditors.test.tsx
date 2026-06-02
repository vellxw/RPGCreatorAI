import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestsEditor } from '../QuestsEditor';
import { ShopsEditor } from '../ShopsEditor';
import { SwitchesVariablesEditor } from '../SwitchesVariablesEditor';
import { SystemEditor } from '../SystemEditor';
import type {
  ActorData,
  AnimationSetData,
  ItemData,
  QuestData,
  ShopData,
  Stats,
  SwitchData,
  SystemData,
  VariableData,
} from '../../../types/project';

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

const stats: Stats = {
  maxHp: 10,
  maxMp: 5,
  attack: 4,
  defense: 3,
  magicAttack: 2,
  magicDefense: 2,
  agility: 3,
  luck: 1,
};

const items: ItemData[] = [
  { id: 'potion', name: 'Potion', description: '', type: 'consumable', price: 25 },
  { id: 'ether', name: 'Ether', description: '', type: 'consumable', price: 40 },
];

const actors: ActorData[] = [
  {
    id: 'arc',
    name: 'Arc',
    classId: 'hero',
    level: 1,
    hp: 10,
    mp: 5,
    baseStats: stats,
    equipment: {},
    skills: [],
  },
  {
    id: 'mei',
    name: 'Mei',
    classId: 'mage',
    level: 1,
    hp: 8,
    mp: 9,
    baseStats: stats,
    equipment: {},
    skills: [],
  },
];

describe('setup and progression database editors', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits quest objectives and rewards without regenerating objective ids', () => {
    const onChange = vi.fn();
    const quest: QuestData = {
      id: 'lost_chest',
      title: 'The Lost Chest',
      summary: 'Find it',
      objectives: [{ id: 'open_chest', description: 'Open the chest' }],
      rewards: { gold: 30, exp: 10, items: [{ itemId: 'potion', amount: 1 }] },
    };
    const view = render(<QuestsEditor entry={quest} items={items} idField={<span />} onChange={onChange} />);

    changeText(input(view.container, 'Quest title'), 'The Found Chest');
    expect(onChange).toHaveBeenLastCalledWith({ title: 'The Found Chest' });
    changeText(input(view.container, 'Objective ID 1'), 'return_home');
    expect(onChange).toHaveBeenLastCalledWith({
      objectives: [{ id: 'return_home', description: 'Open the chest' }],
    });
    changeText(input(view.container, 'Objective description 1'), 'Return home');
    expect(onChange).toHaveBeenLastCalledWith({
      objectives: [{ id: 'open_chest', description: 'Return home' }],
    });
    changeText(input(view.container, 'Reward gold'), '45');
    expect(onChange).toHaveBeenLastCalledWith({ rewards: { ...quest.rewards, gold: 45 } });
    changeSelect(select(view.container, 'Reward item 1'), 'ether');
    expect(onChange).toHaveBeenLastCalledWith({
      rewards: { ...quest.rewards, items: [{ itemId: 'ether', amount: 1 }] },
    });
    changeText(input(view.container, 'Reward item amount 1'), '2');
    expect(onChange).toHaveBeenLastCalledWith({
      rewards: { ...quest.rewards, items: [{ itemId: 'potion', amount: 2 }] },
    });

    view.unmount();
  });

  it('edits shop listings and flags duplicate listings inline', () => {
    const onChange = vi.fn();
    const shop: ShopData = {
      id: 'town_shop',
      name: 'Town Shop',
      listings: [
        { itemId: 'potion', price: 25 },
        { itemId: 'potion', price: 30 },
      ],
    };
    const view = render(<ShopsEditor entry={shop} items={items} idField={<span />} onChange={onChange} />);

    expect(view.container.textContent).toContain('Duplicate listing');
    changeSelect(select(view.container, 'Listing item 1'), 'ether');
    expect(onChange).toHaveBeenLastCalledWith({
      listings: [
        { itemId: 'ether', price: 25 },
        { itemId: 'potion', price: 30 },
      ],
    });
    changeText(input(view.container, 'Listing price 1'), '35');
    expect(onChange).toHaveBeenLastCalledWith({
      listings: [
        { itemId: 'potion', price: 35 },
        { itemId: 'potion', price: 30 },
      ],
    });

    view.unmount();
  });

  it('edits switch and variable values while showing usage counts', () => {
    const onSwitchChange = vi.fn();
    const onVariableChange = vi.fn();
    const sw: SwitchData = { id: 'talked', name: 'Talked', initial: false };
    const variable: VariableData = { id: 'progress', name: 'Progress', initial: 1 };

    const switchView = render(
      <SwitchesVariablesEditor kind="switch" entry={sw} usageCount={3} idField={<span />} onChange={onSwitchChange} />,
    );
    expect(switchView.container.textContent).toContain('Used 3 times');
    changeText(input(switchView.container, 'Name'), 'Talked to elder');
    expect(onSwitchChange).toHaveBeenLastCalledWith({ name: 'Talked to elder' });
    changeSelect(select(switchView.container, 'Initial value'), 'true');
    expect(onSwitchChange).toHaveBeenLastCalledWith({ initial: true });
    switchView.unmount();

    const variableView = render(
      <SwitchesVariablesEditor
        kind="variable"
        entry={variable}
        usageCount={1}
        idField={<span />}
        onChange={onVariableChange}
      />,
    );
    expect(variableView.container.textContent).toContain('Used 1 time');
    changeText(input(variableView.container, 'Initial value'), '4');
    expect(onVariableChange).toHaveBeenLastCalledWith({ initial: 4 });
    variableView.unmount();
  });

  it('edits system defaults and references', () => {
    const onChange = vi.fn();
    const animations: AnimationSetData[] = [
      { id: 'player_adventurer', clips: [] },
      { id: 'player_mage', clips: [] },
    ];
    const system: SystemData = {
      startingParty: ['arc'],
      startingGold: 50,
      playerAnimationSet: 'player_adventurer',
      playerMovementSpeed: 'double',
      defaultCharacterHeightTiles: 1.5,
      defaultBgm: 'town_theme',
      audio: {
        town_theme: 'assets/audio/town_bgm.wav',
        chest_open: 'assets/audio/chest.wav',
      },
      windowTint: 'indigo',
      battleBackground: 'grass_field',
    };
    const view = render(
      <SystemEditor system={system} actors={actors} animations={animations} onChange={onChange} />,
    );

    changeText(input(view.container, 'Starting gold'), '75');
    expect(onChange).toHaveBeenLastCalledWith({ startingGold: 75 });
    changeText(input(view.container, 'Starting party'), 'arc, mei');
    expect(onChange).toHaveBeenLastCalledWith({ startingParty: ['arc', 'mei'] });
    changeSelect(select(view.container, 'Player animation set'), 'player_mage');
    expect(onChange).toHaveBeenLastCalledWith({ playerAnimationSet: 'player_mage' });
    changeSelect(select(view.container, 'Player movement speed'), 'normal');
    expect(onChange).toHaveBeenLastCalledWith({ playerMovementSpeed: 'normal' });
    changeText(input(view.container, 'Default character height (tiles)'), '1.75');
    expect(onChange).toHaveBeenLastCalledWith({ defaultCharacterHeightTiles: 1.75 });
    changeSelect(select(view.container, 'Default BGM'), 'chest_open');
    expect(onChange).toHaveBeenLastCalledWith({ defaultBgm: 'chest_open' });
    changeText(input(view.container, 'Audio path 1'), 'assets/audio/town_alt.wav');
    expect(onChange).toHaveBeenLastCalledWith({
      audio: {
        town_theme: 'assets/audio/town_alt.wav',
        chest_open: 'assets/audio/chest.wav',
      },
    });
    changeText(input(view.container, 'Audio ID 2'), 'door_open');
    expect(onChange).toHaveBeenLastCalledWith({
      audio: {
        town_theme: 'assets/audio/town_bgm.wav',
        door_open: 'assets/audio/chest.wav',
      },
    });

    view.unmount();
  });
});
