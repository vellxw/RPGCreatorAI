import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import { ItemsEditor } from '../ItemsEditor';
import { EquipmentEditor } from '../EquipmentEditor';
import { StatesEditor } from '../StatesEditor';
import type { ArmorData, ItemDatabase, StateData, WeaponData } from '../../../types/project';

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

describe('item, equipment, and state database editors', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits item identity, category, price, effects, slot, and modifiers', () => {
    const onChange = vi.fn();
    const value: ItemDatabase = {
      items: [
        {
          id: 'potion',
          name: 'Potion',
          description: 'Heals',
          type: 'consumable',
          price: 25,
          effect: { hp: 20 },
          modifiers: {},
        },
      ],
    };
    const view = render(
      <ItemsEditor value={value} types={mergeDatabases(undefined).types} onChange={onChange} />,
    );

    changeText(input(view.container, 'Item name'), 'Hi Potion');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ name: 'Hi Potion' })],
    });

    changeSelect(select(view.container, 'Item category'), 'key');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ type: 'key' })],
    });

    changeText(input(view.container, 'Item price'), '50');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ price: 50 })],
    });

    changeText(input(view.container, 'HP effect'), '35');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ effect: { hp: 35, mp: undefined } })],
    });

    changeSelect(select(view.container, 'Equipment slot'), 'accessory');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ slot: 'accessory' })],
    });

    changeText(input(view.container, 'Modifier attack'), '3');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ modifiers: expect.objectContaining({ attack: 3 }) })],
    });

    view.unmount();
  });

  it('edits weapon and armor type references, params, animations, and traits', () => {
    const types = mergeDatabases(undefined).types;
    const onWeaponChange = vi.fn();
    const onArmorChange = vi.fn();
    const weapon: WeaponData = {
      id: 'iron_sword',
      name: 'Iron Sword',
      description: '',
      weaponTypeId: 'sword',
      price: 80,
      params: {},
      animationId: '',
      traits: [],
    };
    const armor: ArmorData = {
      id: 'leather_armor',
      name: 'Leather Armor',
      description: '',
      armorTypeId: 'light',
      slot: 'body',
      price: 60,
      params: {},
      traits: [],
    };

    const weaponView = render(
      <EquipmentEditor
        kind="weapon"
        entry={weapon}
        types={types}
        animationOptions={[{ value: 'slash', label: 'Slash' }]}
        idField={<span />}
        onChange={onWeaponChange}
      />,
    );
    changeSelect(select(weaponView.container, 'Weapon type'), 'staff');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ weaponTypeId: 'staff' });
    changeText(input(weaponView.container, 'Weapon attack'), '5');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ params: { attack: 5 } });
    changeSelect(select(weaponView.container, 'Animation'), 'slash');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ animationId: 'slash' });
    changeText(input(weaponView.container, 'Traits'), 'sharp, twoHanded');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ traits: ['sharp', 'twoHanded'] });
    weaponView.unmount();

    const armorView = render(
      <EquipmentEditor
        kind="armor"
        entry={armor}
        types={types}
        animationOptions={[]}
        idField={<span />}
        onChange={onArmorChange}
      />,
    );
    changeSelect(select(armorView.container, 'Armor type'), 'heavy');
    expect(onArmorChange).toHaveBeenLastCalledWith({ armorTypeId: 'heavy' });
    changeSelect(select(armorView.container, 'Armor slot'), 'shield');
    expect(onArmorChange).toHaveBeenLastCalledWith({ slot: 'shield' });
    changeText(input(armorView.container, 'Armor defense'), '4');
    expect(onArmorChange).toHaveBeenLastCalledWith({ params: { defense: 4 } });
    armorView.unmount();
  });

  it('edits state priority, battle-end removal, restriction, and traits', () => {
    const onChange = vi.fn();
    const state: StateData = {
      id: 'poison',
      name: 'Poison',
      priority: 50,
      removeAtBattleEnd: false,
      restriction: 'none',
      traits: [],
    };
    const view = render(<StatesEditor entry={state} idField={<span />} onChange={onChange} />);

    changeText(input(view.container, 'State priority'), '80');
    expect(onChange).toHaveBeenLastCalledWith({ priority: 80 });
    changeSelect(select(view.container, 'Remove at battle end'), 'true');
    expect(onChange).toHaveBeenLastCalledWith({ removeAtBattleEnd: true });
    changeSelect(select(view.container, 'Restriction'), 'cannotMove');
    expect(onChange).toHaveBeenLastCalledWith({ restriction: 'cannotMove' });
    changeText(input(view.container, 'Traits'), 'damageOverTime, venom');
    expect(onChange).toHaveBeenLastCalledWith({ traits: ['damageOverTime', 'venom'] });

    view.unmount();
  });
});
