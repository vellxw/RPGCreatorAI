// RuntimeLaunchAdapter — abstracts how the editor "launches the runtime".
// Browser mode honestly reports unavailable. The desktop seam documents
// where Electron/Tauri/Node child_process would plug in.

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
        'Native runtime cannot be launched from the browser. Build with build_bootstrap.bat and run build/rpg_creator_runtime manually.',
    };
  }

  getStatus(): RuntimeStatus {
    return 'unavailable';
  }

  async kill(): Promise<void> {
    // no-op
  }

  getUnavailableReason(): string | null {
    return 'Browser mode: process spawning is not exposed by Vite. A desktop shell (Electron/Tauri) is required to launch the native runtime.';
  }
}

export class DesktopRuntimeAdapter implements RuntimeLaunchAdapter {
  // Seam only: the actual spawn happens in the desktop shell that exposes
  // a window.runtimeBridge or a Tauri command. We feature-detect that here
  // so the editor never lies about its capabilities.

  private status: RuntimeStatus = 'unavailable';

  canLaunch(): boolean {
    // Re-evaluate every time so a late-injected bridge (Electron preload
    // script) is picked up.
    return typeof window !== 'undefined' && !!(window as unknown as { runtimeBridge?: unknown }).runtimeBridge;
  }

  getExecutablePath(): string | null {
    return this.canLaunch() ? 'build/rpg_creator_runtime' : null;
  }

  async launch(projectPath: string): Promise<RuntimeLaunchResult> {
    if (!this.canLaunch()) {
      return {
        success: false,
        error: 'Desktop runtime bridge not detected. Run inside an Electron/Tauri shell that exposes window.runtimeBridge.',
      };
    }
    this.status = 'running';

    // Documentation seam: a real shell would do something like
    //   const result = await window.runtimeBridge.launch(projectPath);
    // We don't fabricate a fake success here.
    return {
      success: false,
      error: 'DesktopRuntimeAdapter is a seam in Phase 4. Implement window.runtimeBridge.launch() in the desktop shell.',
      // pid intentionally omitted; we never return a fake PID.
      pid: undefined,
    };
  }

  getStatus(): RuntimeStatus {
    return this.canLaunch() ? this.status : 'unavailable';
  }

  async kill(): Promise<void> {
    this.status = this.canLaunch() ? 'ready' : 'unavailable';
  }

  getUnavailableReason(): string | null {
    return this.canLaunch() ? null : 'Desktop runtime bridge not detected.';
  }
}
