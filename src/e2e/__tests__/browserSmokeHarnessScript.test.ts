import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('CP-108 browser smoke harness script', () => {
  it('provides a runnable optional Playwright CLI harness with explicit skip semantics', () => {
    const scriptPath = join(process.cwd(), 'scripts/dev/smoke-browser-editor.ps1');
    const wrapperPath = join(process.cwd(), 'scripts/dev/smoke-browser-editor.bat');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(wrapperPath)).toBe(true);

    const script = readFileSync(scriptPath, 'utf8');
    const wrapper = readFileSync(wrapperPath, 'utf8');
    const docs = readFileSync(join(process.cwd(), 'docs/BROWSER_SMOKE_HARNESS.md'), 'utf8');

    for (const expected of [
      'BROWSER SMOKE START',
      'BROWSER SMOKE PASSED',
      'BROWSER SMOKE SKIPPED',
      '@playwright/cli',
      'playwright-cli',
      '00-static-splash.html',
      'data-rpg-splash-shell',
      'Preparing your workspace',
      'Import Project Bundle',
      'Create Browser Project',
      'Browser mode cannot open folders',
      'Use My First RPG',
      'Validate',
      'Save',
      'Playtest',
      'output/playwright/cp108',
      'Start-Process',
      '-WindowStyle Hidden',
      'Stop-HarnessProcessTree',
      'Win32_Process',
      'Get-ChildItem -LiteralPath $artifactRoot',
      'Copy-Item -Destination $outputRoot',
      'console',
      'screenshot',
    ]) {
      expect(script).toContain(expected);
    }

    expect(wrapper).toContain('-ExecutionPolicy Bypass');
    expect(wrapper).toContain('smoke-browser-editor.ps1');
    expect(wrapper).toContain('exit /b %ERRORLEVEL%');

    expect(docs).toContain('scripts/dev/smoke-browser-editor.ps1');
    expect(docs).toContain('BROWSER SMOKE SKIPPED');
    expect(docs).toContain('output/playwright/cp108');
    expect(docs).toContain('00-static-splash.html');
    expect(docs).toContain('Create Browser Project');
    expect(docs).toContain('startup recovery');
  });
});
