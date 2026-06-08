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
      '[switch]$SkipAssets',
      'FRONTEND TYPECHECK',
      'FRONTEND TESTS',
      'FRONTEND BUILD',
      'NATIVE CONFIGURE BUILD TEST',
      'TAURI CONTENT CHECK',
      'RUST DESKTOP TESTS',
      'PHASE 11 ASSET PIPELINE CHECKS',
      'RUNTIME SMOKE',
      'EDITOR RUNTIME ROUNDTRIP',
      'GATE SUMMARY',
      'npm run typecheck',
      'npm test',
      'npm run build',
      'cargo test --manifest-path src-tauri/Cargo.toml',
      'verify-tauri-content.ps1',
      'export-runtime-assets.ps1',
      '--validate-only',
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
    const packagedLaunchSmoke = readFileSync(
      join(process.cwd(), 'scripts/dev/smoke-packaged-executable-launch.ps1'),
      'utf8',
    );
    const packagedLaunchSmokeWrapper = readFileSync(
      join(process.cwd(), 'scripts/dev/smoke-packaged-executable-launch.bat'),
      'utf8',
    );
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const tauriConfig = JSON.parse(readFileSync(join(process.cwd(), 'src-tauri/tauri.conf.json'), 'utf8')) as {
      build: { beforeBuildCommand: string; frontendDist: string };
    };

    expect(packageJson.scripts['desktop:package:windows']).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/package-windows.ps1',
    );
    expect(packageJson.scripts['verify:windows']).toBe(
      'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/verify.ps1',
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
      'smoke-packaged-executable-launch.ps1',
      'PACKAGED SMOKE PASSED',
    ]) {
      expect(packageScript).toContain(expected);
    }

    for (const expected of [
      'PACKAGED EXECUTABLE LAUNCH SMOKE',
      'rpg_creator_runtime.exe',
      'Start-Process',
      '-WindowStyle Hidden',
      'LaunchWorkingDirectory',
      'PACKAGED EXECUTABLE LAUNCH SMOKE PASSED',
    ]) {
      expect(packagedLaunchSmoke).toContain(expected);
    }

    expect(packageWrapper).toContain('-ExecutionPolicy Bypass');
    expect(packageWrapper).toContain('package-windows.ps1');
    expect(packageWrapper).toContain('%*');
    expect(packageWrapper).toContain('exit /b %ERRORLEVEL%');
    expect(packagedLaunchSmokeWrapper).toContain('smoke-packaged-executable-launch.ps1');
    expect(packagedLaunchSmokeWrapper).toContain('exit /b %ERRORLEVEL%');
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

  it('documents and validates first-run app-data directories', () => {
    const policyDoc = readFileSync(join(process.cwd(), 'docs/FIRST_RUN_APP_DATA_POLICY.md'), 'utf8');
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/dev/smoke-first-run-app-data.ps1'), 'utf8');
    const smokeWrapper = readFileSync(join(process.cwd(), 'scripts/dev/smoke-first-run-app-data.bat'), 'utf8');

    for (const expected of [
      '%APPDATA%\\RPGCreatorAI',
      '%LOCALAPPDATA%\\RPGCreatorAI',
      'playtest-sessions',
      'runtime-logs',
      'config.json',
      '<projectRoot>\\.backups',
      'src-tauri/src/app_paths.rs',
      'latest 5 sessions',
      'latest 10 backups',
    ]) {
      expect(policyDoc).toContain(expected);
    }

    expect(smokeScript).toContain('FIRST-RUN APP DATA SMOKE');
    expect(smokeScript).toContain('EnvironmentVariables');
    expect(smokeScript).toContain('APPDATA');
    expect(smokeScript).toContain('LOCALAPPDATA');
    expect(smokeScript).toContain('RPGCreatorAI-first-run-');
    expect(smokeScript).toContain('rpg_creator_runtime.exe');
    expect(smokeWrapper).toContain('smoke-first-run-app-data.ps1');
    expect(smokeWrapper).toContain('exit /b %ERRORLEVEL%');
  });

  it('documents and validates runtime diagnostics discovery', () => {
    const diagnosticsDoc = readFileSync(join(process.cwd(), 'docs/DIAGNOSTICS.md'), 'utf8');
    const runtimeBridgeDoc = readFileSync(join(process.cwd(), 'docs/RUNTIME_LAUNCH_BRIDGE.md'), 'utf8');
    const verifyDiagnostics = readFileSync(join(process.cwd(), 'scripts/dev/verify-diagnostics.ps1'), 'utf8');
    const verifyDiagnosticsWrapper = readFileSync(join(process.cwd(), 'scripts/dev/verify-diagnostics.bat'), 'utf8');

    for (const expected of [
      '%APPDATA%\\RPGCreatorAI\\runtime-logs',
      'runtime_diagnostics',
      'runtime-*.log',
      'runtime-state-snapshot.json',
      'latest 256 KiB',
      'latest 128 KiB',
      'failed before the native runtime process started',
      'Redact any accidental secrets',
      'scripts/dev/verify-diagnostics.ps1',
    ]) {
      expect(diagnosticsDoc).toContain(expected);
    }

    expect(runtimeBridgeDoc).toContain('getDiagnostics(): Promise<RuntimeDiagnosticsInfo>');
    expect(runtimeBridgeDoc).toContain('runtime_diagnostics');
    expect(verifyDiagnostics).toContain('runtime_diagnostics_reports_folder_without_existing_log');
    expect(verifyDiagnostics).toContain('DesktopRuntimeAdapter.test.ts');
    expect(verifyDiagnostics).toContain('RuntimeLogPanel.test.tsx');
    expect(verifyDiagnostics).toContain('npm run typecheck');
    expect(verifyDiagnosticsWrapper).toContain('verify-diagnostics.ps1');
    expect(verifyDiagnosticsWrapper).toContain('exit /b %ERRORLEVEL%');
  });

  it('keeps build, run, packaging, and architecture docs aligned with Phase 11 commands', () => {
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
    const buildRun = readFileSync(join(process.cwd(), 'docs/BUILD_AND_RUN.md'), 'utf8');
    const windowsNotes = readFileSync(join(process.cwd(), 'docs/WINDOWS_BUILD_NOTES.md'), 'utf8');
    const architecture = readFileSync(join(process.cwd(), 'docs/ARCHITECTURE.md'), 'utf8');
    const verifyScript = readFileSync(join(process.cwd(), 'scripts/dev/verify.ps1'), 'utf8');

    for (const expected of [
      'Canonical Windows local gate',
      'npm run verify:windows',
      '=== ALL PASSED ===',
      'PACKAGED EXECUTABLE LAUNCH SMOKE PASSED',
      'PACKAGED SMOKE PASSED',
      'RUNTIME DIAGNOSTICS VERIFY PASSED',
      'Known nonfatal warnings',
      'Current Editor Workflow',
    ]) {
      expect(readme + buildRun).toContain(expected);
    }

    for (const expected of [
      'scripts\\dev\\package-windows.bat',
      'docs/DIAGNOSTICS.md',
      'Known nonfatal warnings',
      'BRANDING ASSETS PASSED',
      'FIRST-RUN APP DATA SMOKE PASSED',
      'smoke-packaged-executable-launch.bat',
    ]) {
      expect(buildRun + windowsNotes).toContain(expected);
    }

    expect(architecture).toContain('Editor, Desktop Shell, And Runtime Boundary');
    expect(architecture).toContain('Browser editor (`npm run dev`)');
    expect(architecture).toContain('runtime diagnostics');
    expect(verifyScript).toContain('Canonical local green gate');
    expect(readme + buildRun + windowsNotes).not.toContain('Canonical MVP');
    expect(readme + buildRun).not.toContain('MVP limitations');
  });

  it('keeps startup open/create project docs and desktop bridge aligned', () => {
    const buildRun = readFileSync(join(process.cwd(), 'docs/BUILD_AND_RUN.md'), 'utf8');
    const shellArchitecture = readFileSync(join(process.cwd(), 'docs/DESKTOP_SHELL_ARCHITECTURE.md'), 'utf8');
    const filesystemDoc = readFileSync(join(process.cwd(), 'docs/FILESYSTEM_ADAPTER.md'), 'utf8');
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8');
    const bridgeTypes = readFileSync(join(process.cwd(), 'src/types/rpgBridge.ts'), 'utf8');
    const tauriBridge = readFileSync(join(process.cwd(), 'src/adapters/tauriBridge.ts'), 'utf8');
    const tauriLib = readFileSync(join(process.cwd(), 'src-tauri/src/lib.rs'), 'utf8');
    const fsCommands = readFileSync(join(process.cwd(), 'src-tauri/src/fs_commands.rs'), 'utf8');

    for (const expected of [
      'On the startup screen',
      'open an existing project folder',
      'create a new',
      'import a project bundle',
      'Browser-created projects are memory-backed',
    ]) {
      expect(buildRun).toContain(expected);
    }

    expect(shellArchitecture).toContain('createProjectDialog(state)');
    expect(filesystemDoc).toContain('## Create Flow');
    expect(filesystemDoc).toContain('refuses to overwrite an existing `data/project.json`');
    expect(filesystemDoc).toContain('browser mode cannot open folders');

    expect(app).toContain('ProjectStartupScreen');
    expect(app).toContain('performCreateProject');
    expect(bridgeTypes).toContain('createProjectDialog(state: FullProjectState)');
    expect(tauriBridge).toContain("invoke('fs_create_project_dialog'");
    expect(tauriLib).toContain('fs_commands::fs_create_project_dialog');
    expect(fsCommands).toContain('pub fn fs_create_project_dialog');
    expect(fsCommands).toContain('ensure_new_project_target');
  });
});
