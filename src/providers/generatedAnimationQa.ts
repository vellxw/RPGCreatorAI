import type {
  AnimationSetData,
  AssetCatalogEntry,
  GeneratedAnimationQaCheckId,
  GeneratedAnimationQaCheckResult,
  GeneratedAnimationQaResult,
  GeneratedAnimationQaStatus,
  GeneratedImageVisualQaCheckStatus,
} from '../types/project';
import type { SpriteSheetGenerationCandidate } from './spriteSheetGenerationWorkflow';

export interface GeneratedAnimationQaDraft {
  assetId: string;
  assetName: string;
  animationSetId: string;
  checks: Record<GeneratedAnimationQaCheckId, GeneratedAnimationQaCheckResult>;
  unresolvedWarnings: GeneratedAnimationQaCheckId[];
}

export type GeneratedAnimationQaCheckOverrides = Partial<Record<
  GeneratedAnimationQaCheckId,
  Partial<Pick<GeneratedAnimationQaCheckResult, 'status' | 'notes'>>
>>;

export interface FinalizeGeneratedAnimationQaOptions {
  status: GeneratedAnimationQaStatus;
  reviewedAt: string;
  notes?: string;
  tags?: string[];
  rejectionReason?: string;
  checks?: GeneratedAnimationQaCheckOverrides;
}

const checkLabels: Record<GeneratedAnimationQaCheckId, string> = {
  preview: 'Preview',
  metadata: 'Metadata',
  coverage: 'Coverage',
  runtimeCompatibility: 'Runtime compatibility',
};

const RUNTIME_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp']);

function check(
  id: GeneratedAnimationQaCheckId,
  status: GeneratedImageVisualQaCheckStatus,
  notes: string,
  expected?: string,
  actual?: string,
): GeneratedAnimationQaCheckResult {
  return {
    id,
    label: checkLabels[id],
    status,
    notes,
    expected,
    actual,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
}

function unresolvedWarnings(checks: Record<GeneratedAnimationQaCheckId, GeneratedAnimationQaCheckResult>) {
  return (Object.keys(checks) as GeneratedAnimationQaCheckId[])
    .filter(id => checks[id].status === 'warning');
}

function scoreChecks(
  checks: Record<GeneratedAnimationQaCheckId, GeneratedAnimationQaCheckResult>,
  status: GeneratedAnimationQaStatus,
): number {
  const base = (Object.keys(checks) as GeneratedAnimationQaCheckId[]).reduce((sum, id) => {
    if (checks[id].status === 'pass') return sum + 25;
    if (checks[id].status === 'warning') return sum + 12;
    return sum;
  }, 0);
  return Math.max(0, status === 'rejected' ? base - 10 : base);
}

function extensionFor(path: string): string {
  return path.includes('.') ? path.slice(path.lastIndexOf('.')).toLowerCase() : '';
}

export function buildGeneratedAnimationQaDraft(
  candidate: SpriteSheetGenerationCandidate,
): GeneratedAnimationQaDraft {
  const { asset, animationSet, qaPreview } = candidate;
  const manifest = asset.generated?.spriteSheet;
  const clip = animationSet.clips[0];
  const previewAvailable = Boolean(
    qaPreview.assetRef &&
    qaPreview.width > 0 &&
    qaPreview.height > 0 &&
    qaPreview.frameWidth > 0 &&
    qaPreview.frameHeight > 0 &&
    qaPreview.frameCount > 0,
  );
  const manifestMatchesPreview = Boolean(
    manifest &&
    manifest.frameWidth === qaPreview.frameWidth &&
    manifest.frameHeight === qaPreview.frameHeight &&
    manifest.frameCount === qaPreview.frameCount &&
    manifest.frameLayout === 'horizontal-strip' &&
    manifest.transparentBackgroundRequired === true,
  );
  const clipMatchesAsset = Boolean(
    animationSet.id.trim() &&
    clip &&
    clip.asset === asset.id &&
    clip.action.trim() &&
    clip.direction &&
    clip.frameSize.width === qaPreview.frameWidth &&
    clip.frameSize.height === qaPreview.frameHeight &&
    clip.frameCount === qaPreview.frameCount,
  );
  const expectedWidth = qaPreview.frameWidth * qaPreview.frameCount;
  const extension = extensionFor(asset.path);
  const runtimeExportable = Boolean(
    asset.kind === 'spritesheet' &&
    RUNTIME_IMAGE_EXTENSIONS.has(extension) &&
    asset.width === expectedWidth &&
    asset.height === qaPreview.frameHeight &&
    asset.frameWidth === qaPreview.frameWidth &&
    asset.frameHeight === qaPreview.frameHeight &&
    asset.frames === qaPreview.frameCount,
  );

  const checks: Record<GeneratedAnimationQaCheckId, GeneratedAnimationQaCheckResult> = {
    preview: check(
      'preview',
      previewAvailable ? 'pass' : 'fail',
      previewAvailable
        ? 'Candidate preview evidence is available for frame QA.'
        : 'Candidate preview evidence is required before animation QA.',
      `${expectedWidth}x${qaPreview.frameHeight}`,
      asset.width && asset.height ? `${asset.width}x${asset.height}` : 'unknown',
    ),
    metadata: check(
      'metadata',
      manifestMatchesPreview ? 'pass' : 'fail',
      manifestMatchesPreview
        ? 'Generated sprite sheet manifest matches the QA preview.'
        : 'Generated sprite sheet manifest must match frame layout and preview metadata.',
      `${qaPreview.frameWidth}x${qaPreview.frameHeight}x${qaPreview.frameCount}`,
      manifest ? `${manifest.frameWidth}x${manifest.frameHeight}x${manifest.frameCount}` : 'missing',
    ),
    coverage: check(
      'coverage',
      clipMatchesAsset ? 'pass' : 'fail',
      clipMatchesAsset
        ? 'Generated animation set contains a clip aligned to the candidate asset.'
        : 'Generated animation set must contain a clip aligned to the candidate asset.',
      `${animationSet.id}:${asset.id}`,
      clip ? `${animationSet.id}:${clip.asset}` : `${animationSet.id}:missing clip`,
    ),
    runtimeCompatibility: check(
      'runtimeCompatibility',
      runtimeExportable ? 'pass' : 'fail',
      runtimeExportable
        ? 'Sheet metadata is runtime-exportable after QA approval.'
        : 'Sheet path, dimensions, and frame metadata must be runtime-exportable before assignment.',
      `.png/.jpg/.jpeg/.bmp/.webp and ${expectedWidth}x${qaPreview.frameHeight}`,
      `${extension || '(none)'} and ${asset.width ?? 'unknown'}x${asset.height ?? 'unknown'}`,
    ),
  };

  return {
    assetId: asset.id,
    assetName: asset.name,
    animationSetId: animationSet.id,
    checks,
    unresolvedWarnings: unresolvedWarnings(checks),
  };
}

export function finalizeGeneratedAnimationQaReview(
  draft: GeneratedAnimationQaDraft,
  options: FinalizeGeneratedAnimationQaOptions,
): GeneratedAnimationQaResult {
  const checks = clone(draft.checks);
  for (const [id, override] of Object.entries(options.checks ?? {}) as Array<[
    GeneratedAnimationQaCheckId,
    Partial<Pick<GeneratedAnimationQaCheckResult, 'status' | 'notes'>>,
  ]>) {
    checks[id] = {
      ...checks[id],
      ...override,
      id,
      label: checkLabels[id],
      notes: override.notes ?? checks[id].notes,
    };
  }
  if (options.status === 'accepted' && Object.values(checks).some(item => item.status === 'fail')) {
    throw new Error('Cannot accept character animation QA while required checks are failing.');
  }
  const warnings = unresolvedWarnings(checks);
  return {
    status: options.status,
    reviewedAt: options.reviewedAt,
    score: scoreChecks(checks, options.status),
    checks,
    notes: options.notes?.trim() ?? '',
    tags: uniqueTags(options.tags ?? []),
    rejectionReason: options.rejectionReason?.trim() || undefined,
    unresolvedWarnings: warnings,
  };
}

export function applyGeneratedAnimationQaResult(
  asset: AssetCatalogEntry,
  result: GeneratedAnimationQaResult,
): AssetCatalogEntry {
  const qaTag = result.status === 'accepted' ? 'animation-qa-reviewed' : 'animation-qa-rejected';
  return {
    ...clone(asset),
    runtimeCompatible: result.status === 'accepted' ? true : asset.runtimeCompatible,
    runtimeNotes: [
      asset.runtimeNotes,
      `Character animation QA ${result.status} at ${result.reviewedAt}.`,
    ].filter(Boolean).join('\n'),
    tags: uniqueTags([...(asset.tags ?? []), qaTag, ...result.tags]),
    generated: {
      ...(asset.generated ?? {}),
      animationQa: clone(result),
    },
  };
}

export function isCharacterAnimationQaRejectedAsset(asset?: AssetCatalogEntry): boolean {
  return Boolean(
    asset &&
    (
      asset.generated?.animationQa?.status === 'rejected' ||
      asset.tags?.includes('animation-qa-rejected')
    ),
  );
}

export function findCharacterAnimationQaBlockedAnimationSets(
  animationSets: AnimationSetData[],
  assets: AssetCatalogEntry[],
): Record<string, string> {
  const assetsById = new Map(assets.map(asset => [asset.id, asset]));
  const blocked: Record<string, string> = {};
  for (const set of animationSets) {
    const rejectedClip = set.clips.find(clip => isCharacterAnimationQaRejectedAsset(assetsById.get(clip.asset)));
    if (rejectedClip) {
      blocked[set.id] = `failed character animation QA asset "${rejectedClip.asset}"`;
    }
  }
  return blocked;
}
