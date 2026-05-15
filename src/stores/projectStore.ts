import { createContext, useContext } from 'react';
import type { ProjectData, MapData, ItemDatabase, GameEvent, EventCommand } from '../types/project';

// Import actual project data
import projectJson from '../../data/project.json';
import townJson from '../../data/maps/town.json';
import houseJson from '../../data/maps/house.json';
import itemsJson from '../../data/database/items.json';

export interface ProjectState {
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
}

export function loadProjectData(): ProjectState {
  return {
    project: projectJson as ProjectData,
    maps: {
      town: townJson as unknown as MapData,
      house: houseJson as unknown as MapData,
    },
    items: itemsJson as ItemDatabase,
  };
}

export function getAllEvents(state: ProjectState): Array<{ mapId: string; mapName: string; event: GameEvent }> {
  const result: Array<{ mapId: string; mapName: string; event: GameEvent }> = [];
  for (const [mapId, map] of Object.entries(state.maps)) {
    for (const event of map.events) {
      result.push({ mapId, mapName: map.name, event });
    }
  }
  return result;
}

export function getEventsByMap(state: ProjectState): Record<string, { mapName: string; events: GameEvent[] }> {
  const result: Record<string, { mapName: string; events: GameEvent[] }> = {};
  for (const [mapId, map] of Object.entries(state.maps)) {
    result[mapId] = { mapName: map.name, events: map.events };
  }
  return result;
}

export function flattenCommands(commands: EventCommand[]): Array<{ command: EventCommand; depth: number }> {
  const result: Array<{ command: EventCommand; depth: number }> = [];
  function walk(cmds: EventCommand[], depth: number) {
    for (const cmd of cmds) {
      result.push({ command: cmd, depth });
      if (cmd.type === 'ifFlag') {
        walk(cmd.then, depth + 1);
        if (cmd.else.length > 0) {
          walk(cmd.else, depth + 1);
        }
      }
    }
  }
  walk(commands, 0);
  return result;
}

export const ProjectContext = createContext<ProjectState | null>(null);

export function useProject(): ProjectState {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectContext');
  return ctx;
}
