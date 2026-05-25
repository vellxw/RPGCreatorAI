export interface CommandRangeSelectionInput {
  anchorPath: number[] | null;
  targetPath: number[];
  commandPaths: number[][];
  extendRange: boolean;
}

export interface CommandRangeSelection {
  paths: number[][];
  anchorPath: number[];
}

export function commandPathKey(path: number[]): string {
  return path.join('.');
}

export function sameCommandPath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function commandPathParent(path: number[]): number[] {
  return path.slice(0, -1);
}

export function resolveCommandRangeSelection(input: CommandRangeSelectionInput): CommandRangeSelection {
  const targetPath = input.targetPath.slice();
  if (!input.extendRange || !input.anchorPath) {
    return { paths: [targetPath], anchorPath: targetPath };
  }

  const anchorParent = commandPathParent(input.anchorPath);
  const targetParent = commandPathParent(targetPath);
  if (!sameCommandPath(anchorParent, targetParent)) {
    return { paths: [targetPath], anchorPath: targetPath };
  }

  const siblingPaths = input.commandPaths.filter(path => sameCommandPath(commandPathParent(path), anchorParent));
  const anchorIndex = siblingPaths.findIndex(path => sameCommandPath(path, input.anchorPath ?? []));
  const targetIndex = siblingPaths.findIndex(path => sameCommandPath(path, targetPath));
  if (anchorIndex === -1 || targetIndex === -1) {
    return { paths: [targetPath], anchorPath: targetPath };
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return {
    paths: siblingPaths.slice(start, end + 1).map(path => path.slice()),
    anchorPath: input.anchorPath.slice(),
  };
}

export function isCommandStackTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return target.type !== 'checkbox' && target.type !== 'radio';
  }
  return false;
}
