import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('runtime smoke script', () => {
  it('keeps the native smoke wired to Phase 10 MVP feature evidence', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/dev/smoke-runtime.ps1'), 'utf8');
    const wrapper = readFileSync(join(process.cwd(), 'scripts/dev/smoke-runtime.bat'), 'utf8');

    for (const expected of [
      'RUNTIME FEATURE SMOKE SHOTS',
      'phase10-mvp',
      'phase10-01-route-coach-dialogue.bmp',
      'phase10-02-event-route-after.bmp',
      'phase10-03-foreground-occlusion.bmp',
      '"commandType":"showChoices"',
      '"result":"selected=0"',
      '"commandType":"setMovementRoute"',
      'target=event',
      'Audio requested: chest_open',
      'pluginCommand debug.log',
      'Smoke shots complete',
      '-WindowStyle Hidden',
    ]) {
      expect(script).toContain(expected);
    }

    expect(wrapper).toContain('exit /b %ERRORLEVEL%');
  });
});
