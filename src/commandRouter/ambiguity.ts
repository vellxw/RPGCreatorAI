/**
 * Phase 12 M03 — Ambiguous Intent Clarification (PX-081, FRA-515).
 *
 * When a creator request cannot be safely routed to one pipeline, the router
 * returns a clarification request instead of guessing. The clarification
 * response is the only "applyable" output an ambiguous request can produce.
 */

import {
  type CommandRouterIntent,
  type CommandRouterPipeline,
  inferPipeline,
  type PreviewOnlyIntent,
  type PreviewTarget,
} from './intentContract';
import { nextIntentId, nextPreviewId } from './intentContract';

export type CommandRouterClarificationOptionId =
  | 'map'
  | 'event'
  | 'database'
  | 'asset-character'
  | 'asset-portrait'
  | 'asset-tileset'
  | 'asset-icon'
  | 'asset-sprite-sheet'
  | 'validation-repair'
  | 'balancing'
  | 'code-assistant'
  | 'review-inbox'
  | 'unsupported';

export interface CommandRouterClarificationOption {
  id: CommandRouterClarificationOptionId;
  label: string;
  detail: string;
  pipeline: CommandRouterPipeline;
}

export interface CommandRouterClarification {
  kind: 'clarification';
  question: string;
  options: CommandRouterClarificationOption[];
  contextMessage: string;
}

export interface CommandRouterAmbiguityThresholds {
  minConfidence: number;
  maxCompetingPipelines: number;
}

export const DEFAULT_AMBIGUITY_THRESHOLDS: CommandRouterAmbiguityThresholds = {
  minConfidence: 0.55,
  maxCompetingPipelines: 1,
};

const OPTIONS: CommandRouterClarificationOption[] = [
  { id: 'map', label: 'Edit or draft a map', detail: 'Generate or repair map tiles, layers, or events.', pipeline: 'map-draft' },
  { id: 'event', label: 'Edit or draft an event', detail: 'Generate or repair event pages and commands.', pipeline: 'event-draft' },
  { id: 'database', label: 'Edit or draft a database record', detail: 'Actors, classes, skills, items, enemies, troops, system.', pipeline: 'database-draft' },
  { id: 'asset-character', label: 'Generate a character sprite sheet', detail: 'Animation sheets, walk cycles, attack frames.', pipeline: 'asset-sprite-sheet' },
  { id: 'asset-portrait', label: 'Generate a portrait', detail: 'Static portrait with a transparent background.', pipeline: 'asset-portrait' },
  { id: 'asset-tileset', label: 'Generate a tileset', detail: 'A tile sheet with seamless edges and consistent palette.', pipeline: 'asset-tileset' },
  { id: 'asset-icon', label: 'Generate an item or skill icon', detail: 'A small icon with a transparent background.', pipeline: 'asset-icon' },
  { id: 'validation-repair', label: 'Repair a validation issue', detail: 'Fix broken references, missing tiles, or unknown commands.', pipeline: 'validation-repair' },
  { id: 'balancing', label: 'Balance an actor or enemy', detail: 'Suggest stat and skill adjustments.', pipeline: 'balancing' },
  { id: 'code-assistant', label: 'Open the code assistant', detail: 'Developer Mode is required. Patches and diffs, not commits.', pipeline: 'code-assistant' },
  { id: 'review-inbox', label: 'Open the review inbox', detail: 'Show the candidate inbox for this project.', pipeline: 'review-inbox' },
];

export function listClarificationOptions(): readonly CommandRouterClarificationOption[] {
  return OPTIONS;
}

export function findOptionByPipeline(
  pipeline: CommandRouterPipeline,
): CommandRouterClarificationOption | null {
  return OPTIONS.find((option) => option.pipeline === pipeline) ?? null;
}

export function scoreCompetingPipelines(
  message: string,
): ReadonlyArray<{ pipeline: CommandRouterPipeline; hits: number }> {
  const text = message.toLowerCase();
  const counts = new Map<CommandRouterPipeline, number>();
  for (const option of OPTIONS) {
    const detail = option.detail.toLowerCase();
    const words = detail.split(/[^a-z0-9-]+/).filter((word) => word.length >= 4);
    const labelWords = option.label.toLowerCase().split(/[^a-z0-9-]+/).filter((word) => word.length >= 4);
    const all = [...words, ...labelWords, option.id];
    const hits = all.filter((word) => text.includes(word)).length;
    if (hits > 0) counts.set(option.pipeline, (counts.get(option.pipeline) ?? 0) + hits);
  }
  return Array.from(counts.entries())
    .map(([pipeline, hits]) => ({ pipeline, hits }))
    .sort((a, b) => b.hits - a.hits);
}

export function isAmbiguous(
  message: string,
  thresholds: CommandRouterAmbiguityThresholds = DEFAULT_AMBIGUITY_THRESHOLDS,
): boolean {
  const top = scoreCompetingPipelines(message);
  if (top.length < 2) return false;
  const [first, second] = top;
  if (!first || !second) return false;
  const spread = first.hits - second.hits;
  if (spread === 0) return true;
  if (first.hits < thresholds.maxCompetingPipelines + 1) return true;
  if (spread <= 1 && first.hits < 3) return true;
  if (first.hits / Math.max(1, second.hits) < 1.5) return true;
  return false;
}

export function buildClarification(message: string): CommandRouterClarification {
  return {
    kind: 'clarification',
    question: 'Which creator workflow did you mean?',
    options: OPTIONS,
    contextMessage: message,
  };
}

export function buildIntentFromClarification(
  option: CommandRouterClarificationOption,
  contextMessage: string,
  target: PreviewTarget,
): PreviewOnlyIntent {
  return {
    id: nextIntentId(option.pipeline),
    pipeline: option.pipeline,
    capability: 'preview',
    confidence: 1,
    rationale: `Creator picked "${option.label}" in response to: "${contextMessage}".`,
    requiresProject: true,
    target,
    preview: {
      previewId: nextPreviewId(option.pipeline),
      title: option.label,
      summary: option.detail,
      payload: { clarificationPipeline: option.pipeline },
    },
  };
}

export function clarificationContains(
  clarification: CommandRouterClarification,
  intent: CommandRouterIntent,
): boolean {
  return clarification.options.some((option) => option.pipeline === intent.pipeline);
}
