import {
  MEDIA_CATALOG_SCHEMA_VERSION,
  OFFLINE_MEDIA_MANIFEST_SCHEMA_VERSION,
  type CinematicTrackV1,
  type CinematicV1,
  type MediaAssetKind,
  type MediaAssetV1,
  type MediaCatalogV1,
  type OfflineMediaManifestV1,
} from './contracts';

export const DEFAULT_MEDIA_ALLOWED_ROOTS = ['assets/media'] as const;

export const DEFAULT_MEDIA_SIZE_LIMITS: Readonly<Record<MediaAssetKind, number>> = Object.freeze({
  audio: 32 * 1024 * 1024,
  voice: 16 * 1024 * 1024,
  video: 256 * 1024 * 1024,
  subtitle: 2 * 1024 * 1024,
});

export const DEFAULT_OFFLINE_MEDIA_BUDGET_BYTES = 512 * 1024 * 1024;

const AUDIO_MIME_EXTENSIONS = {
  'audio/aac': ['.aac'],
  'audio/flac': ['.flac'],
  'audio/mp4': ['.m4a', '.mp4'],
  'audio/mpeg': ['.mp3'],
  'audio/ogg': ['.ogg', '.oga'],
  'audio/opus': ['.opus'],
  'audio/wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/x-wav': ['.wav'],
} as const;

export const MEDIA_MIME_EXTENSIONS: Readonly<
  Record<MediaAssetKind, Readonly<Record<string, readonly string[]>>>
> = Object.freeze({
  audio: AUDIO_MIME_EXTENSIONS,
  voice: AUDIO_MIME_EXTENSIONS,
  video: Object.freeze({
    'video/mp4': ['.mp4', '.m4v'],
    'video/ogg': ['.ogv'],
    'video/webm': ['.webm'],
  }),
  subtitle: Object.freeze({
    'application/x-subrip': ['.srt'],
    'text/vtt': ['.vtt'],
  }),
});

export type MediaCatalogIssueSeverity = 'error' | 'warning';

export type MediaCatalogIssueCode =
  | 'invalid-catalog'
  | 'unsupported-version'
  | 'invalid-assets'
  | 'invalid-asset'
  | 'invalid-id'
  | 'duplicate-id'
  | 'invalid-kind'
  | 'unsafe-path'
  | 'path-outside-root'
  | 'path-metadata-conflict'
  | 'unsupported-mime'
  | 'mime-extension-mismatch'
  | 'invalid-size'
  | 'size-limit-exceeded'
  | 'invalid-integrity'
  | 'invalid-duration'
  | 'invalid-dimensions'
  | 'invalid-locale'
  | 'invalid-cinematics'
  | 'invalid-cinematic'
  | 'invalid-track'
  | 'unknown-asset-reference'
  | 'track-kind-mismatch'
  | 'invalid-timeline'
  | 'invalid-allowlist'
  | 'duplicate-allowlist-entry'
  | 'unknown-offline-entry'
  | 'asset-not-offline'
  | 'offline-budget-exceeded';

export interface MediaCatalogIssue {
  code: MediaCatalogIssueCode;
  severity: MediaCatalogIssueSeverity;
  path: string;
  message: string;
}

export interface MediaCatalogValidationSummary {
  errors: number;
  warnings: number;
  assetCount: number;
  cinematicCount: number;
  offlineAssetCount: number;
  offlineCinematicCount: number;
  /** Sum of unique allowlisted paths. Multiple ids may intentionally alias one file. */
  offlineBytes: number;
  assetsByKind: Record<MediaAssetKind, number>;
}

export interface MediaCatalogValidationReport {
  valid: boolean;
  catalogVersion: number | null;
  issues: MediaCatalogIssue[];
  summary: MediaCatalogValidationSummary;
}

export interface MediaCatalogValidationOptions {
  allowedRoots?: readonly string[];
  sizeLimits?: Partial<Record<MediaAssetKind, number>>;
  maxOfflineBytes?: number;
}

export type OfflineMediaCompileResult =
  | {
      ok: true;
      manifest: OfflineMediaManifestV1;
      report: MediaCatalogValidationReport;
      errors: [];
      warnings: MediaCatalogIssue[];
    }
  | {
      ok: false;
      manifest?: undefined;
      report: MediaCatalogValidationReport;
      errors: MediaCatalogIssue[];
      warnings: MediaCatalogIssue[];
    };

interface AssetFacts {
  record: Record<string, unknown>;
  id?: string;
  kind?: MediaAssetKind;
  normalizedPath?: string;
  normalizedMime?: string;
  byteSize?: number;
  durationMs?: number;
}

interface CinematicFacts {
  record: Record<string, unknown>;
  id?: string;
  tracks: Record<string, unknown>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMediaKind(value: unknown): value is MediaAssetKind {
  return value === 'audio' || value === 'voice' || value === 'video' || value === 'subtitle';
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 128
    && /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(value);
}

function isValidLocale(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value);
}

function isValidOptionalLabel(value: unknown): boolean {
  return value === undefined
    || (typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 256);
}

function issue(
  issues: MediaCatalogIssue[],
  code: MediaCatalogIssueCode,
  path: string,
  message: string,
  severity: MediaCatalogIssueSeverity = 'error',
): void {
  issues.push({ code, severity, path, message });
}

/** Converts separators without resolving dot segments or touching case. */
export function normalizeMediaPath(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

/** Portable path check shared by editor import, bundle compilation and runtime manifests. */
export function isSafeProjectRelativeMediaPath(value: string): boolean {
  if (typeof value !== 'string' || value === '' || value !== value.trim()) return false;
  const normalized = normalizeMediaPath(value);
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false;
  if (/[\u0000-\u001f\u007f<>:"|?*#%]/.test(normalized)) return false;

  const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
  return normalized.split('/').every(segment =>
    segment !== ''
    && segment !== '.'
    && segment !== '..'
    && !segment.endsWith('.')
    && !segment.endsWith(' ')
    && !reserved.test(segment),
  );
}

export function isMediaPathUnderAllowedRoot(
  value: string,
  allowedRoots: readonly string[] = DEFAULT_MEDIA_ALLOWED_ROOTS,
): boolean {
  if (!isSafeProjectRelativeMediaPath(value)) return false;
  const normalized = normalizeMediaPath(value);
  return allowedRoots.some(root => {
    if (typeof root !== 'string' || !isSafeProjectRelativeMediaPath(root)) return false;
    const normalizedRoot = normalizeMediaPath(root).replace(/\/$/, '');
    return normalized === normalizedRoot || normalized.startsWith(`${normalizedRoot}/`);
  });
}

export function isSupportedMediaMime(kind: MediaAssetKind, mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(MEDIA_MIME_EXTENSIONS[kind], mimeType.trim().toLowerCase());
}

export function mediaMimeMatchesPath(
  kind: MediaAssetKind,
  mimeType: string,
  path: string,
): boolean {
  const extensions = MEDIA_MIME_EXTENSIONS[kind][mimeType.trim().toLowerCase()];
  if (!extensions) return false;
  const normalized = normalizeMediaPath(path).toLowerCase();
  return extensions.some(extension => normalized.endsWith(extension));
}

function resolvedSizeLimits(
  options: MediaCatalogValidationOptions,
): Record<MediaAssetKind, number> {
  const limits = { ...DEFAULT_MEDIA_SIZE_LIMITS };
  for (const kind of Object.keys(limits) as MediaAssetKind[]) {
    const candidate = options.sizeLimits?.[kind];
    if (isPositiveSafeInteger(candidate)) limits[kind] = candidate;
  }
  return limits;
}

function validateAsset(
  value: unknown,
  index: number,
  issues: MediaCatalogIssue[],
  seenIds: Set<string>,
  pathFacts: Map<string, { mimeType: string; byteSize: number; sourcePath: string }>,
  options: MediaCatalogValidationOptions,
  counts: Record<MediaAssetKind, number>,
): AssetFacts | undefined {
  const path = `$.assets[${index}]`;
  if (!isRecord(value)) {
    issue(issues, 'invalid-asset', path, 'Media asset must be an object.');
    return undefined;
  }

  const facts: AssetFacts = { record: value };
  if (!isValidId(value.id)) {
    issue(issues, 'invalid-id', `${path}.id`, 'Asset id must be a portable id of at most 128 characters.');
  } else if (seenIds.has(value.id)) {
    issue(issues, 'duplicate-id', `${path}.id`, `Asset id "${value.id}" is duplicated.`);
  } else {
    seenIds.add(value.id);
    facts.id = value.id;
  }

  if (!isValidOptionalLabel(value.label)) {
    issue(issues, 'invalid-asset', `${path}.label`, 'Asset label must be a trimmed non-empty string when provided.');
  }

  if (!isMediaKind(value.kind)) {
    issue(issues, 'invalid-kind', `${path}.kind`, 'Asset kind must be audio, voice, video, or subtitle.');
  } else {
    facts.kind = value.kind;
    counts[value.kind] += 1;
  }

  if (typeof value.path !== 'string' || !isSafeProjectRelativeMediaPath(value.path)) {
    issue(issues, 'unsafe-path', `${path}.path`, 'Media path must be a safe portable project-relative path.');
  } else {
    facts.normalizedPath = normalizeMediaPath(value.path);
    if (!isMediaPathUnderAllowedRoot(value.path, options.allowedRoots ?? DEFAULT_MEDIA_ALLOWED_ROOTS)) {
      issue(issues, 'path-outside-root', `${path}.path`, 'Media path is outside the configured offline media roots.');
    }
  }

  if (typeof value.mimeType !== 'string' || value.mimeType !== value.mimeType.trim()
    || value.mimeType.includes(';')) {
    issue(issues, 'unsupported-mime', `${path}.mimeType`, 'MIME type must be canonical and must not contain parameters.');
  } else if (facts.kind) {
    facts.normalizedMime = value.mimeType.toLowerCase();
    if (!isSupportedMediaMime(facts.kind, facts.normalizedMime)) {
      issue(
        issues,
        'unsupported-mime',
        `${path}.mimeType`,
        `MIME type "${value.mimeType}" is not supported for ${facts.kind}.`,
      );
    } else if (facts.normalizedPath
      && !mediaMimeMatchesPath(facts.kind, facts.normalizedMime, facts.normalizedPath)) {
      issue(
        issues,
        'mime-extension-mismatch',
        `${path}.mimeType`,
        `MIME type "${value.mimeType}" does not match path "${facts.normalizedPath}".`,
      );
    }
  }

  if (!isPositiveSafeInteger(value.byteSize)) {
    issue(issues, 'invalid-size', `${path}.byteSize`, 'byteSize must be a positive safe integer.');
  } else {
    facts.byteSize = value.byteSize;
    if (facts.kind && value.byteSize > resolvedSizeLimits(options)[facts.kind]) {
      issue(
        issues,
        'size-limit-exceeded',
        `${path}.byteSize`,
        `${facts.kind} asset exceeds its configured byte limit.`,
      );
    }
  }

  if (value.sha256 !== undefined
    && (typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sha256))) {
    issue(issues, 'invalid-integrity', `${path}.sha256`, 'sha256 must contain exactly 64 hexadecimal characters.');
  }

  if (facts.kind === 'audio' || facts.kind === 'voice' || facts.kind === 'video') {
    if (!isPositiveSafeInteger(value.durationMs)) {
      issue(issues, 'invalid-duration', `${path}.durationMs`, `${facts.kind} durationMs must be a positive integer.`);
    } else {
      facts.durationMs = value.durationMs;
    }
  } else if (facts.kind === 'subtitle' && value.durationMs !== undefined) {
    if (!isPositiveSafeInteger(value.durationMs)) {
      issue(issues, 'invalid-duration', `${path}.durationMs`, 'Subtitle durationMs must be a positive integer when provided.');
    } else {
      facts.durationMs = value.durationMs;
    }
  }

  if (facts.kind === 'voice' || facts.kind === 'subtitle') {
    if (!isValidLocale(value.locale)) {
      issue(issues, 'invalid-locale', `${path}.locale`, `${facts.kind} assets require a BCP-47-style locale.`);
    }
  }
  if (facts.kind === 'voice' && value.speakerId !== undefined && !isValidId(value.speakerId)) {
    issue(issues, 'invalid-id', `${path}.speakerId`, 'speakerId must be a portable id when provided.');
  }

  if (facts.kind === 'video'
    && (!isPositiveSafeInteger(value.width) || !isPositiveSafeInteger(value.height)
      || value.width > 16384 || value.height > 16384)) {
    issue(issues, 'invalid-dimensions', path, 'Video width and height must be positive integers no greater than 16384.');
  }

  if (facts.normalizedPath && facts.normalizedMime && facts.byteSize) {
    const previous = pathFacts.get(facts.normalizedPath);
    if (previous
      && (previous.mimeType !== facts.normalizedMime || previous.byteSize !== facts.byteSize)) {
      issue(
        issues,
        'path-metadata-conflict',
        path,
        `Path "${facts.normalizedPath}" conflicts with metadata declared at ${previous.sourcePath}.`,
      );
    } else if (!previous) {
      pathFacts.set(facts.normalizedPath, {
        mimeType: facts.normalizedMime,
        byteSize: facts.byteSize,
        sourcePath: path,
      });
    }
  }

  return facts;
}

function validateTrack(
  value: unknown,
  path: string,
  cinematicDurationMs: number | undefined,
  assetsById: Map<string, AssetFacts>,
  issues: MediaCatalogIssue[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    issue(issues, 'invalid-track', path, 'Cinematic track must be an object.');
    return undefined;
  }

  const role = value.role;
  if (!isMediaKind(role)) {
    issue(issues, 'invalid-kind', `${path}.role`, 'Track role must be audio, voice, video, or subtitle.');
  }

  const assetId = value.assetId;
  const asset = typeof assetId === 'string' ? assetsById.get(assetId) : undefined;
  if (!isValidId(assetId)) {
    issue(issues, 'invalid-id', `${path}.assetId`, 'Track assetId must be a portable id.');
  } else if (!asset) {
    issue(issues, 'unknown-asset-reference', `${path}.assetId`, `Track references unknown asset "${assetId}".`);
  } else if (isMediaKind(role) && asset.kind !== role) {
    issue(
      issues,
      'track-kind-mismatch',
      `${path}.role`,
      `Track role "${role}" cannot use ${asset.kind ?? 'invalid'} asset "${assetId}".`,
    );
  }

  const startMs = value.startMs;
  const endMs = value.endMs;
  const startValid = isNonNegativeSafeInteger(startMs);
  const endValid = isPositiveSafeInteger(endMs);
  if (!startValid || !endValid || (startValid && endValid && endMs <= startMs)
    || (endValid && cinematicDurationMs !== undefined && endMs > cinematicDurationMs)) {
    issue(
      issues,
      'invalid-timeline',
      path,
      'Track requires integer 0 <= startMs < endMs <= cinematic duration.',
    );
  }

  const sourceStartMs = value.sourceStartMs ?? 0;
  if (!isNonNegativeSafeInteger(sourceStartMs)) {
    issue(issues, 'invalid-timeline', `${path}.sourceStartMs`, 'sourceStartMs must be a non-negative integer.');
  } else if (asset?.durationMs !== undefined) {
    if (sourceStartMs >= asset.durationMs) {
      issue(issues, 'invalid-timeline', `${path}.sourceStartMs`, 'sourceStartMs is outside the source asset duration.');
    } else if (startValid && endValid && value.loop !== true
      && sourceStartMs + (endMs - startMs) > asset.durationMs) {
      issue(issues, 'invalid-timeline', path, 'Track extends past the available source duration.');
    }
  }

  if (value.volume !== undefined) {
    if ((role !== 'audio' && role !== 'voice') || typeof value.volume !== 'number'
      || !Number.isFinite(value.volume) || value.volume < 0 || value.volume > 1) {
      issue(issues, 'invalid-track', `${path}.volume`, 'volume is valid only for audio/voice and must be between 0 and 1.');
    }
  }
  if (value.loop !== undefined && (role !== 'audio' || typeof value.loop !== 'boolean')) {
    issue(issues, 'invalid-track', `${path}.loop`, 'loop is a boolean option for general audio tracks only.');
  }
  if (value.default !== undefined && (role !== 'subtitle' || typeof value.default !== 'boolean')) {
    issue(issues, 'invalid-track', `${path}.default`, 'default is a boolean option for subtitle tracks only.');
  }

  return value;
}

function validateCinematic(
  value: unknown,
  index: number,
  issues: MediaCatalogIssue[],
  seenIds: Set<string>,
  assetsById: Map<string, AssetFacts>,
): CinematicFacts | undefined {
  const path = `$.cinematics[${index}]`;
  if (!isRecord(value)) {
    issue(issues, 'invalid-cinematic', path, 'Cinematic must be an object.');
    return undefined;
  }

  let id: string | undefined;
  if (!isValidId(value.id)) {
    issue(issues, 'invalid-id', `${path}.id`, 'Cinematic id must be a portable id of at most 128 characters.');
  } else if (seenIds.has(value.id)) {
    issue(issues, 'duplicate-id', `${path}.id`, `Cinematic id "${value.id}" is duplicated.`);
  } else {
    seenIds.add(value.id);
    id = value.id;
  }

  if (!isValidOptionalLabel(value.label)) {
    issue(issues, 'invalid-cinematic', `${path}.label`, 'Cinematic label must be a trimmed non-empty string when provided.');
  }
  const durationMs = isPositiveSafeInteger(value.durationMs) ? value.durationMs : undefined;
  if (durationMs === undefined) {
    issue(issues, 'invalid-duration', `${path}.durationMs`, 'Cinematic durationMs must be a positive integer.');
  }
  if (typeof value.skippable !== 'boolean') {
    issue(issues, 'invalid-cinematic', `${path}.skippable`, 'Cinematic skippable must be a boolean.');
  }

  const tracks: Record<string, unknown>[] = [];
  if (!Array.isArray(value.tracks) || value.tracks.length === 0) {
    issue(issues, 'invalid-cinematic', `${path}.tracks`, 'Cinematic requires at least one media track.');
  } else {
    value.tracks.forEach((track, trackIndex) => {
      const validTrack = validateTrack(
        track,
        `${path}.tracks[${trackIndex}]`,
        durationMs,
        assetsById,
        issues,
      );
      if (validTrack) tracks.push(validTrack);
    });
    const defaultSubtitleCount = tracks.filter(track => track.role === 'subtitle' && track.default === true).length;
    if (defaultSubtitleCount > 1) {
      issue(issues, 'invalid-cinematic', `${path}.tracks`, 'Only one subtitle track may be marked default.');
    }
  }

  return { record: value, id, tracks };
}

function collectAllowlist(
  value: unknown,
  path: string,
  knownIds: ReadonlySet<string>,
  issues: MediaCatalogIssue[],
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    issue(issues, 'invalid-allowlist', path, 'Offline allowlist field must be an array of ids.');
    return ids;
  }
  value.forEach((id, index) => {
    const idPath = `${path}[${index}]`;
    if (!isValidId(id)) {
      issue(issues, 'invalid-id', idPath, 'Offline allowlist entry must be a portable id.');
      return;
    }
    if (ids.has(id)) {
      issue(issues, 'duplicate-allowlist-entry', idPath, `Offline allowlist repeats "${id}".`);
      return;
    }
    ids.add(id);
    if (!knownIds.has(id)) {
      issue(issues, 'unknown-offline-entry', idPath, `Offline allowlist references unknown id "${id}".`);
    }
  });
  return ids;
}

function emptyKindCounts(): Record<MediaAssetKind, number> {
  return { audio: 0, voice: 0, video: 0, subtitle: 0 };
}

function finishReport(
  version: number | null,
  issues: MediaCatalogIssue[],
  summary: Omit<MediaCatalogValidationSummary, 'errors' | 'warnings'>,
): MediaCatalogValidationReport {
  const errors = issues.filter(item => item.severity === 'error').length;
  const warnings = issues.length - errors;
  return {
    valid: errors === 0,
    catalogVersion: version,
    issues,
    summary: { ...summary, errors, warnings },
  };
}

/**
 * Pure trust-boundary validation. It reads no files and reports all useful
 * catalog, packaging and cinematic-reference failures in one pass.
 */
export function validateMediaCatalogV1(
  input: unknown,
  options: MediaCatalogValidationOptions = {},
): MediaCatalogValidationReport {
  const issues: MediaCatalogIssue[] = [];
  const counts = emptyKindCounts();
  const emptySummary = {
    assetCount: 0,
    cinematicCount: 0,
    offlineAssetCount: 0,
    offlineCinematicCount: 0,
    offlineBytes: 0,
    assetsByKind: counts,
  };

  if (!isRecord(input)) {
    issue(issues, 'invalid-catalog', '$', 'Media catalog must be an object.');
    return finishReport(null, issues, emptySummary);
  }

  const version = typeof input.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
    ? input.schemaVersion
    : null;
  if (version !== MEDIA_CATALOG_SCHEMA_VERSION) {
    issue(issues, 'unsupported-version', '$.schemaVersion', 'Only MediaCatalog schema version 1 is supported.');
  }

  const assetValues = Array.isArray(input.assets) ? input.assets : [];
  if (!Array.isArray(input.assets)) {
    issue(issues, 'invalid-assets', '$.assets', 'Media catalog assets must be an array.');
  }
  const assetIds = new Set<string>();
  const assetsById = new Map<string, AssetFacts>();
  const pathFacts = new Map<string, { mimeType: string; byteSize: number; sourcePath: string }>();
  assetValues.forEach((asset, index) => {
    const facts = validateAsset(asset, index, issues, assetIds, pathFacts, options, counts);
    if (facts?.id) assetsById.set(facts.id, facts);
  });

  const cinematicValues = Array.isArray(input.cinematics) ? input.cinematics : [];
  if (!Array.isArray(input.cinematics)) {
    issue(issues, 'invalid-cinematics', '$.cinematics', 'Media catalog cinematics must be an array.');
  }
  const cinematicIds = new Set<string>();
  const cinematicsById = new Map<string, CinematicFacts>();
  cinematicValues.forEach((cinematic, index) => {
    const facts = validateCinematic(cinematic, index, issues, cinematicIds, assetsById);
    if (facts?.id) cinematicsById.set(facts.id, facts);
  });

  let offlineAssetIds = new Set<string>();
  let offlineCinematicIds = new Set<string>();
  if (!isRecord(input.offlineAllowlist)) {
    issue(issues, 'invalid-allowlist', '$.offlineAllowlist', 'Catalog requires an offlineAllowlist object.');
  } else {
    offlineAssetIds = collectAllowlist(
      input.offlineAllowlist.assetIds,
      '$.offlineAllowlist.assetIds',
      assetIds,
      issues,
    );
    offlineCinematicIds = collectAllowlist(
      input.offlineAllowlist.cinematicIds,
      '$.offlineAllowlist.cinematicIds',
      cinematicIds,
      issues,
    );
  }

  for (const cinematicId of offlineCinematicIds) {
    const cinematic = cinematicsById.get(cinematicId);
    if (!cinematic) continue;
    cinematic.tracks.forEach((track, trackIndex) => {
      if (typeof track.assetId === 'string' && assetsById.has(track.assetId)
        && !offlineAssetIds.has(track.assetId)) {
        issue(
          issues,
          'asset-not-offline',
          `$.cinematics[${cinematicValues.indexOf(cinematic.record)}].tracks[${trackIndex}].assetId`,
          `Offline cinematic "${cinematicId}" depends on non-allowlisted asset "${track.assetId}".`,
        );
      }
    });
  }

  const packagedPaths = new Map<string, number>();
  for (const id of offlineAssetIds) {
    const asset = assetsById.get(id);
    if (asset?.normalizedPath && asset.byteSize !== undefined && !packagedPaths.has(asset.normalizedPath)) {
      packagedPaths.set(asset.normalizedPath, asset.byteSize);
    }
  }
  const offlineBytes = Array.from(packagedPaths.values()).reduce((sum, size) => sum + size, 0);
  const configuredBudget = isPositiveSafeInteger(options.maxOfflineBytes)
    ? options.maxOfflineBytes
    : DEFAULT_OFFLINE_MEDIA_BUDGET_BYTES;
  if (offlineBytes > configuredBudget) {
    issue(
      issues,
      'offline-budget-exceeded',
      '$.offlineAllowlist.assetIds',
      `Offline media totals ${offlineBytes} bytes, above the ${configuredBudget} byte budget.`,
    );
  }

  return finishReport(version, issues, {
    assetCount: assetValues.length,
    cinematicCount: cinematicValues.length,
    offlineAssetCount: Array.from(offlineAssetIds).filter(id => assetsById.has(id)).length,
    offlineCinematicCount: Array.from(offlineCinematicIds).filter(id => cinematicsById.has(id)).length,
    offlineBytes,
    assetsByKind: counts,
  });
}

export function isMediaCatalogV1(
  input: unknown,
  options?: MediaCatalogValidationOptions,
): input is MediaCatalogV1 {
  return validateMediaCatalogV1(input, options).valid;
}

function copyAssetForOffline(asset: MediaAssetV1): MediaAssetV1 {
  const common = {
    id: asset.id,
    ...(asset.label !== undefined ? { label: asset.label } : {}),
    path: normalizeMediaPath(asset.path),
    mimeType: asset.mimeType.toLowerCase(),
    byteSize: asset.byteSize,
    ...(asset.sha256 !== undefined ? { sha256: asset.sha256.toLowerCase() } : {}),
  };
  switch (asset.kind) {
    case 'audio':
      return { ...common, kind: 'audio', durationMs: asset.durationMs };
    case 'voice':
      return {
        ...common,
        kind: 'voice',
        durationMs: asset.durationMs,
        locale: asset.locale,
        ...(asset.speakerId !== undefined ? { speakerId: asset.speakerId } : {}),
      };
    case 'video':
      return {
        ...common,
        kind: 'video',
        durationMs: asset.durationMs,
        width: asset.width,
        height: asset.height,
      };
    case 'subtitle':
      return {
        ...common,
        kind: 'subtitle',
        locale: asset.locale,
        ...(asset.durationMs !== undefined ? { durationMs: asset.durationMs } : {}),
      };
  }
}

function copyTrackForOffline(track: CinematicTrackV1): CinematicTrackV1 {
  return {
    assetId: track.assetId,
    role: track.role,
    startMs: track.startMs,
    endMs: track.endMs,
    ...(track.sourceStartMs !== undefined ? { sourceStartMs: track.sourceStartMs } : {}),
    ...(track.volume !== undefined ? { volume: track.volume } : {}),
    ...(track.loop !== undefined ? { loop: track.loop } : {}),
    ...(track.default !== undefined ? { default: track.default } : {}),
  };
}

function copyCinematicForOffline(cinematic: CinematicV1): CinematicV1 {
  return {
    id: cinematic.id,
    ...(cinematic.label !== undefined ? { label: cinematic.label } : {}),
    durationMs: cinematic.durationMs,
    skippable: cinematic.skippable,
    tracks: cinematic.tracks.map(copyTrackForOffline),
  };
}

/** Filters authoring-only entries and emits a normalized, offline-only DTO. */
export function compileOfflineMediaManifestV1(
  input: unknown,
  options: MediaCatalogValidationOptions = {},
): OfflineMediaCompileResult {
  const report = validateMediaCatalogV1(input, options);
  const errors = report.issues.filter(item => item.severity === 'error');
  const warnings = report.issues.filter(item => item.severity === 'warning');
  if (!report.valid) return { ok: false, report, errors, warnings };

  const catalog = input as MediaCatalogV1;
  const allowedAssets = new Set(catalog.offlineAllowlist.assetIds);
  const allowedCinematics = new Set(catalog.offlineAllowlist.cinematicIds);
  return {
    ok: true,
    manifest: {
      schemaVersion: OFFLINE_MEDIA_MANIFEST_SCHEMA_VERSION,
      assets: catalog.assets.filter(asset => allowedAssets.has(asset.id)).map(copyAssetForOffline),
      cinematics: catalog.cinematics
        .filter(cinematic => allowedCinematics.has(cinematic.id))
        .map(copyCinematicForOffline),
      totalBytes: report.summary.offlineBytes,
    },
    report,
    errors: [],
    warnings,
  };
}
