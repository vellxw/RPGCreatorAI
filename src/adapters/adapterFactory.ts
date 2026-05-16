// Selects the active adapters based on the runtime environment.
// We never assume desktop capability — we feature-detect.

import { BrowserMemoryAdapter } from './BrowserMemoryAdapter';
import { FileSystemAdapter } from './FileSystemAdapter';
import { BrowserRuntimeAdapter, DesktopRuntimeAdapter } from './RuntimeLaunchAdapter';
import type { ProjectDataAdapter, RuntimeLaunchAdapter } from './types';

let dataAdapter: ProjectDataAdapter | null = null;
let runtimeAdapter: RuntimeLaunchAdapter | null = null;

function detectDesktopShell(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { runtimeBridge?: unknown }).runtimeBridge;
}

export function getProjectDataAdapter(): ProjectDataAdapter {
  if (dataAdapter) return dataAdapter;

  if (detectDesktopShell()) {
    // FileSystemAdapter is a seam — it currently delegates to BrowserMemoryAdapter
    // until a desktop shell wires real fs writes. We still surface it so the
    // factory choice is explicit.
    dataAdapter = new FileSystemAdapter();
  } else {
    dataAdapter = new BrowserMemoryAdapter();
  }

  return dataAdapter;
}

export function getRuntimeLaunchAdapter(): RuntimeLaunchAdapter {
  if (runtimeAdapter) return runtimeAdapter;

  runtimeAdapter = detectDesktopShell()
    ? new DesktopRuntimeAdapter()
    : new BrowserRuntimeAdapter();

  return runtimeAdapter;
}

// Test/utility hook so unit tests can inject a fresh adapter.
export function _resetAdaptersForTest(): void {
  dataAdapter = null;
  runtimeAdapter = null;
}
