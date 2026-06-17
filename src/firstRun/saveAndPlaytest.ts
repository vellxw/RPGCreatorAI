export type SaveAndPlaytestOutcomeKind =
  | 'saved-and-playtested'
  | 'saved-and-routed'
  | 'save-blocked'
  | 'save-failed'
  | 'no-op';

export interface SaveAndPlaytestOutcome {
  kind: SaveAndPlaytestOutcomeKind;
  message: string;
  dirty: boolean;
  errorCount: number;
  warningCount: number;
}

export interface SaveAndPlaytestContext {
  dirty: boolean;
  errorCount: number;
  warningCount: number;
  runtimeAvailable: boolean;
}

export function decideSaveAndPlaytest(
  context: SaveAndPlaytestContext,
): SaveAndPlaytestOutcome {
  if (context.errorCount > 0) {
    return {
      kind: 'save-blocked',
      message:
        'Validation is blocking the save. Open the validation panel, fix the errors, then try Save & Playtest again.',
      dirty: context.dirty,
      errorCount: context.errorCount,
      warningCount: context.warningCount,
    };
  }
  if (!context.runtimeAvailable) {
    return {
      kind: 'saved-and-routed',
      message:
        'Saved the project. The native runtime is not available on this machine, so the in-editor playtest view is now open.',
      dirty: false,
      errorCount: 0,
      warningCount: context.warningCount,
    };
  }
  return {
    kind: 'saved-and-playtested',
    message:
      'Saved the project and handed off to the native runtime. Use the playtest view to inspect runtime state.',
    dirty: false,
    errorCount: 0,
    warningCount: context.warningCount,
  };
}
