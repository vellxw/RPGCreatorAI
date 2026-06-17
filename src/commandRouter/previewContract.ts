/**
 * Phase 12 M03 — Preview Before Apply Contract (PX-082, FRA-516).
 *
 * Defines the preview action contract that every mutation intent must satisfy
 * before any apply behavior can run. The router guard fails closed: a mutation
 * intent without a valid preview cannot be applied.
 */

import {
  hasApplyablePreview,
  isMutationIntent,
  type CommandRouterIntent,
  type MutationIntent,
  type RouterPreviewInvalid,
  type AnyRouterPreview,
} from './intentContract';

export const PREVIEW_BEFORE_APPLY_VERSION = '1.0.0';

export interface ApplyGuardResult {
  ok: boolean;
  reasons: string[];
  fixGuidance: string[];
}

const BASE_REASONS = [
  'Apply is blocked because the router intent is not a mutation intent.',
];

const BASE_GUIDANCE = [
  'Route the request through the command router before any apply step.',
];

export function mutationGuard(intent: CommandRouterIntent): ApplyGuardResult {
  if (!isMutationIntent(intent)) {
    return {
      ok: false,
      reasons: BASE_REASONS,
      fixGuidance: BASE_GUIDANCE,
    };
  }
  if (!hasApplyablePreview(intent)) {
    return {
      ok: false,
      reasons: ['Apply is blocked because the mutation intent has no valid preview.'],
      fixGuidance: [
        'Build a preview action for this mutation intent before any apply step.',
        'Re-run the intent and verify the preview has a stable previewId and non-empty summary.',
      ],
    };
  }
  return { ok: true, reasons: [], fixGuidance: [] };
}

export function isApplyable(intent: CommandRouterIntent): intent is MutationIntent {
  return mutationGuard(intent).ok;
}

export function asInvalidPreview(
  preview: AnyRouterPreview,
): preview is RouterPreviewInvalid {
  return 'invalid' in preview && preview.invalid === true;
}

export function previewSummary(preview: AnyRouterPreview): string {
  if ('invalid' in preview && preview.invalid) {
    return `Preview invalid: ${preview.reasons.join('; ')}`;
  }
  return preview.summary;
}

export function previewIsEquivalent(a: AnyRouterPreview, b: AnyRouterPreview): boolean {
  return a.previewId === b.previewId;
}
