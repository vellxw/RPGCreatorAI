import { describe, expect, it } from 'vitest';
import {
  ANDROID_APP_ASSET_ORIGIN,
  ANDROID_OFFLINE_CONTENT_SECURITY_POLICY,
  ANDROID_OFFLINE_START_URL,
  createAndroidOfflineWrapperConfig,
  isAllowlistedAndroidOfflineRequest,
  validateAndroidOfflineWrapperConfig,
} from '../offlineWrapper';

describe('Android offline wrapper contract', () => {
  it('creates a strict synthetic-HTTPS WebView configuration', () => {
    const config = createAndroidOfflineWrapperConfig({ language: 'es-AR' });
    expect(config.startUrl).toBe(ANDROID_OFFLINE_START_URL);
    expect(config.requests).toEqual({
      origin: ANDROID_APP_ASSET_ORIGIN,
      assetPathPrefix: '/assets/www/',
      blockUnmatchedRequests: true,
      externalNavigation: 'block',
    });
    expect(config.webView).toMatchObject({
      allowFileAccess: false,
      allowContentAccess: false,
      mixedContentMode: 'never',
      thirdPartyCookiesEnabled: false,
      mediaPlaybackRequiresUserGesture: true,
    });
    expect(validateAndroidOfflineWrapperConfig(config)).toEqual({ valid: true, issues: [] });
  });

  it('ships CSP as a response header without network or dynamic-code sources', () => {
    const config = createAndroidOfflineWrapperConfig();
    expect(config.responseHeaders['Content-Security-Policy']).toBe(ANDROID_OFFLINE_CONTENT_SECURITY_POLICY);
    expect(ANDROID_OFFLINE_CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(ANDROID_OFFLINE_CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(ANDROID_OFFLINE_CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
    expect(ANDROID_OFFLINE_CONTENT_SECURITY_POLICY).not.toContain('https:');
    expect(config.responseHeaders['X-Content-Type-Options']).toBe('nosniff');
  });

  it('serves only exact packaged files below the synthetic assets/www prefix', () => {
    const allowlist = ['index.html', 'assets/runtime.js', 'assets/media/voice.opus'];
    expect(isAllowlistedAndroidOfflineRequest(ANDROID_OFFLINE_START_URL, allowlist)).toBe(true);
    expect(isAllowlistedAndroidOfflineRequest(
      `${ANDROID_APP_ASSET_ORIGIN}/assets/www/assets/media/voice.opus`,
      allowlist,
    )).toBe(true);
    expect(isAllowlistedAndroidOfflineRequest(
      `${ANDROID_APP_ASSET_ORIGIN}/assets/www/assets/missing.js`,
      allowlist,
    )).toBe(false);
    expect(isAllowlistedAndroidOfflineRequest(
      `${ANDROID_APP_ASSET_ORIGIN}/assets/runtime.js`,
      allowlist,
    )).toBe(false);
    expect(isAllowlistedAndroidOfflineRequest(
      `${ANDROID_APP_ASSET_ORIGIN}/assets/www/%2e%2e/runtime.js`,
      allowlist,
    )).toBe(false);
    expect(isAllowlistedAndroidOfflineRequest(`${ANDROID_OFFLINE_START_URL}?remote=1`, allowlist)).toBe(false);
  });

  it('connects player accessibility preferences to an HTML subtitle/recovery surface', () => {
    const config = createAndroidOfflineWrapperConfig({
      language: 'es-AR',
      accessibility: {
        motion: { preference: 'reduce' },
        gore: { mode: 'off' },
        subtitles: { enabled: true, soundCues: true },
      },
    });
    expect(config.accessibility).toMatchObject({
      motion: { preference: 'reduce' },
      gore: { mode: 'off' },
      subtitles: { enabled: true, soundCues: true },
    });
    expect(config.documentAccessibility).toMatchObject({
      language: 'es-AR',
      subtitleSurface: 'html',
      honorPrefersReducedMotion: true,
      allowSystemTextScaling: true,
      minimumTouchTargetDp: 48,
    });
    expect(config.surfaceFallback.requireHtmlTextUi).toBe(true);
    expect(validateAndroidOfflineWrapperConfig(config).valid).toBe(true);
  });

  it('rejects file/content access, remote navigation, and broad script CSP', () => {
    const config = createAndroidOfflineWrapperConfig() as unknown as Record<string, unknown>;
    config.startUrl = 'file:///android_asset/www/index.html';
    config.webView = {
      ...(config.webView as Record<string, unknown>),
      allowFileAccess: true,
      allowContentAccess: true,
    };
    config.requests = {
      ...(config.requests as Record<string, unknown>),
      externalNavigation: 'allow',
      blockUnmatchedRequests: false,
    };
    config.responseHeaders = {
      ...(config.responseHeaders as Record<string, unknown>),
      'Content-Security-Policy': "default-src *; script-src 'self' 'unsafe-eval' https:",
    };

    const report = validateAndroidOfflineWrapperConfig(config);
    expect(report.valid).toBe(false);
    expect(report.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'unsafe-start-url',
      'unsafe-webview-setting',
      'unsafe-request-policy',
      'unsafe-csp',
    ]));
  });

  it('rejects Canvas-only captions and inaccessible Android touch sizing', () => {
    const config = createAndroidOfflineWrapperConfig() as unknown as Record<string, unknown>;
    config.documentAccessibility = {
      ...(config.documentAccessibility as Record<string, unknown>),
      subtitleSurface: 'canvas',
      honorPrefersReducedMotion: false,
      minimumTouchTargetDp: 32,
    };
    config.surfaceFallback = {
      ...(config.surfaceFallback as Record<string, unknown>),
      requireHtmlTextUi: false,
    };
    const report = validateAndroidOfflineWrapperConfig(config);
    expect(report.valid).toBe(false);
    expect(report.issues.filter(issue => issue.code === 'invalid-accessibility')).toHaveLength(3);
    expect(report.issues.map(issue => issue.code)).toContain('invalid-surface-fallback');
  });
});
