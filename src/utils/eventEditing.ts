import type { GameEvent, MapData } from '../types/project';

export interface DuplicatePlacement {
  newId: string;
  x: number;
  y: number;
}

export function findDuplicatePlacement(map: MapData, event: GameEvent): DuplicatePlacement {
  const siblingIds = new Set(map.events.map(candidate => candidate.id));
  let copyNumber = 1;
  let newId = `${event.id}_copy`;
  while (siblingIds.has(newId)) {
    copyNumber += 1;
    newId = `${event.id}_copy${copyNumber}`;
  }

  const occupiedCells = new Set(map.events.map(candidate => `${candidate.x},${candidate.y}`));
  const totalCells = map.width * map.height;
  const sourceIndex = event.y * map.width + event.x;

  for (let offset = 1; offset < totalCells; offset += 1) {
    const index = (sourceIndex + offset) % totalCells;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    if (!occupiedCells.has(`${x},${y}`)) {
      return { newId, x, y };
    }
  }

  return { newId, x: event.x, y: event.y };
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.getAttribute('contenteditable') === 'true' ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
