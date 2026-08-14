export const RUNTIME_ACCESSIBILITY_SCHEMA_VERSION = 1 as const;
export const GORE_VARIANT_SCHEMA_VERSION = 1 as const;

export type MotionPreference = 'system' | 'reduce' | 'full';
export type GoreMode = 'full' | 'reduced' | 'off';

export interface SubtitleDisplayPreferencesV1 {
  enabled: boolean;
  speakerLabels: boolean;
  soundCues: boolean;
  textScale: number;
  maxLines: number;
}

export interface RuntimeAccessibilityPreferencesV1 {
  schemaVersion: typeof RUNTIME_ACCESSIBILITY_SCHEMA_VERSION;
  subtitles: SubtitleDisplayPreferencesV1;
  motion: { preference: MotionPreference };
  gore: { mode: GoreMode };
}

export interface RuntimeAccessibilityOverrides {
  subtitles?: Partial<SubtitleDisplayPreferencesV1>;
  motion?: Partial<RuntimeAccessibilityPreferencesV1['motion']>;
  gore?: Partial<RuntimeAccessibilityPreferencesV1['gore']>;
}

export type AccessibilityValidationCode =
  | 'invalid-preferences'
  | 'unsupported-version'
  | 'invalid-subtitles'
  | 'invalid-motion'
  | 'invalid-gore';

export interface AccessibilityValidationIssue {
  code: AccessibilityValidationCode;
  path: string;
  message: string;
}

export interface AccessibilityValidationReport {
  valid: boolean;
  issues: AccessibilityValidationIssue[];
}

export interface ResolvedMotionPolicy {
  reduced: boolean;
  cameraShake: boolean;
  parallax: boolean;
  decorativeLoops: boolean;
  transitionDurationScale: number;
  /** State changes still need a static, textual, or color-independent cue. */
  preserveEssentialStateChanges: true;
}

export interface GoreVariantSetV1 {
  schemaVersion: typeof GORE_VARIANT_SCHEMA_VERSION;
  id: string;
  gameplayCritical: boolean;
  /** Used as alt text/caption and as the no-image fallback. */
  accessibleDescription: string;
  variants: Partial<Record<GoreMode, string>>;
}

export type GoreVariantValidationCode =
  | 'invalid-variant-set'
  | 'unsupported-version'
  | 'invalid-id'
  | 'invalid-description'
  | 'invalid-asset-id'
  | 'missing-safe-fallback';

export interface GoreVariantValidationIssue {
  severity: 'error' | 'warning';
  code: GoreVariantValidationCode;
  path: string;
  message: string;
}

export interface GoreVariantValidationReport {
  valid: boolean;
  issues: GoreVariantValidationIssue[];
}

export interface ResolvedGoreVariant {
  requestedMode: GoreMode;
  sourceMode: GoreMode | null;
  assetId?: string;
  accessibleDescription: string;
  suppressed: boolean;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === 'system' || value === 'reduce' || value === 'full';
}

function isGoreMode(value: unknown): value is GoreMode {
  return value === 'full' || value === 'reduced' || value === 'off';
}

export function createRuntimeAccessibilityPreferences(
  overrides: RuntimeAccessibilityOverrides = {},
): RuntimeAccessibilityPreferencesV1 {
  return {
    schemaVersion: RUNTIME_ACCESSIBILITY_SCHEMA_VERSION,
    subtitles: {
      enabled: overrides.subtitles?.enabled ?? true,
      speakerLabels: overrides.subtitles?.speakerLabels ?? true,
      soundCues: overrides.subtitles?.soundCues ?? true,
      textScale: overrides.subtitles?.textScale ?? 1,
      maxLines: overrides.subtitles?.maxLines ?? 3,
    },
    motion: { preference: overrides.motion?.preference ?? 'system' },
    gore: { mode: overrides.gore?.mode ?? 'reduced' },
  };
}

export function validateRuntimeAccessibilityPreferences(input: unknown): AccessibilityValidationReport {
  const issues: AccessibilityValidationIssue[] = [];
  const add = (code: AccessibilityValidationCode, path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  if (!isRecord(input)) {
    add('invalid-preferences', '$', 'Runtime accessibility preferences must be an object.');
    return { valid: false, issues };
  }
  if (input.schemaVersion !== RUNTIME_ACCESSIBILITY_SCHEMA_VERSION) {
    add('unsupported-version', '$.schemaVersion', 'Only runtime accessibility schema version 1 is supported.');
  }

  if (!isRecord(input.subtitles)) {
    add('invalid-subtitles', '$.subtitles', 'Subtitle preferences must be an object.');
  } else {
    const subtitles = input.subtitles;
    if (typeof subtitles.enabled !== 'boolean') {
      add('invalid-subtitles', '$.subtitles.enabled', 'enabled must be a boolean.');
    }
    if (typeof subtitles.speakerLabels !== 'boolean') {
      add('invalid-subtitles', '$.subtitles.speakerLabels', 'speakerLabels must be a boolean.');
    }
    if (typeof subtitles.soundCues !== 'boolean') {
      add('invalid-subtitles', '$.subtitles.soundCues', 'soundCues must be a boolean.');
    }
    if (typeof subtitles.textScale !== 'number' || !Number.isFinite(subtitles.textScale)
      || subtitles.textScale < 0.75 || subtitles.textScale > 2) {
      add('invalid-subtitles', '$.subtitles.textScale', 'textScale must be between 0.75 and 2.');
    }
    if (!Number.isInteger(subtitles.maxLines) || (subtitles.maxLines as number) < 1
      || (subtitles.maxLines as number) > 4) {
      add('invalid-subtitles', '$.subtitles.maxLines', 'maxLines must be an integer from 1 to 4.');
    }
  }

  if (!isRecord(input.motion) || !isMotionPreference(input.motion.preference)) {
    add('invalid-motion', '$.motion.preference', 'Motion preference must be system, reduce, or full.');
  }
  if (!isRecord(input.gore) || !isGoreMode(input.gore.mode)) {
    add('invalid-gore', '$.gore.mode', 'Gore mode must be full, reduced, or off.');
  }

  return { valid: issues.length === 0, issues };
}

export function resolveMotionPolicy(
  preference: MotionPreference,
  systemPrefersReducedMotion: boolean,
): ResolvedMotionPolicy {
  const reduced = preference === 'reduce' || (preference === 'system' && systemPrefersReducedMotion);
  return reduced
    ? {
      reduced: true,
      cameraShake: false,
      parallax: false,
      decorativeLoops: false,
      transitionDurationScale: 0.2,
      preserveEssentialStateChanges: true,
    }
    : {
      reduced: false,
      cameraShake: true,
      parallax: true,
      decorativeLoops: true,
      transitionDurationScale: 1,
      preserveEssentialStateChanges: true,
    };
}

/** Ensures gore-off never removes the only gameplay or accessibility cue. */
export function validateGoreVariantSet(input: unknown): GoreVariantValidationReport {
  const issues: GoreVariantValidationIssue[] = [];
  const add = (
    severity: GoreVariantValidationIssue['severity'],
    code: GoreVariantValidationCode,
    path: string,
    message: string,
  ): void => {
    issues.push({ severity, code, path, message });
  };

  if (!isRecord(input)) {
    add('error', 'invalid-variant-set', '$', 'Gore variant set must be an object.');
    return { valid: false, issues };
  }
  if (input.schemaVersion !== GORE_VARIANT_SCHEMA_VERSION) {
    add('error', 'unsupported-version', '$.schemaVersion', 'Only gore variant schema version 1 is supported.');
  }
  if (typeof input.id !== 'string' || !SAFE_ID.test(input.id)) {
    add('error', 'invalid-id', '$.id', 'Variant set id must be a portable non-empty identifier.');
  }
  if (typeof input.gameplayCritical !== 'boolean') {
    add('error', 'invalid-variant-set', '$.gameplayCritical', 'gameplayCritical must be a boolean.');
  }
  const hasDescription = typeof input.accessibleDescription === 'string'
    && input.accessibleDescription.trim() !== '';
  if (!hasDescription) {
    add('error', 'invalid-description', '$.accessibleDescription', 'An accessible non-graphic description is required.');
  }

  const variants = input.variants;
  if (!isRecord(variants)) {
    add('error', 'invalid-variant-set', '$.variants', 'variants must be an object.');
  } else {
    (['full', 'reduced', 'off'] as const).forEach(mode => {
      const assetId = variants[mode];
      if (assetId !== undefined && (typeof assetId !== 'string' || !SAFE_ID.test(assetId))) {
        add('error', 'invalid-asset-id', `$.variants.${mode}`, 'Asset id must be a portable non-empty identifier.');
      }
    });
    const hasSafeVisual = typeof variants.reduced === 'string' || typeof variants.off === 'string';
    if (!hasSafeVisual) {
      add(
        input.gameplayCritical === true && !hasDescription ? 'error' : 'warning',
        'missing-safe-fallback',
        '$.variants',
        'No reduced/off visual is present; reduced modes will use the accessible description without an image.',
      );
    }
  }

  return { valid: !issues.some(issue => issue.severity === 'error'), issues };
}

/** Selects a visual without ever escalating above the requested gore level. */
export function resolveGoreVariant(variantSet: GoreVariantSetV1, requestedMode: GoreMode): ResolvedGoreVariant {
  const candidates: GoreMode[] = requestedMode === 'full'
    ? ['full', 'reduced', 'off']
    : requestedMode === 'reduced'
      ? ['reduced', 'off']
      : ['off'];
  const sourceMode = candidates.find(mode => Boolean(variantSet.variants[mode])) ?? null;
  const assetId = sourceMode ? variantSet.variants[sourceMode] : undefined;
  return {
    requestedMode,
    sourceMode,
    assetId,
    accessibleDescription: variantSet.accessibleDescription,
    suppressed: assetId === undefined,
  };
}
