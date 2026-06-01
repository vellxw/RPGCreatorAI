import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
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

  it('keeps the Windows packaged-build prototype wired to runtime copy and smoke launch', () => {
    const packageScript = readFileSync(join(process.cwd(), 'scripts/dev/package-windows.ps1'), 'utf8');
    const packageWrapper = readFileSync(join(process.cwd(), 'scripts/dev/package-windows.bat'), 'utf8');
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const tauriConfig = JSON.parse(readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')) as {
      build: { beforeBuildCommand: string; frontendDist: string };
    };

    expect(packageJson.scripts['desktop:package:windows']).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/package-windows.ps1',
    );
    expect(tauriConfig.build.beforeBuildCommand).toBe('npm run build');
    expect(tauriConfig.build.frontendDist).toBe('../dist');

    for (const expected of [
      'CARGO_TARGET_DIR',
      'RPGCreatorAI',
      'tauri-target',
      'npm run desktop:build',
      'rpg_creator_runtime.exe',
      'Copy-Item',
      'Start-Process',
      '-WindowStyle Hidden',
      'PACKAGED SMOKE PASSED',
    ]) {
      expect(packageScript).toContain(expected);
    }

    expect(packageWrapper).toContain('-ExecutionPolicy Bypass');
    expect(packageWrapper).toContain('package-windows.ps1');
    expect(packageWrapper).toContain('%*');
    expect(packageWrapper).toContain('exit /b %ERRORLEVEL%');
  });

  it('keeps release version metadata aligned across npm, Tauri, and Cargo', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version: string;
    };
    const packageLock = JSON.parse(readFileSync(join(process.cwd(), 'package-lock.json'), 'utf8')) as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    const tauriConfig = JSON.parse(readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')) as {
      version: string;
    };
    const cargoToml = readFileSync(join(process.cwd(), 'src-tauri/Cargo.toml'), 'utf8');
    const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];

    expect(packageJson.version).toBe(tauriConfig.version);
    expect(packageLock.version).toBe(tauriConfig.version);
    expect(packageLock.packages['']?.version).toBe(tauriConfig.version);
    expect(cargoVersion).toBe(tauriConfig.version);
  });

  it('keeps release branding assets generated from a tracked source', () => {
    const tauriConfig = JSON.parse(readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')) as {
      productName: string;
      app: { windows: Array<{ title: string }> };
      bundle: { icon: string[]; shortDescription: string; longDescription: string };
    };
    const brandingDoc = readFileSync(join(process.cwd(), 'docs/RELEASE_BRANDING_ASSETS.md'), 'utf8');
    const iconGenerator = readFileSync(join(process.cwd(), 'src-tauri/scripts/generate-icons.ps1'), 'utf8');
    const brandingVerifier = readFileSync(join(process.cwd(), 'scripts/dev/verify-branding-assets.ps1'), 'utf8');
    const brandingWrapper = readFileSync(join(process.cwd(), 'scripts/dev/verify-branding-assets.bat'), 'utf8');

    expect(tauriConfig.productName).toBe('RPGCreatorAI');
    expect(tauriConfig.app.windows[0]?.title).toBe('RPGCreatorAI');
    expect(tauriConfig.bundle.shortDescription).toContain('RPGCreatorAI');
    expect(tauriConfig.bundle.longDescription).toContain('filesystem persistence');
    expect(tauriConfig.bundle.icon).toEqual(expect.arrayContaining([
      'icons/32x32.png',
      'icons/64x64.png',
      'icons/128x128.png',
      'icons/128x128@2x.png',
      'icons/icon.ico',
      'icons/icon.icns',
      'icons/icon.png',
    ]));

    for (const icon of tauriConfig.bundle.icon) {
      expect(existsSync(join(process.cwd(), 'src-tauri', icon))).toBe(true);
    }

    expect(existsSync(join(process.cwd(), 'src-tauri/icons/icon-source.svg'))).toBe(true);
    expect(brandingDoc).toContain('src-tauri/icons/icon-source.svg');
    expect(brandingDoc).toContain('No AI image generation');
    expect(iconGenerator).toContain('npx tauri icon');
    expect(iconGenerator).toContain('icon-source.svg');
    expect(brandingVerifier).toContain('ExtractAssociatedIcon');
    expect(brandingVerifier).toContain('icon-source.svg');
    expect(brandingWrapper).toContain('verify-branding-assets.ps1');
    expect(brandingWrapper).toContain('exit /b %ERRORLEVEL%');
  });
});
