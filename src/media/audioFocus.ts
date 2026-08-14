export const AUDIO_FOCUS_POLICY_SCHEMA_VERSION = 1 as const;

export type AudioFocusState = 'gained' | 'duck' | 'lost-transient' | 'lost';
export type AudioResumeMode = 'automatic' | 'user-gesture';

export interface AudioFocusPolicyV1 {
  schemaVersion: typeof AUDIO_FOCUS_POLICY_SCHEMA_VERSION;
  suspendWhenHidden: boolean;
  transientLoss: 'suspend' | 'duck';
  duckGain: number;
  duckForVoice: boolean;
  voiceDuckGain: number;
  resumeMode: AudioResumeMode;
}

export interface AudioFocusSnapshot {
  focus: AudioFocusState;
  visibility: 'visible' | 'hidden';
  userMuted: boolean;
  voiceActive: boolean;
  /** Set false after an interruption when the platform requires a fresh gesture. */
  resumeGestureGranted: boolean;
}

export type AudioFocusMode = 'active' | 'ducked' | 'muted' | 'suspended' | 'blocked';

export interface AudioFocusResolution {
  mode: AudioFocusMode;
  masterGain: number;
  backgroundGain: number;
  voiceGain: number;
  shouldSuspend: boolean;
  requiresUserGesture: boolean;
  reason: 'ready' | 'voice-active' | 'focus-duck' | 'focus-lost' | 'hidden' | 'user-muted' | 'gesture-required';
}

export interface AudioFocusValidationIssue {
  code: 'invalid-policy' | 'unsupported-version' | 'invalid-gain' | 'invalid-resume-mode';
  path: string;
  message: string;
}

export interface AudioFocusValidationReport {
  valid: boolean;
  issues: AudioFocusValidationIssue[];
}

export const DEFAULT_AUDIO_FOCUS_POLICY: AudioFocusPolicyV1 = Object.freeze({
  schemaVersion: AUDIO_FOCUS_POLICY_SCHEMA_VERSION,
  suspendWhenHidden: true,
  transientLoss: 'duck',
  duckGain: 0.2,
  duckForVoice: true,
  voiceDuckGain: 0.35,
  resumeMode: 'user-gesture',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validDuckGain(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1;
}

/** Validates policy data; platform focus APIs remain adapter-owned. */
export function validateAudioFocusPolicy(input: unknown): AudioFocusValidationReport {
  const issues: AudioFocusValidationIssue[] = [];
  const add = (code: AudioFocusValidationIssue['code'], path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  if (!isRecord(input)) {
    add('invalid-policy', '$', 'Audio focus policy must be an object.');
    return { valid: false, issues };
  }
  if (input.schemaVersion !== AUDIO_FOCUS_POLICY_SCHEMA_VERSION) {
    add('unsupported-version', '$.schemaVersion', 'Only audio focus policy version 1 is supported.');
  }
  if (typeof input.suspendWhenHidden !== 'boolean') {
    add('invalid-policy', '$.suspendWhenHidden', 'suspendWhenHidden must be a boolean.');
  }
  if (input.transientLoss !== 'suspend' && input.transientLoss !== 'duck') {
    add('invalid-policy', '$.transientLoss', 'transientLoss must be suspend or duck.');
  }
  if (!validDuckGain(input.duckGain)) {
    add('invalid-gain', '$.duckGain', 'duckGain must be finite and at least 0 but less than 1.');
  }
  if (typeof input.duckForVoice !== 'boolean') {
    add('invalid-policy', '$.duckForVoice', 'duckForVoice must be a boolean.');
  }
  if (!validDuckGain(input.voiceDuckGain)) {
    add('invalid-gain', '$.voiceDuckGain', 'voiceDuckGain must be finite and at least 0 but less than 1.');
  }
  if (input.resumeMode !== 'automatic' && input.resumeMode !== 'user-gesture') {
    add('invalid-resume-mode', '$.resumeMode', 'resumeMode must be automatic or user-gesture.');
  }
  return { valid: issues.length === 0, issues };
}

/** Resolves a deterministic mix decision from browser/native focus state. */
export function resolveAudioFocus(
  policy: AudioFocusPolicyV1,
  snapshot: AudioFocusSnapshot,
): AudioFocusResolution {
  if (snapshot.userMuted) return silentResolution('muted', 'user-muted', false);
  if (snapshot.visibility === 'hidden' && policy.suspendWhenHidden) {
    return silentResolution('suspended', 'hidden', false);
  }
  if (snapshot.focus === 'lost' || (snapshot.focus === 'lost-transient' && policy.transientLoss === 'suspend')) {
    return silentResolution('suspended', 'focus-lost', false);
  }
  if (policy.resumeMode === 'user-gesture' && !snapshot.resumeGestureGranted) {
    return silentResolution('blocked', 'gesture-required', true);
  }
  if (snapshot.focus === 'duck' || snapshot.focus === 'lost-transient') {
    return {
      mode: 'ducked',
      masterGain: policy.duckGain,
      backgroundGain: policy.duckGain,
      voiceGain: policy.duckGain,
      shouldSuspend: false,
      requiresUserGesture: false,
      reason: 'focus-duck',
    };
  }
  if (snapshot.voiceActive && policy.duckForVoice) {
    return {
      mode: 'ducked',
      masterGain: 1,
      backgroundGain: policy.voiceDuckGain,
      voiceGain: 1,
      shouldSuspend: false,
      requiresUserGesture: false,
      reason: 'voice-active',
    };
  }
  return {
    mode: 'active',
    masterGain: 1,
    backgroundGain: 1,
    voiceGain: 1,
    shouldSuspend: false,
    requiresUserGesture: false,
    reason: 'ready',
  };
}

function silentResolution(
  mode: Extract<AudioFocusMode, 'muted' | 'suspended' | 'blocked'>,
  reason: Extract<AudioFocusResolution['reason'], 'user-muted' | 'focus-lost' | 'hidden' | 'gesture-required'>,
  requiresUserGesture: boolean,
): AudioFocusResolution {
  return {
    mode,
    masterGain: 0,
    backgroundGain: 0,
    voiceGain: 0,
    shouldSuspend: true,
    requiresUserGesture,
    reason,
  };
}
