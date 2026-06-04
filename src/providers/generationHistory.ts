import { REDACTED_SECRET, redactSecrets } from '../security/redaction';
import type {
  AssetCatalogEntry,
  GeneratedAssetMetadata,
  GenerationHistoryData,
  GenerationHistoryCostMetadata,
  GenerationHistoryFailureKind,
  GenerationHistoryFailureMetadata,
  GenerationHistoryKind,
  GenerationHistoryLinkedOutput,
  GenerationHistoryRecord,
  GenerationHistoryReviewEvent,
  GenerationHistoryReviewState,
  ProjectData,
} from '../types/project';
import type { ProviderAdapterRequest, ProviderAdapterResponse } from './providerAdapter';

const DEFAULT_MAX_RECORDS = 200;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_TEXT_LENGTH = 4000;
const SECRET_KEY_PATTERN = /(authorization|api[_-]?key|token|secret|credential|password)/i;

type JsonishObject = Record<string, unknown>;

export interface CreateGenerationHistoryRecordInput {
  id: string;
  kind: GenerationHistoryKind;
  operation: string;
  providerId: string;
  modelId: string;
  createdAt: string;
  prompt: string;
  inputContext?: unknown;
  output?: unknown;
  outputSummary?: string;
  promptTemplateId?: string;
  promptTemplateVersion?: number;
  promptTemplateKind?: string;
  cost?: GenerationHistoryCostMetadata;
}

export interface CreateFailedGenerationHistoryRecordInput {
  kind: GenerationHistoryKind;
  request: ProviderAdapterRequest;
  response: ProviderAdapterResponse;
  failedAt?: string;
}

export interface AppendGenerationHistoryOptions {
  maxRecords?: number;
}

export interface LinkGenerationHistoryOutputInput {
  status: GenerationHistoryReviewState;
  reviewedAt: string;
  output: GenerationHistoryLinkedOutput;
  notes?: string;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function clampText(value: string): string {
  const redacted = redactSecrets(value)
    .replace(/\bsk-[A-Za-z0-9_-]+/g, REDACTED_SECRET)
    .replace(/\b(token|secret|credential|password)\s+[A-Za-z0-9._-]+/gi, (_match, label: string) =>
      `${label} ${REDACTED_SECRET}`,
    );
  return redacted.length > MAX_TEXT_LENGTH ? `${redacted.slice(0, MAX_TEXT_LENGTH)}...` : redacted;
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return clampText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map(item => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= MAX_DEPTH) return '[truncated]';
    const out: JsonishObject = {};
    for (const [key, entry] of Object.entries(value as JsonishObject)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED_SECRET : sanitizeValue(entry, depth + 1);
    }
    return out;
  }
  return String(value);
}

function normalizeText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return clampText(trimmed || fallback);
}

function normalizeCostNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined;
}

function sanitizeCost(cost: GenerationHistoryCostMetadata | undefined): GenerationHistoryCostMetadata | undefined {
  if (!cost) return undefined;
  const out: GenerationHistoryCostMetadata = {
    availability: cost.availability === 'free' || cost.availability === 'estimated' ? cost.availability : 'unknown',
  };
  const estimatedUsd = normalizeCostNumber(cost.estimatedUsd);
  const confirmationThresholdUsd = normalizeCostNumber(cost.confirmationThresholdUsd);

  if (estimatedUsd !== undefined) out.estimatedUsd = estimatedUsd;
  if (cost.currency === 'USD') out.currency = 'USD';
  if (typeof cost.confirmationRequired === 'boolean') out.confirmationRequired = cost.confirmationRequired;
  if (confirmationThresholdUsd !== undefined) out.confirmationThresholdUsd = confirmationThresholdUsd;
  if (cost.confirmedAt !== undefined) out.confirmedAt = normalizeText(cost.confirmedAt, '');
  if (cost.detail !== undefined) out.detail = normalizeText(cost.detail, '');

  return out;
}

const failureKinds = new Set<GenerationHistoryFailureKind>([
  'missing-credentials',
  'rate-limit',
  'quota-exceeded',
  'budget-exceeded',
  'timeout',
  'unsupported-operation',
  'provider-error',
  'cancelled',
]);

function sanitizeFailure(response: ProviderAdapterResponse): GenerationHistoryFailureMetadata {
  const rawKind = response.failure?.kind;
  const kind = rawKind && failureKinds.has(rawKind) ? rawKind : 'provider-error';
  const message = normalizeText(
    response.failure?.message ?? response.error ?? 'Provider request failed.',
    'Provider request failed.',
  );
  const retryAfterSeconds = normalizeCostNumber(response.failure?.retryAfterSeconds);
  const out: GenerationHistoryFailureMetadata = { kind, message };

  if (retryAfterSeconds !== undefined) out.retryAfterSeconds = retryAfterSeconds;
  if (response.failure?.retryGuidance !== undefined) {
    out.retryGuidance = normalizeText(response.failure.retryGuidance, '');
  }

  return out;
}

function normalizeHistory(history: GenerationHistoryData | undefined, maxRecords?: number): GenerationHistoryData {
  const records = Array.isArray(history?.records) ? history.records : [];
  const limit = Math.max(1, Math.floor(maxRecords ?? history?.maxRecords ?? DEFAULT_MAX_RECORDS));
  return {
    schemaVersion: 1,
    maxRecords: limit,
    records: records.slice(-limit).map(record => deepClone(record)),
  };
}

export function createGenerationHistoryRecord(input: CreateGenerationHistoryRecordInput): GenerationHistoryRecord {
  return {
    id: normalizeText(input.id, `generation-${Date.now()}`),
    kind: input.kind,
    operation: normalizeText(input.operation, 'unknown'),
    providerId: normalizeText(input.providerId, 'unknown'),
    modelId: normalizeText(input.modelId, 'unknown'),
    createdAt: normalizeText(input.createdAt, new Date().toISOString()),
    prompt: normalizeText(input.prompt, ''),
    inputContext: input.inputContext === undefined ? undefined : sanitizeValue(input.inputContext),
    output: input.output === undefined ? undefined : sanitizeValue(input.output),
    outputSummary: input.outputSummary === undefined ? undefined : normalizeText(input.outputSummary, ''),
    promptTemplateId: input.promptTemplateId,
    promptTemplateVersion: input.promptTemplateVersion,
    promptTemplateKind: input.promptTemplateKind,
    cost: sanitizeCost(input.cost),
    reviewState: 'pending',
    linkedOutputs: [],
    acceptanceHistory: [],
  };
}

export function createFailedGenerationHistoryRecord(
  input: CreateFailedGenerationHistoryRecordInput,
): GenerationHistoryRecord {
  const failure = sanitizeFailure(input.response);
  const createdAt = input.failedAt ?? input.request.createdAt;
  const record = createGenerationHistoryRecord({
    id: `failed:${input.request.id}`,
    kind: input.kind,
    operation: input.request.operation,
    providerId: input.request.providerId,
    modelId: input.request.modelId ?? 'unknown',
    createdAt,
    prompt: input.request.prompt ?? '',
    inputContext: input.request.input,
    output: input.response.output === undefined
      ? undefined
      : {
          failedCandidate: true,
          partialOutput: input.response.output,
        },
    outputSummary: `${input.request.operation} failed before acceptance.`,
  });

  return {
    ...record,
    reviewState: 'rejected',
    failure,
    linkedOutputs: [],
    acceptanceHistory: [
      {
        status: 'rejected',
        reviewedAt: record.createdAt,
        notes: `${failure.kind}: ${failure.message}`,
      },
    ],
  };
}

export function appendGenerationHistoryRecord(
  project: ProjectData,
  record: GenerationHistoryRecord,
  options: AppendGenerationHistoryOptions = {},
): ProjectData {
  const current = normalizeHistory(project.generationHistory, options.maxRecords);
  const records = [...current.records.filter(existing => existing.id !== record.id), deepClone(record)]
    .slice(-current.maxRecords);
  return {
    ...project,
    generationHistory: {
      ...current,
      records,
    },
  };
}

export function linkGenerationHistoryOutput(
  project: ProjectData,
  recordId: string,
  input: LinkGenerationHistoryOutputInput,
): ProjectData {
  const history = normalizeHistory(project.generationHistory);
  const output = deepClone(input.output);
  const review: GenerationHistoryReviewEvent = {
    status: input.status,
    reviewedAt: normalizeText(input.reviewedAt, new Date().toISOString()),
    output,
    notes: input.notes === undefined ? undefined : normalizeText(input.notes, ''),
  };
  return {
    ...project,
    generationHistory: {
      ...history,
      records: history.records.map(record => {
        if (record.id !== recordId) return record;
        const linkedOutputs = input.status === 'accepted'
          ? [...record.linkedOutputs, output]
          : record.linkedOutputs;
        return {
          ...record,
          reviewState: input.status,
          linkedOutputs,
          acceptanceHistory: [...record.acceptanceHistory, review],
        };
      }),
    },
  };
}

export function clearGenerationHistory(project: ProjectData): ProjectData {
  const current = normalizeHistory(project.generationHistory);
  return {
    ...project,
    generationHistory: {
      ...current,
      records: [],
    },
  };
}

export function exportGenerationHistory(project: ProjectData): GenerationHistoryData {
  return normalizeHistory(project.generationHistory);
}

function generatedAssetHistoryId(asset: AssetCatalogEntry): string {
  return `asset:${asset.id}:${asset.generated?.createdAt ?? 'unknown'}`;
}

function generatedAssetKind(metadata: GeneratedAssetMetadata): GenerationHistoryKind {
  const kind = metadata.promptTemplateKind;
  return kind === 'tileset' || kind === 'icon' || kind === 'portrait' || kind === 'concept' || kind === 'spritesheet'
    ? 'asset'
    : 'image';
}

export function createHistoryRecordForGeneratedAsset(asset: AssetCatalogEntry): GenerationHistoryRecord | null {
  const metadata = asset.generated;
  if (!metadata?.prompt || !metadata.providerId || !metadata.modelId) return null;
  const record = createGenerationHistoryRecord({
    id: generatedAssetHistoryId(asset),
    kind: generatedAssetKind(metadata),
    operation: metadata.operation ?? metadata.tool ?? metadata.promptTemplateId ?? 'asset.generate',
    providerId: metadata.providerId,
    modelId: metadata.modelId,
    createdAt: metadata.createdAt ?? new Date().toISOString(),
    prompt: metadata.prompt,
    inputContext: {
      promptInputs: metadata.promptInputs,
      imageSettings: metadata.imageSettings,
      ownerKind: metadata.ownerKind,
      ownerId: metadata.ownerId,
      sourceAssetId: metadata.sourceAssetId,
      referenceAssetIds: metadata.referenceAssetIds,
      visualContextSource: metadata.visualContextSource,
      visualContextVersion: metadata.visualContextVersion,
    },
    output: {
      assetId: asset.id,
      path: asset.path,
      kind: asset.kind,
      width: asset.width,
      height: asset.height,
      frameWidth: asset.frameWidth,
      frameHeight: asset.frameHeight,
      frames: asset.frames,
    },
    outputSummary: `${asset.name} accepted into asset catalog.`,
    promptTemplateId: metadata.promptTemplateId,
    promptTemplateVersion: metadata.promptTemplateVersion,
    promptTemplateKind: metadata.promptTemplateKind,
    cost: metadata.cost,
  });
  return {
    ...record,
    reviewState: 'accepted',
    linkedOutputs: [
      {
        kind: 'asset',
        id: asset.id,
        path: asset.path,
        label: asset.name,
      },
    ],
    acceptanceHistory: [
      {
        status: 'accepted',
        reviewedAt: metadata.createdAt ?? record.createdAt,
        output: {
          kind: 'asset',
          id: asset.id,
          path: asset.path,
          label: asset.name,
        },
      },
    ],
  };
}
