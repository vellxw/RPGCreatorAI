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

  it('keeps Windows focused helper wrappers and out-of-OneDrive CMake presets aligned', () => {
    const buildWrapper = readFileSync(join(process.cwd(), 'scripts/dev/build.bat'), 'utf8');
    const testWrapper = readFileSync(join(process.cwd(), 'scripts/dev/test.bat'), 'utf8');
    const cmakePresets = JSON.parse(readFileSync(join(process.cwd(), 'CMakePresets.json'), 'utf8')) as {
      configurePresets: Array<{
        name: string;
        binaryDir?: string;
        cacheVariables?: Record<string, string>;
      }>;
      buildPresets: Array<{ name: string; configurePreset: string }>;
      testPresets: Array<{ name: string; configurePreset: string }>;
    };

    expect(buildWrapper).toContain('-ExecutionPolicy Bypass');
    expect(buildWrapper).toContain('build.ps1');
    expect(buildWrapper).toContain('%*');
    expect(buildWrapper).toContain('exit /b %ERRORLEVEL%');

    expect(testWrapper).toContain('-ExecutionPolicy Bypass');
    expect(testWrapper).toContain('test.ps1');
    expect(testWrapper).toContain('%*');
    expect(testWrapper).toContain('exit /b %ERRORLEVEL%');

    const windowsDevPreset = cmakePresets.configurePresets.find(preset => preset.name === 'windows-dev');
    expect(windowsDevPreset?.binaryDir).toBe('$env{LOCALAPPDATA}/RPGCreatorAI/build');
    expect(windowsDevPreset?.cacheVariables?.CMAKE_POLICY_VERSION_MINIMUM).toBe('3.5');

    expect(cmakePresets.buildPresets).toContainEqual({
      name: 'windows-dev',
      configurePreset: 'windows-dev',
    });
    expect(cmakePresets.testPresets).toContainEqual(expect.objectContaining({
      name: 'windows-dev',
      configurePreset: 'windows-dev',
    }));
  });
});
