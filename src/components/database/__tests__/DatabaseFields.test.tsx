import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  CheckboxField,
  IdField,
  NumberField,
  SelectField,
  TextareaField,
  TextField,
} from '../DatabaseFields';
import { ReferenceSelect } from '../ReferenceSelect';
import { ArrayFieldEditor } from '../ArrayFieldEditor';

interface RenderResult {
  container: HTMLDivElement;
  unmount(): void;
}

function render(ui: React.ReactNode): RenderResult {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const found = container.querySelector(`input[aria-label="${label}"]`);
  if (!(found instanceof HTMLInputElement)) {
    throw new Error(`Missing input: ${label}`);
  }
  return found;
}

function select(container: HTMLElement, label: string): HTMLSelectElement {
  const found = container.querySelector(`select[aria-label="${label}"]`);
  if (!(found instanceof HTMLSelectElement)) {
    throw new Error(`Missing select: ${label}`);
  }
  return found;
}

function textarea(container: HTMLElement, label: string): HTMLTextAreaElement {
  const found = container.querySelector(`textarea[aria-label="${label}"]`);
  if (!(found instanceof HTMLTextAreaElement)) {
    throw new Error(`Missing textarea: ${label}`);
  }
  return found;
}

function changeText(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(el, 'value')?.set;
    const prototype = Object.getPrototypeOf(el);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
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

describe('Database field primitives', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders shared scalar fields and normalizes typed changes', () => {
    const onText = vi.fn();
    const onId = vi.fn();
    const onNumber = vi.fn();
    const onCheckbox = vi.fn();
    const onSelect = vi.fn();
    const onTextarea = vi.fn();

    const view = render(
      <div>
        <TextField label="Name" value="Hero" onChange={onText} />
        <IdField label="ID" value="actor_1" onChange={onId} />
        <NumberField label="Level" value={3} onChange={onNumber} />
        <CheckboxField label="Remove at battle end" checked={false} onChange={onCheckbox} />
        <SelectField
          label="Target"
          value="singleEnemy"
          options={[
            { value: 'singleEnemy', label: 'Single enemy' },
            { value: 'allEnemies', label: 'All enemies' },
          ]}
          onChange={onSelect}
        />
        <TextareaField label="Description" value="Old text" onChange={onTextarea} />
      </div>,
    );

    changeText(input(view.container, 'Name'), 'Mage');
    changeText(input(view.container, 'ID'), 'actor_mage');
    changeText(input(view.container, 'Level'), '12');
    act(() => {
      input(view.container, 'Remove at battle end').click();
    });
    changeSelect(select(view.container, 'Target'), 'allEnemies');
    changeText(textarea(view.container, 'Description'), 'New text');

    expect(onText).toHaveBeenCalledWith('Mage');
    expect(onId).toHaveBeenCalledWith('actor_mage');
    expect(onNumber).toHaveBeenCalledWith(12);
    expect(onCheckbox).toHaveBeenCalledWith(true);
    expect(onSelect).toHaveBeenCalledWith('allEnemies');
    expect(onTextarea).toHaveBeenCalledWith('New text');

    view.unmount();
  });

  it('renders reference options with an explicit empty label', () => {
    const onChange = vi.fn();
    const view = render(
      <ReferenceSelect
        label="Actor"
        value=""
        emptyLabel="(no actor)"
        options={[
          { value: 'actor_1', label: 'Hero' },
          { value: 'actor_2', label: 'Mage' },
        ]}
        onChange={onChange}
      />,
    );

    const actorSelect = select(view.container, 'Actor');
    expect([...actorSelect.options].map(option => option.textContent)).toEqual([
      '(no actor)',
      'Hero',
      'Mage',
    ]);

    changeSelect(actorSelect, 'actor_2');

    expect(onChange).toHaveBeenCalledWith('actor_2');
    view.unmount();
  });

  it('edits array entries through add, remove, move, and item update controls', () => {
    const onChange = vi.fn();
    const view = render(
      <ArrayFieldEditor
        label="Traits"
        values={['fire', 'ice']}
        createValue={() => 'new_trait'}
        onChange={onChange}
        renderItem={({ value, index, onChange: onItemChange }) => (
          <TextField
            label={`Trait ${index + 1}`}
            value={value}
            onChange={onItemChange}
          />
        )}
      />,
    );

    const buttons = (label: string) =>
      view.container.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

    act(() => {
      buttons('Move Traits item 1 down').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(['ice', 'fire']);

    act(() => {
      buttons('Remove Traits item 2').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(['fire']);

    act(() => {
      buttons('Add Traits item').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(['fire', 'ice', 'new_trait']);

    changeText(input(view.container, 'Trait 1'), 'water');
    expect(onChange).toHaveBeenLastCalledWith(['water', 'ice']);

    view.unmount();
  });
});
