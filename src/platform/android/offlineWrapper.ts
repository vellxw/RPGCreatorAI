import {
  DEFAULT_AUDIO_FOCUS_POLICY,
  validateAudioFocusPolicy,
  type AudioFocusPolicyV1,
} from '../../media/audioFocus';
import {
  createRuntimeAccessibilityPreferences,
  validateRuntimeAccessibilityPreferences,
  type RuntimeAccessibilityOverrides,
  type RuntimeAccessibilityPreferencesV1,
} from '../../runtime-ui/accessibilityContracts';
import {
  DEFAULT_CANVAS_HTML_FALLBACK_POLICY,
  validateCanvasHtmlFallbackPolicy,
  type CanvasHtmlFallbackPolicyV1,
} from '../../runtime-ui/surfaceFallback';
import { portablePathViolation } from '../../utils/packageSecurity';

export const ANDROID_OFFLINE_WRAPPER_SCHEMA_VERSION = 1 as const;
export const ANDROID_APP_ASSET_ORIGIN = 'https://appassets.androidplatform.net' as const;
export const ANDROID_APP_ASSET_PREFIX = '/assets/www/' as const;
export const ANDROID_OFFLINE_START_URL = `${ANDROID_APP_ASSET_ORIGIN}${ANDROID_APP_ASSET_PREFIX}index.html` as const;

/**
 * This CSP is intended for the response header of the synthetic HTTPS entry
 * document. `frame-ancestors` is not enforced when delivered only by a meta tag.
 */
export const ANDROID_OFFLINE_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

export interface AndroidOfflineWebViewSettingsV1 {
  javaScriptEnabled: true;
  javaScriptCanOpenWindowsAutomatically: false;
  domStorageEnabled: true;
  blockNetworkLoads: true;
  webContentsDebuggingEnabled: false;
  allowFileAccess: false;
  allowContentAccess: false;
  allowFileAccessFromFileUrls: false;
  allowUniversalAccessFromFileUrls: false;
  mixedContentMode: 'never';
  mediaPlaybackRequiresUserGesture: true;
  safeBrowsingEnabled: true;
  thirdPartyCookiesEnabled: false;
  multipleWindowsEnabled: false;
}

export interface AndroidOfflineRequestPolicyV1 {
  origin: typeof ANDROID_APP_ASSET_ORIGIN;
  assetPathPrefix: typeof ANDROID_APP_ASSET_PREFIX;
  blockUnmatchedRequests: true;
  externalNavigation: 'block';
}

export interface AndroidOfflineDocumentAccessibilityV1 {
  language: string;
  subtitleSurface: 'html';
  statusLiveRegion: 'polite';
  honorPrefersReducedMotion: true;
  allowSystemTextScaling: true;
  minimumTouchTargetDp: number;
}

export interface AndroidOfflineWrapperConfigV1 {
  schemaVersion: typeof ANDROID_OFFLINE_WRAPPER_SCHEMA_VERSION;
  startUrl: typeof ANDROID_OFFLINE_START_URL;
  webView: AndroidOfflineWebViewSettingsV1;
  requests: AndroidOfflineRequestPolicyV1;
  responseHeaders: {
    'Content-Security-Policy': string;
    'X-Content-Type-Options': 'nosniff';
    'Referrer-Policy': 'no-referrer';
    'Permissions-Policy': string;
  };
  accessibility: RuntimeAccessibilityPreferencesV1;
  documentAccessibility: AndroidOfflineDocumentAccessibilityV1;
  audioFocus: AudioFocusPolicyV1;
  surfaceFallback: CanvasHtmlFallbackPolicyV1;
}

export interface AndroidOfflineWrapperOptions {
  language?: string;
  accessibility?: RuntimeAccessibilityOverrides;
}

export type AndroidOfflineWrapperIssueCode =
  | 'invalid-config'
  | 'unsupported-version'
  | 'unsafe-start-url'
  | 'unsafe-webview-setting'
  | 'unsafe-request-policy'
  | 'unsafe-response-header'
  | 'unsafe-csp'
  | 'invalid-accessibility'
  | 'invalid-audio-focus'
  | 'invalid-surface-fallback';

export interface AndroidOfflineWrapperIssue {
  code: AndroidOfflineWrapperIssueCode;
  path: string;
  message: string;
}

export interface AndroidOfflineWrapperValidationReport {
  valid: boolean;
  issues: AndroidOfflineWrapperIssue[];
}

const LANGUAGE_TAG = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const ANDROID_OFFLINE_ASSET_EXTENSIONS = [
  '.html', '.js', '.mjs', '.css', '.json', '.wasm', '.webmanifest',
  '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.svg', '.webp',
  '.aac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.opus', '.wav',
  '.m4v', '.mp4', '.ogv', '.webm', '.srt', '.vtt',
  '.otf', '.ttf', '.woff', '.woff2',
] as const;

/**
 * Native request interception must call the equivalent of this predicate
 * before WebViewAssetLoader serves bytes. The allowlist is the exhaustive set
 * emitted by the release packager, using paths relative to assets/www/.
 */
export function isAllowlistedAndroidOfflineRequest(
  requestUrl: string,
  assetAllowlist: readonly string[],
): boolean {
  if (typeof requestUrl !== 'string'
    || requestUrl.length > 2048
    || requestUrl.includes('\\')
    || /(?:^|\/)\.{1,2}(?:\/|[?#]|$)/.test(requestUrl)
    || /%[0-9a-f]{2}/i.test(requestUrl)) return false;

  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }
  if (parsed.origin !== ANDROID_APP_ASSET_ORIGIN
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.search !== ''
    || parsed.hash !== ''
    || !parsed.pathname.startsWith(ANDROID_APP_ASSET_PREFIX)) return false;

  const relativePath = parsed.pathname.slice(ANDROID_APP_ASSET_PREFIX.length);
  if (!/^[A-Za-z0-9._~/-]+$/.test(relativePath)) return false;
  const violation = portablePathViolation(relativePath, {
    allowBackslashes: false,
    allowedExtensions: ANDROID_OFFLINE_ASSET_EXTENSIONS,
    maxLength: 512,
  });
  if (violation || (relativePath.toLowerCase().endsWith('.html') && relativePath !== 'index.html')) {
    return false;
  }
  return assetAllowlist.some(candidate => candidate === relativePath
    && portablePathViolation(candidate, {
      allowBackslashes: false,
      allowedExtensions: ANDROID_OFFLINE_ASSET_EXTENSIONS,
      maxLength: 512,
    }) === null);
}

export function createAndroidOfflineWrapperConfig(
  options: AndroidOfflineWrapperOptions = {},
): AndroidOfflineWrapperConfigV1 {
  return {
    schemaVersion: ANDROID_OFFLINE_WRAPPER_SCHEMA_VERSION,
    startUrl: ANDROID_OFFLINE_START_URL,
    webView: {
      javaScriptEnabled: true,
      javaScriptCanOpenWindowsAutomatically: false,
      domStorageEnabled: true,
      blockNetworkLoads: true,
      webContentsDebuggingEnabled: false,
      allowFileAccess: false,
      allowContentAccess: false,
      allowFileAccessFromFileUrls: false,
      allowUniversalAccessFromFileUrls: false,
      mixedContentMode: 'never',
      mediaPlaybackRequiresUserGesture: true,
      safeBrowsingEnabled: true,
      thirdPartyCookiesEnabled: false,
      multipleWindowsEnabled: false,
    },
    requests: {
      origin: ANDROID_APP_ASSET_ORIGIN,
      assetPathPrefix: ANDROID_APP_ASSET_PREFIX,
      blockUnmatchedRequests: true,
      externalNavigation: 'block',
    },
    responseHeaders: {
      'Content-Security-Policy': ANDROID_OFFLINE_CONTENT_SECURITY_POLICY,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    accessibility: createRuntimeAccessibilityPreferences(options.accessibility),
    documentAccessibility: {
      language: options.language?.trim() || 'en',
      subtitleSurface: 'html',
      statusLiveRegion: 'polite',
      honorPrefersReducedMotion: true,
      allowSystemTextScaling: true,
      minimumTouchTargetDp: 48,
    },
    audioFocus: { ...DEFAULT_AUDIO_FOCUS_POLICY },
    surfaceFallback: {
      ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY,
      htmlFallback: { ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY.htmlFallback },
    },
  };
}

/**
 * Fail-closed validation for config that will be translated to native WebView
 * settings. It deliberately disallows file/content access: saves cross the
 * typed AndroidSaveBridge instead of exposing arbitrary Android URIs to JS.
 */
export function validateAndroidOfflineWrapperConfig(input: unknown): AndroidOfflineWrapperValidationReport {
  const issues: AndroidOfflineWrapperIssue[] = [];
  const add = (code: AndroidOfflineWrapperIssueCode, path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  if (!isRecord(input)) {
    add('invalid-config', '$', 'Android offline wrapper config must be an object.');
    return { valid: false, issues };
  }
  reportUnknownKeys(input, [
    'schemaVersion',
    'startUrl',
    'webView',
    'requests',
    'responseHeaders',
    'accessibility',
    'documentAccessibility',
    'audioFocus',
    'surfaceFallback',
  ], '$', add);
  if (input.schemaVersion !== ANDROID_OFFLINE_WRAPPER_SCHEMA_VERSION) {
    add('unsupported-version', '$.schemaVersion', 'Only Android offline wrapper schema version 1 is supported.');
  }
  if (input.startUrl !== ANDROID_OFFLINE_START_URL) {
    add('unsafe-start-url', '$.startUrl', `Start URL must be ${ANDROID_OFFLINE_START_URL}.`);
  }

  validateWebViewSettings(input.webView, add);
  validateRequestPolicy(input.requests, add);
  validateResponseHeaders(input.responseHeaders, add);

  const accessibility = validateRuntimeAccessibilityPreferences(input.accessibility);
  accessibility.issues.forEach(issue => {
    add('invalid-accessibility', `$.accessibility${withoutRoot(issue.path)}`, issue.message);
  });

  if (!isRecord(input.documentAccessibility)) {
    add('invalid-accessibility', '$.documentAccessibility', 'Document accessibility contract must be an object.');
  } else {
    const contract = input.documentAccessibility;
    reportUnknownKeys(contract, [
      'language',
      'subtitleSurface',
      'statusLiveRegion',
      'honorPrefersReducedMotion',
      'allowSystemTextScaling',
      'minimumTouchTargetDp',
    ], '$.documentAccessibility', add);
    if (typeof contract.language !== 'string' || !LANGUAGE_TAG.test(contract.language.trim())) {
      add('invalid-accessibility', '$.documentAccessibility.language', 'Document language must be a BCP-47-style tag.');
    }
    if (contract.subtitleSurface !== 'html') {
      add('invalid-accessibility', '$.documentAccessibility.subtitleSurface', 'Subtitles must render in accessible HTML.');
    }
    if (contract.statusLiveRegion !== 'polite') {
      add('invalid-accessibility', '$.documentAccessibility.statusLiveRegion', 'Routine runtime status must use a polite live region.');
    }
    if (contract.honorPrefersReducedMotion !== true) {
      add('invalid-accessibility', '$.documentAccessibility.honorPrefersReducedMotion', 'Web content must honor prefers-reduced-motion.');
    }
    if (contract.allowSystemTextScaling !== true) {
      add('invalid-accessibility', '$.documentAccessibility.allowSystemTextScaling', 'Web content must allow Android system text scaling.');
    }
    if (!Number.isFinite(contract.minimumTouchTargetDp) || (contract.minimumTouchTargetDp as number) < 48) {
      add('invalid-accessibility', '$.documentAccessibility.minimumTouchTargetDp', 'Touch targets must be at least 48 dp.');
    }
  }

  const audioFocus = validateAudioFocusPolicy(input.audioFocus);
  audioFocus.issues.forEach(issue => {
    add('invalid-audio-focus', `$.audioFocus${withoutRoot(issue.path)}`, issue.message);
  });
  const surfaceFallback = validateCanvasHtmlFallbackPolicy(input.surfaceFallback);
  surfaceFallback.issues.forEach(issue => {
    add('invalid-surface-fallback', `$.surfaceFallback${withoutRoot(issue.path)}`, issue.message);
  });
  if (isRecord(input.surfaceFallback) && input.surfaceFallback.requireHtmlTextUi !== true) {
    add('invalid-surface-fallback', '$.surfaceFallback.requireHtmlTextUi', 'Android wrapper requires HTML text UI for captions and recovery.');
  }
  if (isRecord(input.surfaceFallback) && isRecord(input.surfaceFallback.htmlFallback)
    && input.surfaceFallback.htmlFallback.mode === 'disabled') {
    add('invalid-surface-fallback', '$.surfaceFallback.htmlFallback.mode', 'Android wrapper requires an HTML renderer recovery surface.');
  }

  return { valid: issues.length === 0, issues };
}

function validateWebViewSettings(
  value: unknown,
  add: (code: AndroidOfflineWrapperIssueCode, path: string, message: string) => void,
): void {
  if (!isRecord(value)) {
    add('unsafe-webview-setting', '$.webView', 'WebView settings must be an object.');
    return;
  }
  const expected: Record<keyof AndroidOfflineWebViewSettingsV1, unknown> = {
    javaScriptEnabled: true,
    javaScriptCanOpenWindowsAutomatically: false,
    domStorageEnabled: true,
    blockNetworkLoads: true,
    webContentsDebuggingEnabled: false,
    allowFileAccess: false,
    allowContentAccess: false,
    allowFileAccessFromFileUrls: false,
    allowUniversalAccessFromFileUrls: false,
    mixedContentMode: 'never',
    mediaPlaybackRequiresUserGesture: true,
    safeBrowsingEnabled: true,
    thirdPartyCookiesEnabled: false,
    multipleWindowsEnabled: false,
  };
  Object.entries(expected).forEach(([key, expectedValue]) => {
    if (value[key] !== expectedValue) {
      add('unsafe-webview-setting', `$.webView.${key}`, `WebView ${key} must be ${JSON.stringify(expectedValue)}.`);
    }
  });
  Object.keys(value).filter(key => !(key in expected)).forEach(key => {
    add('unsafe-webview-setting', `$.webView.${key}`, 'Unknown WebView settings are rejected by the offline contract.');
  });
}

function validateRequestPolicy(
  value: unknown,
  add: (code: AndroidOfflineWrapperIssueCode, path: string, message: string) => void,
): void {
  if (!isRecord(value)) {
    add('unsafe-request-policy', '$.requests', 'Request policy must be an object.');
    return;
  }
  reportUnknownKeys(value, [
    'origin',
    'assetPathPrefix',
    'blockUnmatchedRequests',
    'externalNavigation',
  ], '$.requests', add);
  if (value.origin !== ANDROID_APP_ASSET_ORIGIN) {
    add('unsafe-request-policy', '$.requests.origin', 'Only the reserved appassets HTTPS origin is allowed.');
  }
  if (value.assetPathPrefix !== ANDROID_APP_ASSET_PREFIX) {
    add('unsafe-request-policy', '$.requests.assetPathPrefix', `Asset path prefix must be ${ANDROID_APP_ASSET_PREFIX}.`);
  }
  if (value.blockUnmatchedRequests !== true) {
    add('unsafe-request-policy', '$.requests.blockUnmatchedRequests', 'Unmatched WebView requests must be blocked.');
  }
  if (value.externalNavigation !== 'block') {
    add('unsafe-request-policy', '$.requests.externalNavigation', 'External navigation must be blocked.');
  }
}

function validateResponseHeaders(
  value: unknown,
  add: (code: AndroidOfflineWrapperIssueCode, path: string, message: string) => void,
): void {
  if (!isRecord(value)) {
    add('unsafe-response-header', '$.responseHeaders', 'Offline responses require security headers.');
    return;
  }
  reportUnknownKeys(value, [
    'Content-Security-Policy',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ], '$.responseHeaders', add);
  validateOfflineCsp(value['Content-Security-Policy'], add);
  if (value['X-Content-Type-Options'] !== 'nosniff') {
    add('unsafe-response-header', '$.responseHeaders.X-Content-Type-Options', 'X-Content-Type-Options must be nosniff.');
  }
  if (value['Referrer-Policy'] !== 'no-referrer') {
    add('unsafe-response-header', '$.responseHeaders.Referrer-Policy', 'Referrer-Policy must be no-referrer.');
  }
  if (value['Permissions-Policy'] !== 'camera=(), microphone=(), geolocation=(), payment=(), usb=()') {
    add('unsafe-response-header', '$.responseHeaders.Permissions-Policy', 'Permissions-Policy must disable unused device capabilities.');
  }
}

function validateOfflineCsp(
  value: unknown,
  add: (code: AndroidOfflineWrapperIssueCode, path: string, message: string) => void,
): void {
  if (typeof value !== 'string') {
    add('unsafe-csp', '$.responseHeaders.Content-Security-Policy', 'Content-Security-Policy must be a string.');
    return;
  }
  if (value !== ANDROID_OFFLINE_CONTENT_SECURITY_POLICY) {
    add('unsafe-csp', '$.responseHeaders.Content-Security-Policy', 'CSP must exactly match the immutable offline policy; extra sources and directives are forbidden.');
  }
  const directives = parseCsp(value);
  const requireExact = (name: string, expected: readonly string[]): void => {
    const actual = directives.get(name);
    if (!actual || actual.length !== expected.length || expected.some(token => !actual.includes(token))) {
      add('unsafe-csp', `$.responseHeaders.Content-Security-Policy.${name}`, `${name} must be ${expected.join(' ')}.`);
    }
  };
  requireExact('default-src', ["'none'"]);
  requireExact('base-uri', ["'none'"]);
  requireExact('object-src', ["'none'"]);
  requireExact('frame-ancestors', ["'none'"]);
  requireExact('form-action', ["'none'"]);
  requireExact('script-src', ["'self'"]);
  requireExact('connect-src', ["'self'"]);

  const isForbiddenSource = (token: string): boolean => token === "'unsafe-eval'"
    || token === '*'
    || token.startsWith('//')
    || /^(?:https?|wss?):/i.test(token);
  for (const [directive, tokens] of directives) {
    if (tokens.some(isForbiddenSource)) {
      add('unsafe-csp', `$.responseHeaders.Content-Security-Policy.${directive}`, `${directive} enables a network or dynamic-code source.`);
    }
  }
}

function parseCsp(value: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  value.split(';').map(part => part.trim()).filter(Boolean).forEach(part => {
    const [name, ...tokens] = part.split(/\s+/);
    if (name && !directives.has(name)) directives.set(name, tokens);
  });
  return directives;
}

function withoutRoot(path: string): string {
  return path === '$' ? '' : path.startsWith('$.') ? path.slice(1) : `.${path}`;
}

function reportUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  add: (code: AndroidOfflineWrapperIssueCode, path: string, message: string) => void,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      add('invalid-config', `${path}.${key}`, `Unexpected Android wrapper field "${key}".`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
