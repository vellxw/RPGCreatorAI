import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('PX-021 first paint performance budget tooling', () => {
  it('documents a repeatable repo-local first paint measurement command', () => {
    const scriptPath = join(process.cwd(), 'scripts/dev/measure-first-paint.ps1');
    const wrapperPath = join(process.cwd(), 'scripts/dev/measure-first-paint.bat');
    const docsPath = join(process.cwd(), 'docs/FIRST_PAINT_PERFORMANCE_BUDGET.md');

    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(wrapperPath)).toBe(true);
    expect(existsSync(docsPath)).toBe(true);

    const script = readFileSync(scriptPath, 'utf8');
    const wrapper = readFileSync(wrapperPath, 'utf8');
    const docs = readFileSync(docsPath, 'utf8');
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    const buildDocs = readFileSync(join(process.cwd(), 'docs/BUILD_AND_RUN.md'), 'utf8');
    const ciDocs = readFileSync(join(process.cwd(), 'docs/CI_READY_VALIDATION.md'), 'utf8');

    for (const expected of [
      'FIRST PAINT MEASURE PASSED',
      'FIRST PAINT MEASURE SKIPPED',
      "performance.getEntriesByType('paint')",
      'data-rpg-splash-shell',
      'first-contentful-paint',
      'splashVisibleMs',
      'SplashVisibleBudgetMs',
      'DomContentLoadedBudgetMs',
      'FirstContentfulPaintBudgetMs',
      'output/playwright/phase12-px021-first-paint',
      '@playwright/cli',
      'playwright-cli',
    ]) {
      expect(script).toContain(expected);
    }

    expect(wrapper).toContain('-ExecutionPolicy Bypass');
    expect(wrapper).toContain('measure-first-paint.ps1');
    expect(wrapper).toContain('exit /b %ERRORLEVEL%');

    expect(packageJson).toContain('measure:first-paint:windows');
    expect(buildDocs).toContain('scripts/dev/measure-first-paint.ps1');
    expect(ciDocs).toContain('scripts/dev/measure-first-paint.ps1');
    expect(docs).toContain('Splash visible budget');
    expect(docs).toContain('Desktop launch budget');
    expect(docs).toContain('FIRST PAINT MEASURE PASSED');
  });
});
