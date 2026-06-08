import { describe, expect, it } from 'vitest';
import {
  STARTUP_PHASE_SEQUENCE,
  getStartupPhase,
  startupPhaseIndex,
} from '../startupPhases';

describe('startup phase model', () => {
  it('keeps phase order deterministic and tied to local startup work', () => {
    expect(STARTUP_PHASE_SEQUENCE).toEqual(['app-shell', 'project-data', 'workspace-ready']);
    expect(STARTUP_PHASE_SEQUENCE.map(phase => getStartupPhase(phase).progress)).toEqual([20, 58, 88]);
    expect(startupPhaseIndex('app-shell')).toBeLessThan(startupPhaseIndex('project-data'));
    expect(startupPhaseIndex('project-data')).toBeLessThan(startupPhaseIndex('workspace-ready'));
  });

  it('falls back to app-shell metadata for unknown phase input', () => {
    const phase = getStartupPhase('missing-phase');

    expect(phase.id).toBe('app-shell');
    expect(phase.title).toBe('Preparing your workspace');
    expect(phase.detail).toBe('Loading project data and editor state.');
  });
});
