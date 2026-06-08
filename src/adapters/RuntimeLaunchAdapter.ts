// RuntimeLaunchAdapter — Phase 5 wires DesktopRuntimeAdapter through the
// Tauri shell IPC. Browser mode keeps reporting unavailable honestly.

import type {
  RuntimeAvailabilityInfo,
  RuntimeDiagnosticsInfo,
  RuntimeLaunchAdapter,
  RuntimeLaunchOptions,
  RuntimeLaunchResult,
  RuntimeLogActionResult,
  RuntimeLogInfo,
  RuntimeLogTailResult,
  RuntimeSnapshotResult,
  RuntimeStatus,
} from './types';

export class BrowserRuntimeAdapter implements RuntimeLaunchAdapter {
  canLaunch(): boolean {
    return false;
  }

  getExecutablePath(): string | null {
    return null;
  }

  async checkAvailability(): Promise<RuntimeAvailabilityInfo> {
    return {
      available: false,
      status: 'unavailable',
      error:
        'Native runtime unavailable in browser mode. Use the desktop app to launch playtests.',
    };
  }

  async launch(_projectPath: string, _options?: RuntimeLaunchOptions): Promise<RuntimeLaunchResult> {
    return {
      success: false,
      error:
        'Native runtime cannot be launched from the browser. Build with build_bootstrap.bat (or scripts/dev/verify-runtime.bat) and run rpg_creator_runtime.exe manually, or use the desktop shell (npm run desktop:dev).',
    };
  }

  getStatus(): RuntimeStatus {
    return 'unavailable';
  }

  async kill(): Promise<void> {
    // no-op
  }

  async getDiagnostics(): Promise<RuntimeDiagnosticsInfo> {
    return {
      success: false,
      error: 'Native runtime diagnostics are unavailable in browser mode.',
      logTailMaxBytes: 256 * 1024,
      snapshotMaxBytes: 128 * 1024,
    };
  }

  async getLatestLog(): Promise<RuntimeLogInfo> {
    return {
      success: false,
      error: 'Native runtime logs are unavailable in browser mode.',
    };
  }

  async readLatestLogTail(_maxBytes: number): Promise<RuntimeLogTailResult> {
    return {
      success: false,
      error: 'Native runtime logs are unavailable in browser mode.',
    };
  }

  async readLatestSnapshot(_maxBytes: number): Promise<RuntimeSnapshotResult> {
    return {
      success: false,
      error: 'Native runtime snapshots are unavailable in browser mode.',
    };
  }

  async openLogFolder(): Promise<RuntimeLogActionResult> {
    return {
      success: false,
      error: 'Native runtime log folders are unavailable in browser mode.',
    };
  }

  getUnavailableReason(): string | null {
    return 'Browser mode: process spawning is not exposed by Vite. Run the editor inside the Tauri desktop shell to launch the native runtime.';
  }
}

export class DesktopRuntimeAdapter implements RuntimeLaunchAdapter {
  private cachedStatus: RuntimeStatus = 'unavailable';
  private cachedExePath: string | null = null;

  canLaunch(): boolean {
    return typeof window !== 'undefined' && !!window.rpgBridge?.runtime;
  }

  getExecutablePath(): string | null {
    return this.cachedExePath;
  }

  async checkAvailability(options: RuntimeLaunchOptions = {}): Promise<RuntimeAvailabilityInfo> {
    if (!this.canLaunch()) {
      return {
        available: false,
        status: 'unavailable',
        error: 'Desktop runtime bridge not detected. Run inside the Tauri shell.',
      };
    }
    if (!window.rpgBridge!.runtime.availability) {
      return {
        available: false,
        status: 'unavailable',
        error: 'Desktop runtime availability check is not exposed by this shell.',
      };
    }
    try {
      const result = await window.rpgBridge!.runtime.availability(
        options.executableSearchRoot ?? null,
      );
      this.cachedStatus = result.status;
      if (result.executablePath) this.cachedExePath = result.executablePath;
      return result;
    } catch (e) {
      this.cachedStatus = 'unavailable';
      return {
        available: false,
        status: 'unavailable',
        error: (e as Error).message,
      };
    }
  }

  async launch(projectRoot: string, options: RuntimeLaunchOptions = {}): Promise<RuntimeLaunchResult> {
    if (!this.canLaunch()) {
      return {
        success: false,
        error: 'Desktop runtime bridge not detected. Run inside the Tauri shell.',
      };
    }
    try {
      const result = await window.rpgBridge!.runtime.launch(projectRoot, options.executableSearchRoot);
      if (result.success) {
        this.cachedStatus = 'running';
        if (result.executablePath) this.cachedExePath = result.executablePath;
      }
      return result;
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async getStatusAsync(): Promise<RuntimeStatus> {
    if (!this.canLaunch()) return 'unavailable';
    try {
      const status = await window.rpgBridge!.runtime.status();
      this.cachedStatus = status;
      return status;
    } catch {
      return 'unavailable';
    }
  }

  getStatus(): RuntimeStatus {
    return this.canLaunch() ? this.cachedStatus : 'unavailable';
  }

  async kill(): Promise<void> {
    if (!this.canLaunch()) return;
    try {
      await window.rpgBridge!.runtime.kill();
      this.cachedStatus = 'ready';
    } catch {
      // swallow; status poll will reconcile
    }
  }

  async getDiagnostics(): Promise<RuntimeDiagnosticsInfo> {
    if (!this.canLaunch()) {
      return {
        success: false,
        error: 'Desktop runtime bridge not detected.',
        logTailMaxBytes: 256 * 1024,
        snapshotMaxBytes: 128 * 1024,
      };
    }
    try {
      return await window.rpgBridge!.runtime.getDiagnostics();
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        logTailMaxBytes: 256 * 1024,
        snapshotMaxBytes: 128 * 1024,
      };
    }
  }

  async getLatestLog(): Promise<RuntimeLogInfo> {
    if (!this.canLaunch()) {
      return { success: false, error: 'Desktop runtime bridge not detected.' };
    }
    try {
      return await window.rpgBridge!.runtime.getLatestLog();
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async readLatestLogTail(maxBytes: number): Promise<RuntimeLogTailResult> {
    if (!this.canLaunch()) {
      return { success: false, error: 'Desktop runtime bridge not detected.' };
    }
    try {
      return await window.rpgBridge!.runtime.readLogTail(maxBytes);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async readLatestSnapshot(maxBytes: number): Promise<RuntimeSnapshotResult> {
    if (!this.canLaunch()) {
      return { success: false, error: 'Desktop runtime bridge not detected.' };
    }
    try {
      return await window.rpgBridge!.runtime.readLatestSnapshot(maxBytes);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async openLogFolder(): Promise<RuntimeLogActionResult> {
    if (!this.canLaunch()) {
      return { success: false, error: 'Desktop runtime bridge not detected.' };
    }
    try {
      return await window.rpgBridge!.runtime.openLogFolder();
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  getUnavailableReason(): string | null {
    return this.canLaunch() ? null : 'Desktop runtime bridge not detected.';
  }
}
