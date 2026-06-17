export type FirstRunStarterPath = 'blank' | 'town-template' | 'bundled-sample';

export interface FirstRunPath {
  id: FirstRunStarterPath;
  title: string;
  summary: string;
  bullets: ReadonlyArray<string>;
  requiresDesktop: boolean;
  defaultTitle: string;
}

export const FIRST_RUN_PATHS: ReadonlyArray<FirstRunPath> = Object.freeze([
  {
    id: 'blank',
    title: 'Start with a blank project',
    summary: 'A single empty map and a default database so you can build everything yourself.',
    bullets: [
      'One starter map (16×9) named "town".',
      'Default actors, items, classes, skills, enemies, and animations.',
      'No provider setup required — works fully offline.',
    ],
    requiresDesktop: false,
    defaultTitle: 'Untitled RPG',
  },
  {
    id: 'town-template',
    title: 'Use the town template',
    summary: 'A pre-laid-out town square map with sample events and a hero NPC.',
    bullets: [
      'Town street scene with tileset references wired.',
      'Two example events: sign post and hero NPC.',
      'No provider setup required — works fully offline.',
    ],
    requiresDesktop: false,
    defaultTitle: 'My Town RPG',
  },
  {
    id: 'bundled-sample',
    title: 'Open the bundled sample (My First RPG)',
    summary: 'A two-map project (town + house) and a populated database to explore.',
    bullets: [
      'Two pre-authored maps with transitions and events.',
      'Populated actor, item, skill, and animation databases.',
      'No provider setup required — works fully offline.',
    ],
    requiresDesktop: false,
    defaultTitle: 'My First RPG',
  },
]);

export function getFirstRunPath(id: FirstRunStarterPath): FirstRunPath {
  const path = FIRST_RUN_PATHS.find(candidate => candidate.id === id);
  if (!path) {
    const fallback = FIRST_RUN_PATHS[0];
    return fallback;
  }
  return path;
}

export interface FirstRunPreferences {
  version: 1;
  hasCompletedFirstRun: boolean;
  selectedPath: FirstRunStarterPath | null;
  completedAt?: string;
}

export const DEFAULT_FIRST_RUN_PREFERENCES: FirstRunPreferences = Object.freeze({
  version: 1,
  hasCompletedFirstRun: false,
  selectedPath: null,
});

export interface FirstRunChangeError {
  reason: 'unknown-path' | 'persistence-failed';
  message: string;
}
