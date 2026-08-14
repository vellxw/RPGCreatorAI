import type {
  AnimationSetData,
  AnimationSetDisplayData,
  AssetCatalogData,
  AssetCatalogEntry,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { isSafePortablePath, normalizePortablePath } from '../utils/packageSecurity';
import {
  ANIMATION_PACKAGE_VERSION,
  validateAnimationPackage,
  type AnimationPackageQaReport,
  type AnimationPackageV1,
  type AnimationStripArtifactV1,
} from './animationPackage';

export const ANIMATION_PERSISTENCE_SCHEMA_VERSION = 1 as const;

const PORTABLE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export interface AnimationSeedReferenceV1 {
  assetId: string;
  path: string;
  sha256: string;
  width: number;
  height: number;
  provenance: string;
  source: 'local' | 'imported' | 'generated';
  reviewStatus: 'approved' | 'frozen';
}

export interface AnimationSeedRegistrationV1 {
  schemaVersion: typeof ANIMATION_PERSISTENCE_SCHEMA_VERSION;
  packageId: string;
  animationSetId: string;
  registrationPath: string;
  status: 'seed-ready-awaiting-strips';
  seed: AnimationSeedReferenceV1;
  blockers: Array<{
    code: 'normalized-strips-required';
    message: string;
  }>;
}

export interface AnimationPackagePersistenceStripV1 extends AnimationStripArtifactV1 {
  action: string;
  direction: 'down' | 'left' | 'right' | 'up' | 'any';
  fps: number;
  loop: boolean;
  anchor: { x: number; y: number };
}

export interface AnimationPackagePersistenceManifestV1 {
  schemaVersion: typeof ANIMATION_PERSISTENCE_SCHEMA_VERSION;
  packageSchemaVersion: typeof ANIMATION_PACKAGE_VERSION;
  packageId: string;
  animationSetId: string;
  packagePath: string;
  manifestPath: string;
  source: {
    path: string;
    sha256: string;
    provenance?: string;
  };
  strips: AnimationPackagePersistenceStripV1[];
}

export type AnimationPersistenceIssueCode =
  | 'invalid-seed'
  | 'invalid-package'
  | 'invalid-target'
  | 'missing-artifact'
  | 'unexpected-artifact'
  | 'normalization-conflict'
  | 'asset-conflict'
  | 'clip-conflict'
  | 'display-conflict';

export interface AnimationPersistenceIssue {
  code: AnimationPersistenceIssueCode;
  path: string;
  message: string;
}

export type AnimationSeedRegistrationResult =
  | { ok: true; registration: AnimationSeedRegistrationV1 }
  | { ok: false; errors: AnimationPersistenceIssue[] };

export interface PersistAnimationPackageOptions {
  animationSetId: string;
  ownerId: string;
  /** Canonical project-relative JSON destination for the package. */
  packagePath: string;
  /** Canonical project-relative JSON destination for this persistence manifest. */
  manifestPath: string;
  ownerKind?: string;
  display?: AnimationSetDisplayData;
  /** May be supplied separately while assembling an atomic persistence commit. */
  artifacts?: readonly AnimationStripArtifactV1[];
  existingCatalog?: AssetCatalogData;
  existingAnimationSets?: readonly AnimationSetData[];
}

export type PersistAnimationPackageResult =
  | {
      ok: true;
      package: AnimationPackageV1;
      qa: AnimationPackageQaReport;
      assetCatalog: AssetCatalogData;
      animationSets: AnimationSetData[];
      animationSet: AnimationSetData;
      manifest: AnimationPackagePersistenceManifestV1;
    }
  | {
      ok: false;
      errors: AnimationPersistenceIssue[];
      qa?: AnimationPackageQaReport;
    };

export type SuccessfulAnimationPackagePersistence = Extract<
  PersistAnimationPackageResult,
  { ok: true }
>;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function portablePath(value: unknown): value is string {
  return typeof value === 'string'
    && isSafePortablePath(value)
    && normalizePortablePath(value) === value.replaceAll('\\', '/');
}

function isUnderRoot(path: string, root: string): boolean {
  const normalized = normalizePortablePath(path);
  return normalized === root || normalized.startsWith(`${root}/`);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function stableEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortClips(clips: AnimationSetData['clips']): AnimationSetData['clips'] {
  return [...clips].sort((left, right) =>
    `${left.action}.${left.direction}.${left.asset}`.localeCompare(
      `${right.action}.${right.direction}.${right.asset}`,
    ));
}

function validateSeed(seed: AnimationSeedReferenceV1): AnimationPersistenceIssue[] {
  const errors: AnimationPersistenceIssue[] = [];
  if (!PORTABLE_ID.test(seed.assetId)) {
    errors.push({ code: 'invalid-seed', path: '$.seed.assetId', message: 'Seed assetId must be portable.' });
  }
  if (!portablePath(seed.path) || !portablePath(seed.provenance)) {
    errors.push({
      code: 'invalid-seed',
      path: '$.seed',
      message: 'Seed path and provenance must be canonical project-relative paths.',
    });
  }
  if (!SHA256.test(seed.sha256) || !positiveInteger(seed.width) || !positiveInteger(seed.height)) {
    errors.push({
      code: 'invalid-seed',
      path: '$.seed',
      message: 'Seed requires a lowercase SHA-256 and positive integer dimensions.',
    });
  }
  if (!['local', 'imported', 'generated'].includes(seed.source)
    || !['approved', 'frozen'].includes(seed.reviewStatus)) {
    errors.push({
      code: 'invalid-seed',
      path: '$.seed',
      message: 'Seed source and reviewStatus must be explicit and approved.',
    });
  }
  return errors;
}

/**
 * Registers an approved seed without fabricating clips, grids, or animation
 * frames. The blocker remains explicit until normalized strips are supplied.
 */
export function registerAnimationSeedReference(
  packageId: string,
  animationSetId: string,
  registrationPath: string,
  seed: AnimationSeedReferenceV1,
): AnimationSeedRegistrationResult {
  const errors = validateSeed(seed);
  if (!PORTABLE_ID.test(packageId)) {
    errors.push({ code: 'invalid-target', path: '$.packageId', message: 'Package id must be portable.' });
  }
  if (!PORTABLE_ID.test(animationSetId)) {
    errors.push({ code: 'invalid-target', path: '$.animationSetId', message: 'Animation set id must be portable.' });
  }
  if (!portablePath(registrationPath) || !registrationPath.endsWith('.json')
    || !isUnderRoot(registrationPath, 'data/assets/animation-packages')) {
    errors.push({
      code: 'invalid-target',
      path: '$.registrationPath',
      message: 'Seed registration path must be a canonical JSON path under data/assets/animation-packages.',
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    registration: {
      schemaVersion: ANIMATION_PERSISTENCE_SCHEMA_VERSION,
      packageId,
      animationSetId,
      registrationPath: normalizePortablePath(registrationPath),
      status: 'seed-ready-awaiting-strips',
      seed: copy(seed),
      blockers: [{
        code: 'normalized-strips-required',
        message: 'Approved horizontal strips with exact frame geometry, hashes, and provenance are required before catalog or AnimationSet persistence.',
      }],
    },
  };
}

function effectiveAnchor(packageData: AnimationPackageV1, clipIndex: number): { x: number; y: number } {
  const clip = packageData.clips[clipIndex];
  return copy(clip.anchor ?? packageData.defaultAnchor ?? {
    x: packageData.grid.cellWidth / 2,
    y: packageData.grid.cellHeight,
  });
}

function catalogEntry(
  packageData: AnimationPackageV1,
  artifact: AnimationStripArtifactV1,
  clipIndex: number,
  options: PersistAnimationPackageOptions,
): AssetCatalogEntry {
  const clip = packageData.clips[clipIndex];
  const anchor = effectiveAnchor(packageData, clipIndex);
  return {
    id: artifact.assetId,
    name: `${options.animationSetId} · ${clip.action} · ${clip.direction}`,
    kind: 'spritesheet',
    path: normalizePortablePath(artifact.path),
    source: artifact.source,
    tags: ['animation-strip', clip.action, clip.direction, artifact.reviewStatus],
    provenance: normalizePortablePath(artifact.provenance),
    runtimeCompatible: true,
    runtimeNotes: `Approved ${artifact.reviewStatus} strip derived from AnimationPackage ${packageData.id}; byte hash retained in its persistence manifest.`,
    width: artifact.width,
    height: artifact.height,
    frameWidth: artifact.frameWidth,
    frameHeight: artifact.frameHeight,
    frames: artifact.frameCount,
    generated: {
      ownerKind: options.ownerKind,
      ownerId: options.ownerId,
      sourceAssetPath: normalizePortablePath(packageData.source.path),
      spriteSheet: {
        frameWidth: artifact.frameWidth,
        frameHeight: artifact.frameHeight,
        frameCount: artifact.frameCount,
        action: clip.action,
        direction: clip.direction,
        frameLayout: 'horizontal-strip',
        transparentBackgroundRequired: true,
        animationSetId: options.animationSetId,
        fps: clip.fps,
        anchor,
      },
    },
  };
}

function mergeCatalog(
  existing: AssetCatalogData | undefined,
  additions: AssetCatalogEntry[],
  errors: AnimationPersistenceIssue[],
): AssetCatalogData {
  const result: AssetCatalogData = copy(existing ?? { schemaVersion: 1, assets: [] });
  for (const addition of additions) {
    const found = result.assets.find(asset => asset.id === addition.id);
    if (!found) result.assets.push(addition);
    else if (!stableEqual(found, addition)) {
      errors.push({
        code: 'asset-conflict',
        path: `$.assetCatalog.assets.${addition.id}`,
        message: `Asset "${addition.id}" already exists with different persisted data.`,
      });
    }
  }
  return result;
}

function mergeAnimationSet(
  existingSets: readonly AnimationSetData[] | undefined,
  addition: AnimationSetData,
  errors: AnimationPersistenceIssue[],
): { sets: AnimationSetData[]; set: AnimationSetData } {
  const sets = copy<AnimationSetData[]>([...(existingSets ?? [])]);
  const existing = sets.find(set => set.id === addition.id);
  if (!existing) {
    const inserted = { ...addition, clips: sortClips(addition.clips) };
    sets.push(inserted);
    return { sets, set: inserted };
  }
  if (existing.display && addition.display && !stableEqual(existing.display, addition.display)) {
    errors.push({
      code: 'display-conflict',
      path: `$.animationSets.${addition.id}.display`,
      message: `Animation set "${addition.id}" already has different display metadata.`,
    });
  } else if (!existing.display && addition.display) {
    existing.display = copy(addition.display);
  }
  for (const clip of addition.clips) {
    const found = existing.clips.find(candidate =>
      candidate.action === clip.action && candidate.direction === clip.direction);
    if (!found) existing.clips.push(copy(clip));
    else if (!stableEqual(found, clip)) {
      errors.push({
        code: 'clip-conflict',
        path: `$.animationSets.${addition.id}.${clip.action}.${clip.direction}`,
        message: `Animation clip ${clip.action}.${clip.direction} already targets different strip data.`,
      });
    }
  }
  existing.clips = sortClips(existing.clips);
  return { sets, set: existing };
}

/**
 * Bridges a validated package plus real strip artifacts into data that can be
 * saved atomically. It never reads image bytes and never invents missing frames.
 */
export function persistAnimationPackageV1(
  packageInput: AnimationPackageV1,
  options: PersistAnimationPackageOptions,
): PersistAnimationPackageResult {
  const errors: AnimationPersistenceIssue[] = [];
  if (!PORTABLE_ID.test(options.animationSetId) || !PORTABLE_ID.test(options.ownerId)) {
    errors.push({
      code: 'invalid-target',
      path: '$.options',
      message: 'animationSetId and ownerId must be portable ids.',
    });
  }
  if (!portablePath(options.packagePath) || !options.packagePath.endsWith('.json')
    || !isUnderRoot(options.packagePath, 'data/assets/animation-packages')
    || !portablePath(options.manifestPath) || !options.manifestPath.endsWith('.json')
    || !isUnderRoot(options.manifestPath, 'data/assets/animation-packages')
    || options.packagePath === options.manifestPath) {
    errors.push({
      code: 'invalid-target',
      path: '$.options',
      message: 'Package and manifest destinations must be distinct JSON paths under data/assets/animation-packages.',
    });
  }
  const artifacts = copy<AnimationStripArtifactV1[]>([
    ...(options.artifacts ?? packageInput.artifacts ?? []),
  ]);
  const packageData: AnimationPackageV1 = { ...copy(packageInput), artifacts };
  const qa = validateAnimationPackage(packageData);
  if (!qa.valid) {
    errors.push(...qa.issues
      .filter(issue => issue.severity === 'error')
      .map(issue => ({
        code: 'invalid-package' as const,
        path: issue.path,
        message: issue.message,
      })));
    return { ok: false, errors, qa };
  }

  const clipIds = new Set(packageData.clips.map(clip => clip.id));
  const artifactByClip = new Map(artifacts.map(artifact => [artifact.clipId, artifact]));
  if (!portablePath(packageData.source.path) || !isUnderRoot(packageData.source.path, 'assets')
    || (packageData.source.provenance !== undefined && !portablePath(packageData.source.provenance))) {
    errors.push({
      code: 'invalid-target',
      path: '$.source.path',
      message: 'Animation source and provenance must be canonical project paths, with source under assets.',
    });
  }
  packageData.clips.forEach((clip, index) => {
    if (!artifactByClip.has(clip.id)) {
      errors.push({
        code: 'missing-artifact',
        path: `$.clips[${index}]`,
        message: `Clip "${clip.id}" has no approved normalized strip artifact.`,
      });
    }
  });
  artifacts.forEach((artifact, index) => {
    if (!portablePath(artifact.path) || !isUnderRoot(artifact.path, 'assets')
      || !portablePath(artifact.provenance)) {
      errors.push({
        code: 'invalid-target',
        path: `$.artifacts[${index}].path`,
        message: `Artifact "${artifact.assetId}" path/provenance must be canonical, with strip bytes under assets.`,
      });
    }
    if (!clipIds.has(artifact.clipId)) {
      errors.push({
        code: 'unexpected-artifact',
        path: `$.artifacts[${index}]`,
        message: `Artifact "${artifact.assetId}" does not belong to a package clip.`,
      });
    }
  });
  const sharedScales = new Set(artifacts.map(artifact => artifact.normalization.sharedScale));
  if (sharedScales.size > 1) {
    errors.push({
      code: 'normalization-conflict',
      path: '$.artifacts',
      message: 'Every strip in one AnimationPackage must use the same normalization scale.',
    });
  }
  packageData.clips.forEach((clip, index) => {
    const artifact = artifactByClip.get(clip.id);
    if (artifact && !stableEqual(artifact.normalization.anchor, effectiveAnchor(packageData, index))) {
      errors.push({
        code: 'normalization-conflict',
        path: `$.artifacts.${clip.id}.normalization.anchor`,
        message: `Strip "${artifact.assetId}" does not use the authored shared anchor.`,
      });
    }
  });
  if (errors.length > 0) return { ok: false, errors, qa };
  packageData.qa = copy(qa);

  const strips: AnimationPackagePersistenceStripV1[] = packageData.clips.map((clip, index) => {
    const artifact = artifactByClip.get(clip.id)!;
    return {
      ...artifact,
      path: normalizePortablePath(artifact.path),
      provenance: normalizePortablePath(artifact.provenance),
      action: clip.action,
      direction: clip.direction,
      fps: clip.fps,
      loop: clip.loop,
      anchor: effectiveAnchor(packageData, index),
    };
  });
  const additions = packageData.clips.map((_, index) =>
    catalogEntry(packageData, strips[index], index, options));
  const additionSet: AnimationSetData = {
    id: options.animationSetId,
    ...(options.display ? { display: copy(options.display) } : {}),
    clips: strips.map(strip => ({
      action: strip.action,
      direction: strip.direction,
      asset: strip.assetId,
      frameSize: { width: strip.frameWidth, height: strip.frameHeight },
      frameCount: strip.frameCount,
      fps: strip.fps,
      loop: strip.loop,
      anchor: copy(strip.anchor),
    })),
  };
  const assetCatalog = mergeCatalog(options.existingCatalog, additions, errors);
  const mergedSets = mergeAnimationSet(options.existingAnimationSets, additionSet, errors);
  if (errors.length > 0) return { ok: false, errors, qa };

  return {
    ok: true,
    package: packageData,
    qa,
    assetCatalog,
    animationSets: mergedSets.sets,
    animationSet: copy(mergedSets.set),
    manifest: {
      schemaVersion: ANIMATION_PERSISTENCE_SCHEMA_VERSION,
      packageSchemaVersion: ANIMATION_PACKAGE_VERSION,
      packageId: packageData.id,
      animationSetId: options.animationSetId,
      packagePath: normalizePortablePath(options.packagePath),
      manifestPath: normalizePortablePath(options.manifestPath),
      source: {
        path: normalizePortablePath(packageData.source.path),
        sha256: packageData.source.sha256.toLowerCase(),
        ...(packageData.source.provenance
          ? { provenance: normalizePortablePath(packageData.source.provenance) }
          : {}),
      },
      strips,
    },
  };
}

/** Applies already-validated persistence output to a cloned editor state. */
export function applyAnimationPackagePersistenceToProject(
  state: FullProjectState,
  persistence: SuccessfulAnimationPackagePersistence,
  options: { assignToPlayer?: boolean } = {},
): FullProjectState {
  const next = copy(state);
  next.assets = copy(persistence.assetCatalog);
  next.databases.animations.sets = copy(persistence.animationSets);
  if (options.assignToPlayer === true) {
    next.databases.system.playerAnimationSet = persistence.animationSet.id;
  }
  return next;
}
