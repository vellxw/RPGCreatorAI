import type { FullProjectState, PlaytestSessionRequest } from '../adapters/types';
import type { EditorState } from '../stores/editorStore';
import type { EventPage, GameEvent, ValidationMessage } from '../types/project';
import { playtestModeLabel } from './playtestMode';

export interface PlaytestLaunchPlan {
  modeLabel: string;
  targetLabel: string;
  spawnDescription: string;
  warnings?: string[];
  eventDebugContext?: {
    mapId: string;
    eventId: string;
  };
  request?: PlaytestSessionRequest;
  blocker?: string;
}

function mapLabel(state: FullProjectState, mapId: string): string {
  const map = state.maps[mapId];
  return `${map?.name ?? mapId} (${mapId})`;
}

function pageHasConditions(page: EventPage): boolean {
  return (
    Object.keys(page.conditions.switches ?? {}).length > 0 ||
    Object.keys(page.conditions.selfSwitches ?? {}).length > 0 ||
    (page.conditions.variables ?? []).length > 0
  );
}

function eventCommandCount(event: GameEvent): number {
  return event.commands.length + (event.pages ?? []).reduce((sum, page) => sum + page.commands.length, 0);
}

function selectedEventWarnings(event: GameEvent): string[] {
  const warnings: string[] = [];
  if ((event.pages ?? []).length > 0 && (event.pages ?? []).every(pageHasConditions)) {
    warnings.push(
      'All selected event pages have conditions; runtime may keep the event inactive until switches, variables, or self switches match.',
    );
  }
  if (eventCommandCount(event) === 0) {
    warnings.push('Selected event has no commands; Event Trace may stay empty until commands are added.');
  }
  return warnings;
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
        warnings: [],
        blocker: `Project Start playtest cannot find start map '${startMapId}'.`,
      };
    }
    const start = projectState.project.startPosition;
    return {
      modeLabel,
      targetLabel: mapLabel(projectState, startMapId),
      spawnDescription: `Spawns at authored project start ${start.x},${start.y},${start.direction}.`,
      warnings: [],
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
        warnings: [],
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
      warnings: [],
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
      warnings: [],
      blocker: 'Selected Event playtest needs a selected event on a loaded map.',
    };
  }
  const freshEvent = projectState.maps[mapId].events.find(candidate => candidate.id === event.id);
  if (!freshEvent) {
    return {
      modeLabel,
      targetLabel: mapLabel(projectState, mapId),
      spawnDescription: '',
      warnings: [],
      blocker: `Selected Event playtest cannot find event '${event.id}' on map '${mapId}'.`,
    };
  }
  return {
    modeLabel,
    targetLabel: `${freshEvent.id} on ${mapLabel(projectState, mapId)}`,
    spawnDescription: `Spawns at selected event ${freshEvent.x},${freshEvent.y},down.`,
    warnings: selectedEventWarnings(freshEvent),
    eventDebugContext: { mapId, eventId: freshEvent.id },
    request: {
      mode: 'selectedEvent',
      currentMapId: editorState.selectedMapId,
      selectedEventMapId: mapId,
      selectedEventId: freshEvent.id,
    },
  };
}

export function pickLaunchValidationError(
  plan: PlaytestLaunchPlan,
  errors: ValidationMessage[],
): ValidationMessage | undefined {
  const context = plan.eventDebugContext;
  if (!context) return errors[0];

  const sourceFragment = `${context.mapId}/${context.eventId}`;
  return errors.find(error =>
    error.source?.includes(sourceFragment) ||
    error.message.includes(`Event "${context.eventId}"`),
  ) ?? errors[0];
}
