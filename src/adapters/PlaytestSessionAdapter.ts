import type {
  FullProjectState,
  PlaytestSessionAdapter,
  PlaytestSessionRequest,
  PlaytestSessionResult,
} from './types';

export class BrowserPlaytestSessionAdapter implements PlaytestSessionAdapter {
  canCreateSession(): boolean {
    return false;
  }

  async createSession(
    _sourceRoot: string,
    _state: FullProjectState,
    _request: PlaytestSessionRequest,
  ): Promise<PlaytestSessionResult> {
    return {
      success: false,
      error: 'Native playtest sessions require the Tauri desktop shell.',
    };
  }

  getUnavailableReason(): string | null {
    return 'Browser mode cannot create native playtest session folders.';
  }
}

export class DesktopPlaytestSessionAdapter implements PlaytestSessionAdapter {
  canCreateSession(): boolean {
    return typeof window !== 'undefined' && !!window.rpgBridge?.fs;
  }

  async createSession(
    sourceRoot: string,
    state: FullProjectState,
    request: PlaytestSessionRequest,
  ): Promise<PlaytestSessionResult> {
    if (!this.canCreateSession()) {
      return {
        success: false,
        error: 'Desktop filesystem bridge not detected. Run inside the Tauri shell.',
      };
    }
    try {
      return await window.rpgBridge!.fs.createPlaytestSession(sourceRoot, state, request);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  getUnavailableReason(): string | null {
    return this.canCreateSession() ? null : 'Desktop filesystem bridge not detected.';
  }
}
