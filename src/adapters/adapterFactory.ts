// Selects the active adapters based on the runtime environment.
// Tauri presence is feature-detected via __TAURI_INTERNALS__ at startup
// time; the bridge is installed once and adapters are selected to match.

import { BrowserMemoryAdapter } from './BrowserMemoryAdapter';
import { FileSystemAdapter } from './FileSystemAdapter';
import { BrowserPlaytestSessionAdapter, DesktopPlaytestSessionAdapter } from './PlaytestSessionAdapter';
import { BrowserRuntimeAdapter, DesktopRuntimeAdapter } from './RuntimeLaunchAdapter';
import type { PlaytestSessionAdapter, ProjectDataAdapter, RuntimeLaunchAdapter } from './types';

let dataAdapter: ProjectDataAdapter | null = null;
let runtimeAdapter: RuntimeLaunchAdapter | null = null;
let playtestSessionAdapter: PlaytestSessionAdapter | null = null;

function detectDesktopShell(): boolean {
  return typeof window !== 'undefined' && !!window.rpgBridge;
}

export function getProjectDataAdapter(): ProjectDataAdapter {
  if (dataAdapter) return dataAdapter;
  dataAdapter = detectDesktopShell() ? new FileSystemAdapter() : new BrowserMemoryAdapter();
  return dataAdapter;
}

export function getFileSystemAdapter(): FileSystemAdapter | null {
  const a = getProjectDataAdapter();
  return a instanceof FileSystemAdapter ? a : null;
}

export function getRuntimeLaunchAdapter(): RuntimeLaunchAdapter {
  if (runtimeAdapter) return runtimeAdapter;
  runtimeAdapter = detectDesktopShell() ? new DesktopRuntimeAdapter() : new BrowserRuntimeAdapter();
  return runtimeAdapter;
}

export function getPlaytestSessionAdapter(): PlaytestSessionAdapter {
  if (playtestSessionAdapter) return playtestSessionAdapter;
  playtestSessionAdapter = detectDesktopShell()
    ? new DesktopPlaytestSessionAdapter()
    : new BrowserPlaytestSessionAdapter();
  return playtestSessionAdapter;
}

export function isDesktopShell(): boolean {
  return detectDesktopShell();
}

// Test/utility hook so unit tests can inject a fresh adapter.
export function _resetAdaptersForTest(): void {
  dataAdapter = null;
  runtimeAdapter = null;
  playtestSessionAdapter = null;
}
