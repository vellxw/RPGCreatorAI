import { describe, expect, it } from 'vitest';
import {
  isCommandStackTextEditingTarget,
  resolveCommandRangeSelection,
} from '../commandSelection';

describe('commandSelection', () => {
  const commandPaths = [[0], [1], [1, 0, 0], [1, 0, 1], [1, 1, 0], [2]];

  it('selects an inclusive range only inside the same command list', () => {
    const result = resolveCommandRangeSelection({
      anchorPath: [1, 0, 0],
      targetPath: [1, 0, 1],
      commandPaths,
      extendRange: true,
    });

    expect(result.paths).toEqual([[1, 0, 0], [1, 0, 1]]);
    expect(result.anchorPath).toEqual([1, 0, 0]);
  });

  it('resets the range anchor after a cross-list shift selection fallback', () => {
    const crossList = resolveCommandRangeSelection({
      anchorPath: [0],
      targetPath: [1, 0, 0],
      commandPaths,
      extendRange: true,
    });
    expect(crossList.paths).toEqual([[1, 0, 0]]);
    expect(crossList.anchorPath).toEqual([1, 0, 0]);

    const nestedRange = resolveCommandRangeSelection({
      anchorPath: crossList.anchorPath,
      targetPath: [1, 0, 1],
      commandPaths,
      extendRange: true,
    });
    expect(nestedRange.paths).toEqual([[1, 0, 0], [1, 0, 1]]);
    expect(nestedRange.anchorPath).toEqual([1, 0, 0]);
  });

  it('allows delete shortcuts from selection checkboxes but shields text editors', () => {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const radio = document.createElement('input');
    radio.type = 'radio';
    const textInput = document.createElement('input');
    textInput.type = 'text';
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(isCommandStackTextEditingTarget(checkbox)).toBe(false);
    expect(isCommandStackTextEditingTarget(radio)).toBe(false);
    expect(isCommandStackTextEditingTarget(textInput)).toBe(true);
    expect(isCommandStackTextEditingTarget(textarea)).toBe(true);
    expect(isCommandStackTextEditingTarget(select)).toBe(true);
    expect(isCommandStackTextEditingTarget(editable)).toBe(true);
  });
});
