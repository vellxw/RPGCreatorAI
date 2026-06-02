import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import { ItemsEditor } from '../ItemsEditor';
import { EquipmentEditor } from '../EquipmentEditor';
import { StatesEditor } from '../StatesEditor';
import type { ArmorData, AssetCatalogEntry, ItemDatabase, StateData, WeaponData } from '../../../types/project';
import type {
  ItemIconGenerationCandidate,
  ItemIconGenerationRunner,
} from '../../../providers/itemIconGenerationWorkflow';

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

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
  return found;
}

async function clickAsync(container: HTMLElement, label: string) {
  const found = button(container, label);
  await act(async () => {
    found.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
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
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
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

    changeText(input(view.container, 'Item modifier Attack'), '3');
    expect(onChange).toHaveBeenLastCalledWith({
      items: [expect.objectContaining({ modifiers: expect.objectContaining({ attack: 3 }) })],
    });

    view.unmount();
  });

  it('filters large item lists without losing explicit selection', () => {
    const value: ItemDatabase = {
      items: Array.from({ length: 32 }, (_, index) => {
        const n = String(index + 1).padStart(2, '0');
        return {
          id: `item_${n}`,
          name: `Item ${n}`,
          description: '',
          type: 'consumable',
        };
      }),
    };
    const view = render(
      <ItemsEditor value={value} types={mergeDatabases(undefined).types} onChange={vi.fn()} />,
    );

    expect(view.container.textContent).toContain('Showing 32 of 32 items');

    changeText(input(view.container, 'Search items'), 'Item 29');

    expect(view.container.textContent).toContain('Showing 1 of 32 items');
    expect(button(view.container, 'Select item item_29')).toBeTruthy();
    expect(button(view.container, 'Clear item search').className).toContain('h-6');
    expect(view.container.textContent).toContain('Selected item_01 is hidden by this filter.');

    changeText(input(view.container, 'Search items'), 'missing');
    expect(view.container.textContent).toContain('No items match "missing"');

    act(() => {
      button(view.container, 'Clear item search').click();
    });
    expect(view.container.textContent).toContain('Showing 32 of 32 items');

    view.unmount();
  });

  it('blocks item deletes when references are present', () => {
    const onChange = vi.fn();
    const value: ItemDatabase = {
      items: [
        {
          id: 'potion',
          name: 'Potion',
          description: '',
          type: 'consumable',
        },
      ],
    };
    const view = render(
      <ItemsEditor
        value={value}
        types={mergeDatabases(undefined).types}
        referenceSources={{ potion: ['database/shops/general_store/listings/potion'] }}
        onChange={onChange}
      />,
    );

    expect(view.container.textContent).toContain('1 ref');

    act(() => {
      button(view.container, 'Delete item potion blocked by 1 reference').click();
    });

    expect(alert).toHaveBeenCalledWith(expect.stringContaining('database/shops/general_store/listings/potion'));
    expect(onChange).not.toHaveBeenCalled();

    view.unmount();
  });

  it('generates an item icon candidate and assigns it only after review', async () => {
    const generatedAsset: AssetCatalogEntry = {
      id: 'potion_icon',
      name: 'Potion Icon',
      kind: 'image',
      path: 'assets/generated/icons/potion_icon.png',
      source: 'generated',
      tags: ['generated', 'item-icon', 'item', 'ai-draft', 'pending-review'],
      width: 1024,
      height: 1024,
      generated: {
        prompt: 'offline icon prompt',
        tool: 'ai-item-icon-generation-workflow',
        createdAt: '2026-06-02T18:51:00.000Z',
        promptTemplateId: 'icon-item-v1',
        promptTemplateVersion: 1,
        promptTemplateKind: 'icon',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    };
    const candidate: ItemIconGenerationCandidate = {
      id: 'icon-gen-ui',
      reviewState: 'pending',
      owner: { kind: 'item', id: 'potion', name: 'Potion' },
      asset: generatedAsset,
      qaPreview: {
        assetRef: 'mock://generated/icon-gen-ui.png',
        width: 1024,
        height: 1024,
        providerFixture: 'offline-image',
      },
    };
    const iconGenerator: ItemIconGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const value: ItemDatabase = {
      items: [
        {
          id: 'potion',
          name: 'Potion',
          description: 'Heals HP',
          type: 'consumable',
        },
      ],
    };
    const view = render(
      <ItemsEditor
        value={value}
        types={mergeDatabases(undefined).types}
        assets={[]}
        iconGenerator={iconGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    act(() => button(view.container, 'Generate item icon').click());
    expect(view.container.querySelector('[aria-label="Item icon generation metadata preview"]')).not.toBeNull();
    changeText(input(view.container, 'Item icon subject'), 'red potion bottle with cork');

    await clickAsync(view.container, 'Run item icon generation');

    expect(iconGenerator).toHaveBeenCalledWith([], expect.objectContaining({
      owner: { kind: 'item', id: 'potion', name: 'Potion' },
      promptInputs: expect.objectContaining({
        subject: 'red potion bottle with cork',
      }),
    }));
    expect(view.container.querySelector('[aria-label="Generated item icon review"]')).not.toBeNull();
    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    await clickAsync(view.container, 'Accept generated item icon');

    expect(onAssetImported).toHaveBeenCalledWith(expect.objectContaining({
      id: 'potion_icon',
      source: 'generated',
      tags: expect.arrayContaining(['reviewed']),
    }));
    expect(onChange).toHaveBeenLastCalledWith({
      items: [
        expect.objectContaining({
          id: 'potion',
          iconAssetId: 'potion_icon',
        }),
      ],
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
      traits: ['sharp'],
    };
    const armor: ArmorData = {
      id: 'leather_armor',
      name: 'Leather Armor',
      description: '',
      armorTypeId: 'light',
      slot: 'body',
      price: 60,
      params: {},
      traits: ['guarded'],
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
    changeText(input(weaponView.container, 'Weapon modifier Attack'), '5');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ params: { attack: 5 } });
    changeText(input(weaponView.container, 'Weapon modifier Luck'), '2');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ params: { luck: 2 } });
    changeSelect(select(weaponView.container, 'Animation'), 'slash');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ animationId: 'slash' });
    changeText(input(weaponView.container, 'Weapon trait 1'), 'keen');
    expect(onWeaponChange).toHaveBeenLastCalledWith({ traits: ['keen'] });
    act(() => {
      button(weaponView.container, 'Add Weapon traits item').click();
    });
    expect(onWeaponChange).toHaveBeenLastCalledWith({ traits: ['sharp', 'new_trait'] });
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
    changeText(input(armorView.container, 'Armor modifier Defense'), '4');
    expect(onArmorChange).toHaveBeenLastCalledWith({ params: { defense: 4 } });
    changeText(input(armorView.container, 'Armor modifier Magic Defense'), '6');
    expect(onArmorChange).toHaveBeenLastCalledWith({ params: { magicDefense: 6 } });
    act(() => {
      button(armorView.container, 'Remove Armor traits item 1').click();
    });
    expect(onArmorChange).toHaveBeenLastCalledWith({ traits: [] });
    armorView.unmount();
  });

  it('generates a weapon icon candidate and assigns it only after review', async () => {
    const generatedAsset: AssetCatalogEntry = {
      id: 'iron_sword_icon',
      name: 'Iron Sword Icon',
      kind: 'image',
      path: 'assets/generated/icons/iron_sword_icon.png',
      source: 'generated',
      tags: ['generated', 'item-icon', 'weapon', 'ai-draft', 'pending-review'],
      width: 1024,
      height: 1024,
      generated: {
        prompt: 'offline weapon icon prompt',
        tool: 'ai-item-icon-generation-workflow',
        createdAt: '2026-06-02T18:52:00.000Z',
        promptTemplateId: 'icon-item-v1',
        promptTemplateVersion: 1,
        promptTemplateKind: 'icon',
        providerId: 'local',
        modelId: 'offline-image-mock',
      },
    };
    const candidate: ItemIconGenerationCandidate = {
      id: 'icon-gen-weapon-ui',
      reviewState: 'pending',
      owner: { kind: 'weapon', id: 'iron_sword', name: 'Iron Sword' },
      asset: generatedAsset,
      qaPreview: {
        assetRef: 'mock://generated/icon-gen-weapon-ui.png',
        width: 1024,
        height: 1024,
        providerFixture: 'offline-image',
      },
    };
    const iconGenerator: ItemIconGenerationRunner = vi.fn(async () => ({
      success: true,
      candidate,
    }));
    const onAssetImported = vi.fn();
    const onChange = vi.fn();
    const weapon: WeaponData = {
      id: 'iron_sword',
      name: 'Iron Sword',
      description: 'Starter blade',
      weaponTypeId: 'sword',
      price: 80,
    };
    const view = render(
      <EquipmentEditor
        kind="weapon"
        entry={weapon}
        types={mergeDatabases(undefined).types}
        animationOptions={[]}
        idField={<span />}
        assets={[]}
        iconGenerator={iconGenerator}
        onAssetImported={onAssetImported}
        onChange={onChange}
      />,
    );

    act(() => button(view.container, 'Generate weapon icon').click());
    changeText(input(view.container, 'Weapon icon subject'), 'short iron sword icon');

    await clickAsync(view.container, 'Run weapon icon generation');

    expect(iconGenerator).toHaveBeenCalledWith([], expect.objectContaining({
      owner: { kind: 'weapon', id: 'iron_sword', name: 'Iron Sword' },
      promptInputs: expect.objectContaining({
        subject: 'short iron sword icon',
      }),
    }));
    expect(onAssetImported).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    await clickAsync(view.container, 'Accept generated weapon icon');

    expect(onAssetImported).toHaveBeenCalledWith(expect.objectContaining({
      id: 'iron_sword_icon',
      tags: expect.arrayContaining(['reviewed']),
    }));
    expect(onChange).toHaveBeenLastCalledWith({ iconAssetId: 'iron_sword_icon' });

    view.unmount();
  });

  it('edits state priority, battle-end removal, restriction, and traits', () => {
    const onChange = vi.fn();
    const state: StateData = {
      id: 'poison',
      name: 'Poison',
      priority: 50,
      removeAtBattleEnd: false,
      restriction: 'none',
      traits: ['damageOverTime'],
    };
    const view = render(<StatesEditor entry={state} idField={<span />} onChange={onChange} />);

    changeText(input(view.container, 'State priority'), '80');
    expect(onChange).toHaveBeenLastCalledWith({ priority: 80 });
    changeSelect(select(view.container, 'Remove at battle end'), 'true');
    expect(onChange).toHaveBeenLastCalledWith({ removeAtBattleEnd: true });
    changeSelect(select(view.container, 'Restriction'), 'cannotMove');
    expect(onChange).toHaveBeenLastCalledWith({ restriction: 'cannotMove' });
    changeText(input(view.container, 'State trait 1'), 'venom');
    expect(onChange).toHaveBeenLastCalledWith({ traits: ['venom'] });
    act(() => {
      button(view.container, 'Add State traits item').click();
    });
    expect(onChange).toHaveBeenLastCalledWith({ traits: ['damageOverTime', 'new_trait'] });

    view.unmount();
  });
});
