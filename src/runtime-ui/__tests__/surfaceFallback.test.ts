import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CANVAS_HTML_FALLBACK_POLICY,
  resolveRuntimeSurface,
  validateCanvasHtmlFallbackPolicy,
} from '../surfaceFallback';

describe('Canvas/HTML fallback contract', () => {
  it('uses Canvas for the playfield and HTML for accessible text', () => {
    expect(validateCanvasHtmlFallbackPolicy(DEFAULT_CANVAS_HTML_FALLBACK_POLICY)).toEqual({
      valid: true,
      issues: [],
    });
    expect(resolveRuntimeSurface(DEFAULT_CANVAS_HTML_FALLBACK_POLICY, { canvas2d: true, html: true })).toEqual({
      mode: 'canvas-with-html-ui',
      playable: true,
      playfield: 'canvas',
      textUi: 'html',
      reason: 'preferred',
    });
  });

  it('shows a non-playable HTML recovery status when Canvas is absent by default', () => {
    expect(resolveRuntimeSurface(DEFAULT_CANVAS_HTML_FALLBACK_POLICY, { canvas2d: false, html: true })).toEqual({
      mode: 'html-status',
      playable: false,
      playfield: null,
      textUi: 'html',
      reason: 'canvas-unavailable',
    });
  });

  it('supports an explicitly authored interactive HTML fallback', () => {
    const policy = {
      ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY,
      htmlFallback: { ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY.htmlFallback, mode: 'interactive' as const },
    };
    expect(resolveRuntimeSurface(policy, { canvas2d: false, html: true })).toMatchObject({
      mode: 'html-interactive',
      playable: true,
      playfield: 'html',
    });
  });

  it('does not silently fall back to inaccessible Canvas-only text', () => {
    expect(resolveRuntimeSurface(DEFAULT_CANVAS_HTML_FALLBACK_POLICY, { canvas2d: true, html: false })).toMatchObject({
      mode: 'unavailable',
      reason: 'html-required',
    });
  });

  it('requires accessible copy for every enabled HTML fallback', () => {
    const report = validateCanvasHtmlFallbackPolicy({
      ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY,
      htmlFallback: {
        ...DEFAULT_CANVAS_HTML_FALLBACK_POLICY.htmlFallback,
        label: '',
        instructions: '',
      },
    });
    expect(report.valid).toBe(false);
    expect(report.issues.filter(issue => issue.code === 'invalid-fallback-copy')).toHaveLength(2);
  });
});
