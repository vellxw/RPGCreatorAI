import { describe, expect, it } from 'vitest';
import {
  projectStartupRecovery,
  recentProjectStartupRecovery,
} from '../startupRecovery';

describe('startup recovery states', () => {
  it('turns missing project data into clear local recovery options', () => {
    const recovery = projectStartupRecovery(
      'Open',
      'selected folder does not contain data/project.json',
    );

    expect(recovery.title).toBe('Open project failed');
    expect(recovery.detail).toContain('does not look like an RPGCreatorAI project');
    expect(recovery.detail).toContain('data/project.json');
    expect(recovery.options).toEqual([
      'Open Project Folder',
      'Create Project',
      'Import Project Bundle',
      'Use bundled sample',
    ]);
  });

  it('keeps invalid project data recoverable without terminal language', () => {
    const recovery = projectStartupRecovery('Open', 'Unexpected token } in JSON at position 42');

    expect(recovery.title).toBe('Open project failed');
    expect(recovery.detail).toContain('project data could not be read');
    expect(recovery.detail).not.toContain('Unexpected token');
    expect(recovery.options).toContain('Open Project Folder');
    expect(recovery.options).toContain('Use bundled sample');
  });

  it('names the missing recent project path and keeps manual choices available', () => {
    const recovery = recentProjectStartupRecovery(
      'C:\\Games\\Missing Quest',
      'selected folder does not contain data/project.json',
    );

    expect(recovery.title).toBe('Recent project could not be restored');
    expect(recovery.detail).toContain('C:\\Games\\Missing Quest');
    expect(recovery.detail).toContain('Choose another project folder');
    expect(recovery.options).toContain('Create Project');
  });
});
