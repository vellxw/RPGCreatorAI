export const STARTUP_PHASE_SEQUENCE = ['app-shell', 'project-data', 'workspace-ready'] as const;

export type StartupPhaseId = (typeof STARTUP_PHASE_SEQUENCE)[number];

export interface StartupPhase {
  id: StartupPhaseId;
  title: string;
  detail: string;
  progress: number;
}

const STARTUP_PHASES: Record<StartupPhaseId, StartupPhase> = {
  'app-shell': {
    id: 'app-shell',
    title: 'Preparing your workspace',
    detail: 'Loading project data and editor state.',
    progress: 20,
  },
  'project-data': {
    id: 'project-data',
    title: 'Preparing your workspace',
    detail: 'Reading project files and editor state.',
    progress: 58,
  },
  'workspace-ready': {
    id: 'workspace-ready',
    title: 'Preparing your workspace',
    detail: 'Opening the editor workspace.',
    progress: 88,
  },
};

export function getStartupPhase(phase: StartupPhaseId | string | null | undefined): StartupPhase {
  if (phase && phase in STARTUP_PHASES) {
    return STARTUP_PHASES[phase as StartupPhaseId];
  }
  return STARTUP_PHASES['app-shell'];
}

export function startupPhaseIndex(phase: StartupPhaseId): number {
  return STARTUP_PHASE_SEQUENCE.indexOf(phase);
}
