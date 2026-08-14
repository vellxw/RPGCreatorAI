export const SUBTITLE_TRACK_SCHEMA_VERSION = 1 as const;

export type SubtitleCueKind = 'speech' | 'sound' | 'music';

export interface SubtitleCueV1 {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  kind?: SubtitleCueKind;
  speaker?: string;
  /** Forced cues remain visible even when ordinary speech subtitles are disabled. */
  forced?: boolean;
}

export interface SubtitleTrackV1 {
  schemaVersion: typeof SUBTITLE_TRACK_SCHEMA_VERSION;
  /** BCP-47-style language tag, for example `es-AR` or `en`. */
  language: string;
  label?: string;
  cues: SubtitleCueV1[];
}

export type SubtitleValidationSeverity = 'error' | 'warning';

export type SubtitleValidationCode =
  | 'invalid-track'
  | 'unsupported-version'
  | 'invalid-language'
  | 'invalid-cues'
  | 'invalid-cue'
  | 'invalid-id'
  | 'duplicate-id'
  | 'invalid-timing'
  | 'unsorted-cues'
  | 'overlapping-cues'
  | 'unreadable-duration'
  | 'excessive-lines';

export interface SubtitleValidationIssue {
  severity: SubtitleValidationSeverity;
  code: SubtitleValidationCode;
  path: string;
  message: string;
}

export interface SubtitleValidationReport {
  valid: boolean;
  issues: SubtitleValidationIssue[];
  summary: {
    cues: number;
    errors: number;
    warnings: number;
    durationMs: number;
  };
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const MIN_READABLE_CUE_MS = 500;
const MAX_READABLE_CUE_MS = 15_000;
const MAX_TEXT_LENGTH = 1_000;
const MAX_VISIBLE_LINES = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCueKind(value: unknown): value is SubtitleCueKind {
  return value === 'speech' || value === 'sound' || value === 'music';
}

/** Validates subtitle data at import and packaging boundaries without reading media files. */
export function validateSubtitleTrack(input: unknown): SubtitleValidationReport {
  const issues: SubtitleValidationIssue[] = [];
  const add = (
    severity: SubtitleValidationSeverity,
    code: SubtitleValidationCode,
    path: string,
    message: string,
  ): void => {
    issues.push({ severity, code, path, message });
  };

  if (!isRecord(input)) {
    add('error', 'invalid-track', '$', 'Subtitle track must be an object.');
    return finishReport(issues, 0, 0);
  }

  if (input.schemaVersion !== SUBTITLE_TRACK_SCHEMA_VERSION) {
    add('error', 'unsupported-version', '$.schemaVersion', 'Only subtitle schema version 1 is supported.');
  }
  if (typeof input.language !== 'string' || !LANGUAGE_TAG.test(input.language.trim())) {
    add('error', 'invalid-language', '$.language', 'Language must be a BCP-47-style tag such as "es-AR".');
  }
  if (input.label !== undefined && (typeof input.label !== 'string' || input.label.trim() === '')) {
    add('error', 'invalid-track', '$.label', 'Track label must be a non-empty string when provided.');
  }
  if (!Array.isArray(input.cues)) {
    add('error', 'invalid-cues', '$.cues', 'Subtitle cues must be an array.');
    return finishReport(issues, 0, 0);
  }

  const cueIds = new Set<string>();
  let lastStartMs = -1;
  let lastEndMs = -1;
  let durationMs = 0;

  input.cues.forEach((cue, index) => {
    const path = `$.cues[${index}]`;
    if (!isRecord(cue)) {
      add('error', 'invalid-cue', path, 'Subtitle cue must be an object.');
      return;
    }

    if (typeof cue.id !== 'string' || !SAFE_ID.test(cue.id)) {
      add('error', 'invalid-id', `${path}.id`, 'Cue id must be a portable non-empty identifier.');
    } else if (cueIds.has(cue.id)) {
      add('error', 'duplicate-id', `${path}.id`, `Cue id "${cue.id}" is duplicated.`);
    } else {
      cueIds.add(cue.id);
    }

    const startMs = cue.startMs;
    const endMs = cue.endMs;
    const timingIsValid = isFiniteNonNegative(startMs)
      && isFiniteNonNegative(endMs)
      && endMs > startMs;
    if (!timingIsValid) {
      add('error', 'invalid-timing', path, 'Cue timing requires finite values with endMs greater than startMs.');
    } else {
      const cueDuration = endMs - startMs;
      durationMs = Math.max(durationMs, endMs);
      if (startMs < lastStartMs) {
        add('error', 'unsorted-cues', `${path}.startMs`, 'Cues must be sorted by startMs.');
      }
      if (lastEndMs >= 0 && startMs < lastEndMs) {
        add('warning', 'overlapping-cues', path, 'Cue overlaps the previous cue and may exceed the subtitle line budget.');
      }
      if (cueDuration < MIN_READABLE_CUE_MS || cueDuration > MAX_READABLE_CUE_MS) {
        add(
          'warning',
          'unreadable-duration',
          path,
          `Cue duration should normally be between ${MIN_READABLE_CUE_MS} and ${MAX_READABLE_CUE_MS} ms.`,
        );
      }
      lastStartMs = Math.max(lastStartMs, startMs);
      lastEndMs = Math.max(lastEndMs, endMs);
    }

    if (typeof cue.text !== 'string' || cue.text.trim() === '' || cue.text.length > MAX_TEXT_LENGTH) {
      add('error', 'invalid-cue', `${path}.text`, `Cue text must contain 1 to ${MAX_TEXT_LENGTH} characters.`);
    } else if (cue.text.split(/\r?\n/).length > MAX_VISIBLE_LINES) {
      add('warning', 'excessive-lines', `${path}.text`, `Cue text exceeds the ${MAX_VISIBLE_LINES}-line presentation budget.`);
    }
    if (cue.kind !== undefined && !isCueKind(cue.kind)) {
      add('error', 'invalid-cue', `${path}.kind`, 'Cue kind must be speech, sound, or music.');
    }
    if (cue.speaker !== undefined && (typeof cue.speaker !== 'string' || cue.speaker.trim() === '')) {
      add('error', 'invalid-cue', `${path}.speaker`, 'Speaker must be a non-empty string when provided.');
    }
    if (cue.forced !== undefined && typeof cue.forced !== 'boolean') {
      add('error', 'invalid-cue', `${path}.forced`, 'Forced must be a boolean when provided.');
    }
  });

  return finishReport(issues, input.cues.length, durationMs);
}

function finishReport(
  issues: SubtitleValidationIssue[],
  cues: number,
  durationMs: number,
): SubtitleValidationReport {
  const errors = issues.filter(issue => issue.severity === 'error').length;
  return {
    valid: errors === 0,
    issues,
    summary: {
      cues,
      errors,
      warnings: issues.length - errors,
      durationMs,
    },
  };
}

export function isSubtitleTrackV1(input: unknown): input is SubtitleTrackV1 {
  return validateSubtitleTrack(input).valid;
}
