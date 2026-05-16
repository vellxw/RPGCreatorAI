// Cross-project validation that spans multiple maps and the item database.

import type {
  EventCommand,
  GameEvent,
  ItemDatabase,
  MapData,
  ProjectData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { validateMap } from './validateMap';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];
const VALID_COMMAND_TYPES = ['showText', 'setFlag', 'ifFlag', 'addItem', 'transferMap', 'playSound'];

export interface ValidationReport {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

export function validateProject(state: FullProjectState): ValidationReport {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  errors.push(...validateProjectMeta(state.project, state.maps));

  const itemIds = new Set(state.items.items.map(i => i.id));
  const mapIds = Object.keys(state.maps);

  for (const [mapId, map] of Object.entries(state.maps)) {
    const mapMessages = validateMap(map, mapIds);
    for (const m of mapMessages) {
      if (m.level === 'error') errors.push(m);
      else if (m.level === 'warning') warnings.push(m);
    }
    errors.push(...validateUniqueEventIds(map));
    errors.push(...validateItemReferencesInMap(map, itemIds));
    errors.push(...validateTriggerAndCommandTypesInMap(map));
    // Cross-map: transfer targets
    errors.push(...validateTransferTargetsInMap(map, mapIds));

    void mapId; // silence unused if reordered
  }

  return { errors, warnings };
}

function validateProjectMeta(project: ProjectData, maps: Record<string, MapData>): ValidationMessage[] {
  const out: ValidationMessage[] = [];

  if (!project.startMapId || !maps[project.startMapId]) {
    out.push({
      level: 'error',
      message: `Project startMapId "${project.startMapId}" does not exist`,
      source: 'project',
    });
    return out;
  }

  const startMap = maps[project.startMapId];
  const { x, y } = project.startPosition;
  if (x < 0 || x >= startMap.width || y < 0 || y >= startMap.height) {
    out.push({
      level: 'error',
      message: `Project startPosition (${x}, ${y}) is out of bounds for map "${project.startMapId}"`,
      source: 'project',
    });
  }

  return out;
}

export function validateUniqueEventIds(map: MapData): ValidationMessage[] {
  const seen = new Map<string, number>();
  for (const event of map.events) {
    seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
  }
  const out: ValidationMessage[] = [];
  for (const [id, count] of seen) {
    if (count > 1) {
      out.push({
        level: 'error',
        message: `Map "${map.id}" has ${count} events with duplicate id "${id}"`,
        source: `${map.id}/${id}`,
      });
    }
  }
  return out;
}

export function validateItemReferencesInMap(map: MapData, itemIds: Set<string>): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    walkCommands(event.commands, cmd => {
      if (cmd.type === 'addItem' && !itemIds.has(cmd.itemId)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" addItem references unknown item "${cmd.itemId}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    });
  }
  return out;
}

export function validateTriggerAndCommandTypesInMap(map: MapData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    if (!VALID_TRIGGERS.includes(event.trigger)) {
      out.push({
        level: 'error',
        message: `Event "${event.id}" has invalid trigger "${event.trigger}"`,
        source: `${map.id}/${event.id}`,
      });
    }
    walkCommands(event.commands, cmd => {
      if (!VALID_COMMAND_TYPES.includes(cmd.type)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" has unknown command type "${cmd.type}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    });
  }
  return out;
}

export function validateTransferTargetsInMap(map: MapData, mapIds: string[]): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    walkCommands(event.commands, cmd => {
      if (cmd.type === 'transferMap') {
        if (!mapIds.includes(cmd.mapId)) {
          out.push({
            level: 'error',
            message: `Event "${event.id}" transfers to unknown map "${cmd.mapId}"`,
            source: `${map.id}/${event.id}`,
          });
        }
      }
    });
  }
  return out;
}

function walkCommands(commands: EventCommand[], visit: (cmd: EventCommand) => void): void {
  for (const cmd of commands) {
    visit(cmd);
    if (cmd.type === 'ifFlag') {
      walkCommands(cmd.then, visit);
      walkCommands(cmd.else, visit);
    }
  }
}

export function eventPositionInBounds(event: GameEvent, map: MapData): boolean {
  return event.x >= 0 && event.x < map.width && event.y >= 0 && event.y < map.height;
}
