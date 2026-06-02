import type { FullProjectState, PlaytestSessionRequest } from '../adapters/types';
import type { EditorState } from '../stores/editorStore';
import { playtestModeLabel } from './playtestMode';

export interface PlaytestLaunchPlan {
  modeLabel: string;
  targetLabel: string;
  spawnDescription: string;
  request?: PlaytestSessionRequest;
  blocker?: string;
}

function mapLabel(state: FullProjectState, mapId: string): string {
  const map = state.maps[mapId];
  return `${map?.name ?? mapId} (${mapId})`;
}

export function buildPlaytestLaunchPlan(
  editorState: EditorState,
  projectState: FullProjectState,
): PlaytestLaunchPlan {
  const modeLabel = playtestModeLabel(editorState.playtestMode);

  if (editorState.playtestMode === 'projectStart') {
    const startMapId = projectState.project.startMapId;
    if (!projectState.maps[startMapId]) {
      return {
        modeLabel,
        targetLabel: startMapId,
        spawnDescription: '',
        blocker: `Project Start playtest cannot find start map '${startMapId}'.`,
      };
    }
    const start = projectState.project.startPosition;
    return {
      modeLabel,
      targetLabel: mapLabel(projectState, startMapId),
      spawnDescription: `Spawns at authored project start ${start.x},${start.y},${start.direction}.`,
      request: { mode: 'projectStart' },
    };
  }

  if (editorState.playtestMode === 'currentMap') {
    const mapId = editorState.selectedMapId;
    if (!mapId || !projectState.maps[mapId]) {
      return {
        modeLabel,
        targetLabel: mapId || 'No map selected',
        spawnDescription: '',
        blocker: `Current Map playtest cannot find selected map '${mapId || 'none'}'. Select a loaded map before launching.`,
      };
    }
    const start = projectState.project.startPosition;
    const usesAuthoredStart = mapId === projectState.project.startMapId;
    return {
      modeLabel,
      targetLabel: mapLabel(projectState, mapId),
      spawnDescription: usesAuthoredStart
        ? `Uses authored project start ${start.x},${start.y},${start.direction}.`
        : 'Spawns at 0,0,down for map iteration without changing project start data.',
      request: {
        mode: 'currentMap',
        currentMapId: mapId,
      },
    };
  }

  const mapId = editorState.selectedEventMapId ?? editorState.selectedMapId;
  const event = editorState.selectedEvent;
  if (!event || !mapId || !projectState.maps[mapId]) {
    return {
      modeLabel,
      targetLabel: mapId || 'No event map selected',
      spawnDescription: '',
      blocker: 'Selected Event playtest needs a selected event on a loaded map.',
    };
  }
  const mapHasEvent = projectState.maps[mapId].events.some(candidate => candidate.id === event.id);
  if (!mapHasEvent) {
    return {
      modeLabel,
      targetLabel: mapLabel(projectState, mapId),
      spawnDescription: '',
      blocker: `Selected Event playtest cannot find event '${event.id}' on map '${mapId}'.`,
    };
  }
  return {
    modeLabel,
    targetLabel: `${event.id} on ${mapLabel(projectState, mapId)}`,
    spawnDescription: `Spawns at selected event ${event.x},${event.y},down.`,
    request: {
      mode: 'selectedEvent',
      currentMapId: editorState.selectedMapId,
      selectedEventMapId: mapId,
      selectedEventId: event.id,
    },
  };
}
