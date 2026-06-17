export type DeveloperModeState = 'off' | 'on';

export interface DeveloperModeCapabilities {
  canExecuteShell: boolean;
  canCommitChanges: boolean;
  canPushToRemote: boolean;
  canWriteOutsideProject: boolean;
  canUseCodeAssistant: boolean;
  canOpenRuntimeDiagnostics: boolean;
  canExportHandoff: boolean;
}

export const DEVELOPER_MODE_DEFAULT_STATE: DeveloperModeState = 'off';

export const DEVELOPER_MODE_OFF_CAPABILITIES: Readonly<DeveloperModeCapabilities> = Object.freeze({
  canExecuteShell: false,
  canCommitChanges: false,
  canPushToRemote: false,
  canWriteOutsideProject: false,
  canUseCodeAssistant: false,
  canOpenRuntimeDiagnostics: false,
  canExportHandoff: true,
});

export const DEVELOPER_MODE_ON_CAPABILITIES: Readonly<DeveloperModeCapabilities> = Object.freeze({
  canExecuteShell: false,
  canCommitChanges: false,
  canPushToRemote: false,
  canWriteOutsideProject: false,
  canUseCodeAssistant: true,
  canOpenRuntimeDiagnostics: true,
  canExportHandoff: true,
});

export function getDeveloperModeCapabilities(state: DeveloperModeState): DeveloperModeCapabilities {
  if (state === 'on') return DEVELOPER_MODE_ON_CAPABILITIES;
  return DEVELOPER_MODE_OFF_CAPABILITIES;
}

export function isCapabilityEnabled(
  state: DeveloperModeState,
  capability: keyof DeveloperModeCapabilities,
): boolean {
  return getDeveloperModeCapabilities(state)[capability];
}

export const DISABLED_WHEN_OFF: ReadonlyArray<keyof DeveloperModeCapabilities> = [
  'canExecuteShell',
  'canCommitChanges',
  'canPushToRemote',
  'canWriteOutsideProject',
  'canUseCodeAssistant',
  'canOpenRuntimeDiagnostics',
];

export const ALWAYS_ENABLED: ReadonlyArray<keyof DeveloperModeCapabilities> = ['canExportHandoff'];

export interface DeveloperModePreferences {
  version: 1;
  state: DeveloperModeState;
  enabledAt?: string;
  acknowledgedDisclaimerAt?: string;
}

export const DEFAULT_DEVELOPER_MODE_PREFERENCES: DeveloperModePreferences = Object.freeze({
  version: 1,
  state: DEVELOPER_MODE_DEFAULT_STATE,
});

export interface DeveloperModeChangeError {
  reason:
    | 'missing-disclaimer-acknowledgement'
    | 'state-already'
    | 'persistence-failed';
  message: string;
}

export interface DeveloperModeChangeResult {
  ok: boolean;
  state: DeveloperModeState;
  capabilities: DeveloperModeCapabilities;
  preferences: DeveloperModePreferences;
  error?: DeveloperModeChangeError;
}
