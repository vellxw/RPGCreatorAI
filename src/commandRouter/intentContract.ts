/**
 * Phase 12 M03 — Command Router Intent Contract (PX-056, FRA-490).
 *
 * Defines typed intents that the AI Studio sends through the command router.
 * Every intent is read-only, preview-only, or unsupported. The router is
 * responsible for mapping a free-form creator request into one of these
 * intents. Mutating intents are never applied without an accompanying
 * preview action (see previewContract.ts).
 */

export type CommandRouterPipeline =
  | 'map-draft'
  | 'event-draft'
  | 'database-draft'
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

export type CommandRouterCapability = 'read' | 'preview' | 'mutation';

export interface CommandRouterIntentBase {
  id: string;
  pipeline: CommandRouterPipeline;
  capability: CommandRouterCapability;
  confidence: number;
  rationale: string;
  requiresProject: boolean;
}

export interface ReadOnlyIntent extends CommandRouterIntentBase {
  capability: 'read';
  target: {
    projectId: string;
    mapId?: string;
    eventId?: string;
    databaseTable?: string;
    recordId?: string;
  };
}

export interface PreviewOnlyIntent extends CommandRouterIntentBase {
  capability: 'preview';
  preview: RouterPreview;
  target: PreviewTarget;
}

export interface MutationIntent extends CommandRouterIntentBase {
  capability: 'mutation';
  preview: RouterPreview;
  target: PreviewTarget;
  writeIntentId: string;
}

export type PreviewTarget =
  | { kind: 'project'; projectId: string }
  | { kind: 'map'; projectId: string; mapId: string }
  | { kind: 'event'; projectId: string; mapId: string; eventId: string }
  | { kind: 'database'; projectId: string; table: string; recordId?: string }
  | { kind: 'asset'; projectId: string; assetKind: string; assetId?: string };

export type CommandRouterIntent = ReadOnlyIntent | PreviewOnlyIntent | MutationIntent;

export interface RouterPreview {
  previewId: string;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  invalid?: false;
}

export interface RouterPreviewInvalid {
  previewId: string;
  invalid: true;
  reasons: string[];
  fixGuidance: string[];
}

export type AnyRouterPreview = RouterPreview | RouterPreviewInvalid;

const PIPELINE_KEYWORDS: Record<CommandRouterPipeline, readonly string[]> = {
  'map-draft': ['map', 'town', 'dungeon', 'world', 'level', 'scene', 'route'],
  'event-draft': ['event', 'cutscene', 'trigger', 'npc', 'chest', 'door', 'transfer'],
  'database-draft': ['actor', 'class', 'skill', 'item', 'weapon', 'armor', 'enemy', 'troop'],
  'asset-character': ['character', 'hero', 'npc portrait'],
  'asset-portrait': ['portrait', 'face', 'avatar'],
  'asset-tileset': ['tileset', 'terrain', 'biome'],
  'asset-icon': ['icon', 'item icon', 'skill icon'],
  'asset-sprite-sheet': ['sprite sheet', 'animation', 'walk cycle', 'attack frames', 'sprite'],
  'validation-repair': ['repair', 'fix', 'validate', 'broken reference'],
  balancing: ['balance', 'rebalance', 'stats', 'difficulty'],
  'code-assistant': ['code', 'script', 'typescript', 'patch', 'developer mode'],
  'review-inbox': ['review', 'inbox', 'candidate'],
  unsupported: [],
};

const MUTATION_KEYWORDS: readonly string[] = [
  'create',
  'add',
  'generate',
  'make',
  'build',
  'replace',
  'rewrite',
  'fix',
  'repair',
  'update',
  'duplicate',
  'rebalance',
  'tweak',
  'change',
  'insert',
  'delete',
  'remove',
];

const READ_ONLY_KEYWORDS: readonly string[] = [
  'explain',
  'summarize',
  'summarise',
  'list',
  'show',
  'describe',
  'inspect',
  'tell me',
];

export function isReadOnlyIntent(intent: CommandRouterIntent): intent is ReadOnlyIntent {
  return intent.capability === 'read';
}

export function isPreviewOnlyIntent(intent: CommandRouterIntent): intent is PreviewOnlyIntent {
  return intent.capability === 'preview';
}

export function isMutationIntent(intent: CommandRouterIntent): intent is MutationIntent {
  return intent.capability === 'mutation';
}

export function hasApplyablePreview(intent: CommandRouterIntent): boolean {
  if (intent.capability === 'read') return false;
  if (intent.capability === 'preview') return false;
  return intent.preview.invalid == null || intent.preview.invalid === false;
}

function matchesAny(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function inferPipeline(message: string): CommandRouterPipeline {
  const text = message.toLowerCase();
  let best: {
    pipeline: CommandRouterPipeline;
    score: number;
    hits: number;
    longestMatch: number;
    multiWordHits: number;
  } = {
    pipeline: 'unsupported',
    score: 0,
    hits: 0,
    longestMatch: 0,
    multiWordHits: 0,
  };
  for (const [pipeline, keywords] of Object.entries(PIPELINE_KEYWORDS) as Array<
    [CommandRouterPipeline, readonly string[]]
  >) {
    if (keywords.length === 0) continue;
    let score = 0;
    let hits = 0;
    let longestMatch = 0;
    let multiWordHits = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        hits += 1;
        // Longer, more specific multi-word keywords carry higher weight so a
        // "sprite sheet" mention beats a generic "character" mention when both
        // appear in the same message.
        const weighted = keyword.length >= 8 ? 2 : 1;
        score += weighted;
        if (keyword.length >= 8) multiWordHits += 1;
        if (keyword.length > longestMatch) longestMatch = keyword.length;
      }
    }
    if (
      score > best.score ||
      (score === best.score && multiWordHits > best.multiWordHits) ||
      (score === best.score &&
        multiWordHits === best.multiWordHits &&
        longestMatch > best.longestMatch)
    ) {
      best = { pipeline, score, hits, longestMatch, multiWordHits };
    }
  }
  return best.pipeline;
}

export function inferCapability(message: string, pipeline: CommandRouterPipeline): CommandRouterCapability {
  if (pipeline === 'unsupported') return 'read';
  const text = message.toLowerCase();
  if (matchesAny(text, READ_ONLY_KEYWORDS)) return 'read';
  if (matchesAny(text, MUTATION_KEYWORDS)) return 'mutation';
  return 'preview';
}

export function computeConfidence(message: string, pipeline: CommandRouterPipeline): number {
  if (pipeline === 'unsupported') return 0;
  const text = message.toLowerCase();
  const keywords = PIPELINE_KEYWORDS[pipeline];
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  const lengthFactor = Math.min(1, text.length / 40);
  return Math.max(0.3, Math.min(0.99, 0.5 + 0.2 * hits + 0.2 * lengthFactor));
}

export function buildRationale(
  message: string,
  pipeline: CommandRouterPipeline,
  capability: CommandRouterCapability,
): string {
  if (pipeline === 'unsupported') {
    return 'The router could not match this request to a known creator pipeline. Ask for clarification.';
  }
  return `Matched ${pipeline} (${capability}) from creator message: "${truncate(message, 80)}".`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

let intentCounter = 0;
export function nextIntentId(pipeline: CommandRouterPipeline): string {
  intentCounter += 1;
  return `intent-${pipeline}-${Date.now()}-${intentCounter}`;
}

let previewCounter = 0;
export function nextPreviewId(intentId: string): string {
  previewCounter += 1;
  return `preview-${intentId}-${previewCounter}`;
}

let writeIntentCounter = 0;
export function nextWriteIntentId(pipeline: CommandRouterPipeline): string {
  writeIntentCounter += 1;
  return `write-${pipeline}-${Date.now()}-${writeIntentCounter}`;
}
