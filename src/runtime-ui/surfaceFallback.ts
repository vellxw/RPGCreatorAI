export const SURFACE_FALLBACK_POLICY_SCHEMA_VERSION = 1 as const;

export type HtmlFallbackMode = 'interactive' | 'status-only' | 'disabled';

export interface CanvasHtmlFallbackPolicyV1 {
  schemaVersion: typeof SURFACE_FALLBACK_POLICY_SCHEMA_VERSION;
  preferredPlayfield: 'canvas' | 'html';
  /** Text-heavy controls and subtitles should normally remain in accessible DOM. */
  requireHtmlTextUi: boolean;
  htmlFallback: {
    mode: HtmlFallbackMode;
    label: string;
    instructions: string;
    liveRegion: 'polite' | 'assertive';
  };
}

export interface RuntimeSurfaceCapabilities {
  canvas2d: boolean;
  html: boolean;
}

export type RuntimeSurfaceMode =
  | 'canvas-with-html-ui'
  | 'canvas-only'
  | 'html-interactive'
  | 'html-status'
  | 'unavailable';

export interface RuntimeSurfaceResolution {
  mode: RuntimeSurfaceMode;
  playable: boolean;
  playfield: 'canvas' | 'html' | null;
  textUi: 'html' | 'canvas' | null;
  reason: 'preferred' | 'canvas-unavailable' | 'html-required' | 'no-supported-surface';
}

export interface SurfaceFallbackValidationIssue {
  code: 'invalid-policy' | 'unsupported-version' | 'invalid-fallback-copy';
  path: string;
  message: string;
}

export interface SurfaceFallbackValidationReport {
  valid: boolean;
  issues: SurfaceFallbackValidationIssue[];
}

export const DEFAULT_CANVAS_HTML_FALLBACK_POLICY: CanvasHtmlFallbackPolicyV1 = Object.freeze({
  schemaVersion: SURFACE_FALLBACK_POLICY_SCHEMA_VERSION,
  preferredPlayfield: 'canvas',
  requireHtmlTextUi: true,
  htmlFallback: {
    mode: 'status-only',
    label: 'Game view unavailable',
    instructions: 'Canvas could not start. Review graphics settings or use a supported browser.',
    liveRegion: 'assertive',
  },
}) as CanvasHtmlFallbackPolicyV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateCanvasHtmlFallbackPolicy(input: unknown): SurfaceFallbackValidationReport {
  const issues: SurfaceFallbackValidationIssue[] = [];
  const add = (code: SurfaceFallbackValidationIssue['code'], path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  if (!isRecord(input)) {
    add('invalid-policy', '$', 'Surface fallback policy must be an object.');
    return { valid: false, issues };
  }
  if (input.schemaVersion !== SURFACE_FALLBACK_POLICY_SCHEMA_VERSION) {
    add('unsupported-version', '$.schemaVersion', 'Only surface fallback policy version 1 is supported.');
  }
  if (input.preferredPlayfield !== 'canvas' && input.preferredPlayfield !== 'html') {
    add('invalid-policy', '$.preferredPlayfield', 'preferredPlayfield must be canvas or html.');
  }
  if (typeof input.requireHtmlTextUi !== 'boolean') {
    add('invalid-policy', '$.requireHtmlTextUi', 'requireHtmlTextUi must be a boolean.');
  }
  if (!isRecord(input.htmlFallback)) {
    add('invalid-policy', '$.htmlFallback', 'htmlFallback must be an object.');
  } else {
    const fallback = input.htmlFallback;
    if (fallback.mode !== 'interactive' && fallback.mode !== 'status-only' && fallback.mode !== 'disabled') {
      add('invalid-policy', '$.htmlFallback.mode', 'Fallback mode must be interactive, status-only, or disabled.');
    }
    if (fallback.liveRegion !== 'polite' && fallback.liveRegion !== 'assertive') {
      add('invalid-policy', '$.htmlFallback.liveRegion', 'liveRegion must be polite or assertive.');
    }
    if (fallback.mode !== 'disabled') {
      if (typeof fallback.label !== 'string' || fallback.label.trim() === '') {
        add('invalid-fallback-copy', '$.htmlFallback.label', 'Enabled HTML fallback requires an accessible label.');
      }
      if (typeof fallback.instructions !== 'string' || fallback.instructions.trim() === '') {
        add('invalid-fallback-copy', '$.htmlFallback.instructions', 'Enabled HTML fallback requires recovery instructions.');
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Selects a playfield/text surface without probing the DOM or mutating renderer state. */
export function resolveRuntimeSurface(
  policy: CanvasHtmlFallbackPolicyV1,
  capabilities: RuntimeSurfaceCapabilities,
): RuntimeSurfaceResolution {
  if (policy.preferredPlayfield === 'html' && capabilities.html) {
    return {
      mode: 'html-interactive',
      playable: true,
      playfield: 'html',
      textUi: 'html',
      reason: 'preferred',
    };
  }

  if (capabilities.canvas2d) {
    if (policy.requireHtmlTextUi && !capabilities.html) {
      return {
        mode: 'unavailable',
        playable: false,
        playfield: null,
        textUi: null,
        reason: 'html-required',
      };
    }
    return {
      mode: capabilities.html ? 'canvas-with-html-ui' : 'canvas-only',
      playable: true,
      playfield: 'canvas',
      textUi: capabilities.html ? 'html' : 'canvas',
      reason: 'preferred',
    };
  }

  if (capabilities.html && policy.htmlFallback.mode !== 'disabled') {
    const interactive = policy.htmlFallback.mode === 'interactive';
    return {
      mode: interactive ? 'html-interactive' : 'html-status',
      playable: interactive,
      playfield: interactive ? 'html' : null,
      textUi: 'html',
      reason: 'canvas-unavailable',
    };
  }

  return {
    mode: 'unavailable',
    playable: false,
    playfield: null,
    textUi: null,
    reason: 'no-supported-surface',
  };
}
