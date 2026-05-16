// RuntimeLaunchAdapter — Phase 5 wires DesktopRuntimeAdapter through the
// Tauri shell IPC. Browser mode keeps reporting unavailable honestly.

import type {
  RuntimeLaunchAdapter,
  RuntimeLaunchResult,
  RuntimeStatus,
} from './types';

export class BrowserRuntimeAdapter implements RuntimeLaunchAdapter {
  canLaunch(): boolean {
    return false;
  }

  getExecutablePath(): string | null {
    return null;
  }

  async launch(_projectPath: string): Promise<RuntimeLaunchResult> {
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

  async launch(projectRoot: string): Promise<RuntimeLaunchResult> {
    if (!this.canLaunch()) {
      return {
        success: false,
        error: 'Desktop runtime bridge not detected. Run inside the Tauri shell.',
      };
    }
    try {
      const result = await window.rpgBridge!.runtime.launch(projectRoot);
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

  getUnavailableReason(): string | null {
    return this.canLaunch() ? null : 'Desktop runtime bridge not detected.';
  }
}
