import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeDatabases } from '../../../adapters/defaultDatabases';
import { TermsEditor } from '../TermsEditor';
import { TypesEditor } from '../TypesEditor';
import type { TermsDatabaseData, TypesDatabaseData } from '../../../types/project';

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

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = container.querySelector(`button[aria-label="${label}"]`);
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button: ${label}`);
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

function click(el: HTMLButtonElement) {
  act(() => {
    el.click();
  });
}

describe('system types and terms database editors', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('edits named type tables and surfaces blank labels', () => {
    const onChange = vi.fn();
    const types: TypesDatabaseData = {
      ...mergeDatabases(undefined).types,
      weaponTypes: [{ id: 'sword', name: 'Sword' }],
      armorTypes: [{ id: 'light', name: '' }],
      skillTypes: [],
    };
    const view = render(<TypesEditor types={types} onChange={onChange} />);

    changeText(input(view.container, 'Weapon Types name 1'), 'Blade');
    expect(onChange).toHaveBeenLastCalledWith({
      ...types,
      weaponTypes: [{ id: 'sword', name: 'Blade' }],
    });

    click(button(view.container, 'Add Skill Types item'));
    expect(onChange).toHaveBeenLastCalledWith({
      ...types,
      skillTypes: [{ id: 'skill_type_1', name: 'Skill Type 1' }],
    });
    expect(view.container.textContent).toContain('Missing label for Armor Types entry "light"');

    view.unmount();
  });

  it('edits required terminology and warns when a required label is blank', () => {
    const onChange = vi.fn();
    const terms: TermsDatabaseData = {
      ...mergeDatabases(undefined).terms,
      currencyUnit: 'Credits',
      stats: {
        ...mergeDatabases(undefined).terms.stats,
        attack: '',
      },
    };
    const view = render(<TermsEditor terms={terms} onChange={onChange} />);

    changeText(input(view.container, 'Currency unit'), 'Gil');
    expect(onChange).toHaveBeenLastCalledWith({
      ...terms,
      currencyUnit: 'Gil',
    });

    changeText(input(view.container, 'Stats attack term'), 'Power');
    expect(onChange).toHaveBeenLastCalledWith({
      ...terms,
      stats: {
        ...terms.stats,
        attack: 'Power',
      },
    });
    expect(view.container.textContent).toContain('Missing required term: stats.attack');

    view.unmount();
  });
});
