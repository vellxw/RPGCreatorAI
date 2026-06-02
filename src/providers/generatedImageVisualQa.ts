import type {
  AssetCatalogEntry,
  GeneratedImageVisualQaCheckId,
  GeneratedImageVisualQaCheckResult,
  GeneratedImageVisualQaCheckStatus,
  GeneratedImageVisualQaResult,
  GeneratedImageVisualQaStatus,
} from '../types/project';

export interface GeneratedImageVisualQaPreview {
  width?: number;
  height?: number;
  assetRef?: string;
  providerFixture?: string;
}

export interface GeneratedImageVisualQaDraft {
  assetId: string;
  assetName: string;
  checks: Record<GeneratedImageVisualQaCheckId, GeneratedImageVisualQaCheckResult>;
  unresolvedWarnings: GeneratedImageVisualQaCheckId[];
}

export type GeneratedImageVisualQaCheckOverrides = Partial<Record<
  GeneratedImageVisualQaCheckId,
  Partial<Pick<GeneratedImageVisualQaCheckResult, 'status' | 'notes'>>
>>;

export interface FinalizeGeneratedImageVisualQaOptions {
  status: GeneratedImageVisualQaStatus;
  reviewedAt: string;
  notes?: string;
  tags?: string[];
  rejectionReason?: string;
  checks?: GeneratedImageVisualQaCheckOverrides;
}

const checkLabels: Record<GeneratedImageVisualQaCheckId, string> = {
  dimensions: 'Dimensions',
  transparency: 'Transparency',
  styleConsistency: 'Style consistency',
  readability: 'Readability',
  runtimeSuitability: 'Runtime suitability',
};

function check(
  id: GeneratedImageVisualQaCheckId,
  status: GeneratedImageVisualQaCheckStatus,
  notes: string,
  expected?: string,
  actual?: string,
): GeneratedImageVisualQaCheckResult {
  return {
    id,
    label: checkLabels[id],
    status,
    notes,
    expected,
    actual,
  };
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function unresolvedWarnings(checks: Record<GeneratedImageVisualQaCheckId, GeneratedImageVisualQaCheckResult>) {
  return (Object.keys(checks) as GeneratedImageVisualQaCheckId[])
    .filter(id => checks[id].status === 'warning');
}

function scoreChecks(
  checks: Record<GeneratedImageVisualQaCheckId, GeneratedImageVisualQaCheckResult>,
  status: GeneratedImageVisualQaStatus,
): number {
  const base = (Object.keys(checks) as GeneratedImageVisualQaCheckId[]).reduce((sum, id) => {
    if (checks[id].status === 'pass') return sum + 20;
    if (checks[id].status === 'warning') return sum + 10;
    return sum;
  }, 0);
  return Math.max(0, status === 'rejected' ? base - 10 : base);
}

export function buildGeneratedImageVisualQaDraft(
  asset: AssetCatalogEntry,
  preview: GeneratedImageVisualQaPreview = {},
): GeneratedImageVisualQaDraft {
  const actualDimensions = asset.width && asset.height ? `${asset.width}x${asset.height}` : 'unknown';
  const expectedDimensions = preview.width && preview.height ? `${preview.width}x${preview.height}` : actualDimensions;
  const dimensionsPass = actualDimensions !== 'unknown' && actualDimensions === expectedDimensions;

  const checks: Record<GeneratedImageVisualQaCheckId, GeneratedImageVisualQaCheckResult> = {
    dimensions: check(
      'dimensions',
      dimensionsPass ? 'pass' : 'fail',
      dimensionsPass
        ? 'Generated dimensions match the candidate preview.'
        : 'Generated dimensions must match the candidate preview before review.',
      expectedDimensions,
      actualDimensions,
    ),
    transparency: check(
      'transparency',
      'warning',
      'Transparency or background edge behavior requires visual confirmation.',
    ),
    styleConsistency: check(
      'styleConsistency',
      'warning',
      'Style consistency with the project visual direction requires visual confirmation.',
    ),
    readability: check(
      'readability',
      'warning',
      'Readability at intended in-editor or runtime scale requires visual confirmation.',
    ),
    runtimeSuitability: check(
      'runtimeSuitability',
      asset.runtimeCompatible === true ? 'pass' : 'warning',
      asset.runtimeCompatible === true
        ? 'Asset is already marked runtime compatible.'
        : 'Runtime suitability remains an editor review/export concern.',
    ),
  };

  return {
    assetId: asset.id,
    assetName: asset.name,
    checks,
    unresolvedWarnings: unresolvedWarnings(checks),
  };
}

export function finalizeGeneratedImageVisualQaReview(
  draft: GeneratedImageVisualQaDraft,
  options: FinalizeGeneratedImageVisualQaOptions,
): GeneratedImageVisualQaResult {
  const checks = clone(draft.checks);
  for (const [id, override] of Object.entries(options.checks ?? {}) as Array<[
    GeneratedImageVisualQaCheckId,
    Partial<Pick<GeneratedImageVisualQaCheckResult, 'status' | 'notes'>>,
  ]>) {
    checks[id] = {
      ...checks[id],
      ...override,
      id,
      label: checkLabels[id],
      notes: override.notes ?? checks[id].notes,
    };
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

export function applyGeneratedImageVisualQaResult(
  asset: AssetCatalogEntry,
  result: GeneratedImageVisualQaResult,
): AssetCatalogEntry {
  const qaTag = result.status === 'accepted' ? 'qa-reviewed' : 'qa-rejected';
  return {
    ...clone(asset),
    tags: uniqueTags([...(asset.tags ?? []), qaTag, ...result.tags]),
    generated: {
      ...(asset.generated ?? {}),
      visualQa: clone(result),
    },
  };
}
