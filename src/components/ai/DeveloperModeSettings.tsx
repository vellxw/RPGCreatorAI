import type { ReactNode } from 'react';
import {
  DEVELOPER_MODE_OFF_CAPABILITIES,
  type DeveloperModeCapabilities,
  type DeveloperModeState,
} from '../../devMode/devModeTypes';

export interface DeveloperModeSettingsProps {
  state: DeveloperModeState;
  capabilities: DeveloperModeCapabilities;
  enabledAt?: string;
  disclaimerText: string;
  onEnable?: (acknowledgedDisclaimer: string) => void;
  onDisable?: () => void;
}

const CAPABILITY_LABEL: Record<keyof DeveloperModeCapabilities, string> = {
  canExecuteShell: 'Execute shell commands',
  canCommitChanges: 'Commit changes to local repository',
  canPushToRemote: 'Push to a remote repository',
  canWriteOutsideProject: 'Write files outside the project folder',
  canUseCodeAssistant: 'Use the code assistant workflows',
  canOpenRuntimeDiagnostics: 'Open the runtime diagnostics drawer',
  canExportHandoff: 'Export a developer handoff bundle',
};

const CAPABILITY_HELPER: Record<keyof DeveloperModeCapabilities, string> = {
  canExecuteShell:
    'The host remains shell-free. This capability is intentionally disabled even when Developer Mode is on.',
  canCommitChanges:
    'The host never creates git commits. This capability is intentionally disabled even when Developer Mode is on.',
  canPushToRemote:
    'The host never pushes to a remote. This capability is intentionally disabled even when Developer Mode is on.',
  canWriteOutsideProject:
    'The host always sandboxes writes to the project root. This capability is intentionally disabled even when Developer Mode is on.',
  canUseCodeAssistant:
    'When Developer Mode is on, code assistant workflows become available as proposals, handoffs, and diffs.',
  canOpenRuntimeDiagnostics:
    'When Developer Mode is on, additional runtime diagnostics become visible.',
  canExportHandoff:
    'Handoff bundles are always available so creators can share context with a developer.',
};

const CAPABILITY_ORDER: ReadonlyArray<keyof DeveloperModeCapabilities> = [
  'canExecuteShell',
  'canCommitChanges',
  'canPushToRemote',
  'canWriteOutsideProject',
  'canUseCodeAssistant',
  'canOpenRuntimeDiagnostics',
  'canExportHandoff',
];

function formatEnabledAt(enabledAt: string | undefined): string {
  if (!enabledAt) return 'Not enabled yet';
  return `Enabled at ${enabledAt}`;
}

export function DeveloperModeSettings({
  state,
  capabilities,
  enabledAt,
  disclaimerText,
  onEnable,
  onDisable,
}: DeveloperModeSettingsProps): ReactNode {
  const isOn = state === 'on';
  return (
    <section
      data-testid="developer-mode-settings"
      data-state={state}
      data-can-execute-shell={capabilities.canExecuteShell}
      data-can-commit={capabilities.canCommitChanges}
      data-can-push={capabilities.canPushToRemote}
      data-can-write-outside={capabilities.canWriteOutsideProject}
      data-can-use-code-assistant={capabilities.canUseCodeAssistant}
      data-can-open-diagnostics={capabilities.canOpenRuntimeDiagnostics}
      aria-label="Developer Mode"
    >
      <header>
        <h2>Developer Mode</h2>
        <p data-testid="developer-mode-status">{isOn ? 'Developer Mode is on.' : 'Developer Mode is off.'}</p>
        <p data-testid="developer-mode-enabled-at">{formatEnabledAt(enabledAt)}</p>
      </header>
      <p data-testid="developer-mode-disclaimer">{disclaimerText}</p>
      <ul data-testid="developer-mode-capabilities" aria-label="Developer Mode capabilities">
        {CAPABILITY_ORDER.map(capability => {
          const enabled = capabilities[capability];
          const off = enabled === false;
          const lockedOff = DEVELOPER_MODE_OFF_CAPABILITIES[capability] === false && isOn;
          return (
            <li
              key={capability}
              data-testid={`developer-mode-capability-${capability}`}
              data-enabled={enabled}
              data-locked-off={lockedOff}
            >
              <strong>{CAPABILITY_LABEL[capability]}</strong>
              <span data-testid={`developer-mode-capability-helper-${capability}`}>
                {CAPABILITY_HELPER[capability]}
              </span>
            </li>
          );
        })}
      </ul>
      <div data-testid="developer-mode-actions">
        {isOn ? (
          <button
            type="button"
            data-testid="developer-mode-disable"
            data-action="disable"
            onClick={() => onDisable?.()}
          >
            Turn Developer Mode off
          </button>
        ) : (
          <button
            type="button"
            data-testid="developer-mode-enable"
            data-action="enable"
            onClick={() => onEnable?.(disclaimerText)}
          >
            I have read the disclaimer — turn Developer Mode on
          </button>
        )}
      </div>
    </section>
  );
}
