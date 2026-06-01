import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MVP verify script', () => {
  it('keeps the canonical green gate wired to every required validation section', () => {
    const verify = readFileSync(join(process.cwd(), 'scripts/dev/verify.ps1'), 'utf8');
    const wrapper = readFileSync(join(process.cwd(), 'scripts/dev/verify.bat'), 'utf8');
    const build = readFileSync(join(process.cwd(), 'scripts/dev/build.ps1'), 'utf8');

    for (const expected of [
      '[switch]$SkipSmoke',
      '[switch]$SkipDesktop',
      '[switch]$SkipFrontend',
      '[switch]$SkipRuntime',
      'FRONTEND TYPECHECK',
      'FRONTEND TESTS',
      'FRONTEND BUILD',
      'NATIVE CONFIGURE BUILD TEST',
      'TAURI CONTENT CHECK',
      'RUST DESKTOP TESTS',
      'RUNTIME SMOKE',
      'EDITOR RUNTIME ROUNDTRIP',
      'GATE SUMMARY',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'cargo test --manifest-path src-tauri/Cargo.toml',
      'verify-tauri-content.ps1',
      'smoke-runtime.ps1',
      'verify-editor-runtime-roundtrip.ps1',
    ]) {
      expect(verify).toContain(expected);
    }

    for (const expected of ['-SkipFrontend', '-SkipDesktop', '-SkipSmoke']) {
      expect(build).toContain(expected);
    }

    expect(wrapper).toContain('-ExecutionPolicy Bypass');
    expect(wrapper).toContain('exit /b %ERRORLEVEL%');
  });
});
