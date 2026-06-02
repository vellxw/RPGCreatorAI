import type { PlaytestSessionMode } from '../adapters/types';

export function playtestModeLabel(mode: PlaytestSessionMode): string {
  switch (mode) {
    case 'currentMap':
      return 'Current Map';
    case 'selectedEvent':
      return 'Selected Event';
    case 'projectStart':
    default:
      return 'Project Start';
  }
}
