export const ANIMATION_PACKAGE_VERSION = 1 as const;

export interface AnimationPoint {
  x: number;
  y: number;
}

export interface AnimationRect extends AnimationPoint {
  width: number;
  height: number;
}

export interface AnimationGridV1 {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  origin?: AnimationPoint;
  spacing?: AnimationPoint;
}

export interface AnimationClipV1 {
  id: string;
  /** Runtime action name; kept separate from the human/stable clip id. */
  action: string;
  /** Runtime facing direction; `any` is reserved for directionless clips. */
  direction: AnimationDirectionV1;
  /** Zero-based, row-major cell indexes in playback order. */
  frameIndices: number[];
  fps: number;
  loop: boolean;
  /** Pixel-space pivot inside a cell. Defaults to bottom-center. */
  anchor?: AnimationPoint;
}

export type AnimationDirectionV1 = 'down' | 'left' | 'right' | 'up' | 'any';

export type AnimationArtifactSourceV1 = 'local' | 'imported' | 'generated';

/** Exact bytes emitted by the normalization/slicing stage for one clip. */
export interface AnimationStripArtifactV1 {
  clipId: string;
  assetId: string;
  path: string;
  sha256: string;
  source: AnimationArtifactSourceV1;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  /** Project-relative provenance document; never a credential or remote URL. */
  provenance: string;
  reviewStatus: 'approved' | 'frozen';
  normalization: {
    /** One scale applied to every source frame in this normalization pass. */
    sharedScale: number;
    /** Ground-contact anchor baked into every frame in this strip. */
    anchor: AnimationPoint;
    /** Runtime animation strips must retain transparency. */
    hasAlpha: true;
  };
}

export interface AnimationPackageV1 {
  schemaVersion: typeof ANIMATION_PACKAGE_VERSION;
  id: string;
  source: {
    path: string;
    sha256: string;
    width: number;
    height: number;
    layout: 'grid';
    provenance?: string;
  };
  grid: AnimationGridV1;
  clips: AnimationClipV1[];
  /** Optional until normalization finishes; persistence requires full coverage. */
  artifacts?: AnimationStripArtifactV1[];
  defaultAnchor?: AnimationPoint;
  /** Optional QA snapshot. Fresh validation should still run at trust boundaries. */
  qa?: AnimationPackageQaReport;
}

/** Compatibility input for the pre-contract grid prototype. */
export interface LegacyAnimationPackageV1 {
  version: typeof ANIMATION_PACKAGE_VERSION;
  id: string;
  image: { width: number; height: number };
  grid: AnimationGridV1;
  clips: Array<
    Omit<AnimationClipV1, 'frameIndices' | 'action' | 'direction'>
    & { cells: number[]; action?: string; direction?: AnimationDirectionV1 }
  >;
  defaultAnchor?: AnimationPoint;
}

export type AnimationQaSeverity = 'error' | 'warning';

export type AnimationQaCode =
  | 'invalid-package'
  | 'unsupported-version'
  | 'invalid-id'
  | 'invalid-source'
  | 'invalid-image-size'
  | 'invalid-grid'
  | 'grid-out-of-bounds'
  | 'missing-clips'
  | 'invalid-clip'
  | 'invalid-action'
  | 'invalid-direction'
  | 'duplicate-clip-id'
  | 'invalid-cell'
  | 'duplicate-cell'
  | 'invalid-anchor'
  | 'invalid-artifact'
  | 'duplicate-artifact-clip'
  | 'duplicate-artifact-id'
  | 'unknown-artifact-clip'
  | 'invalid-qa';

export interface AnimationQaIssue {
  code: AnimationQaCode;
  severity: AnimationQaSeverity;
  path: string;
  message: string;
}

export interface AnimationQaSummary {
  errors: number;
  warnings: number;
  clipCount: number;
  frameCount: number;
  uniqueCellCount: number;
}

export interface AnimationPackageQaReport {
  valid: boolean;
  packageVersion: number | null;
  issues: AnimationQaIssue[];
  summary: AnimationQaSummary;
}

export interface AnimationFrameLayout {
  frameIndex: number;
  cellIndex: number;
  column: number;
  row: number;
  sourceRect: AnimationRect;
  stripRect: AnimationRect;
  anchor: AnimationPoint;
}

export interface AnimationClipLayout {
  id: string;
  action: string;
  direction: AnimationDirectionV1;
  fps: number;
  loop: boolean;
  stripSize: { width: number; height: number };
  frames: AnimationFrameLayout[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function isPoint(value: unknown): value is AnimationPoint {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isImageSource(value: unknown): value is AnimationPackageV1['source'] {
  return isRecord(value)
    && typeof value.path === 'string'
    && isSafeRelativePath(value.path)
    && typeof value.sha256 === 'string'
    && isPositiveInteger(value.width)
    && isPositiveInteger(value.height)
    && value.layout === 'grid'
    && (value.provenance === undefined
      || (typeof value.provenance === 'string' && isSafeRelativePath(value.provenance)));
}

function isSafeRelativePath(value: string): boolean {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes(':')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false;
  return normalized.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

const ANIMATION_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const DIRECTIONS = new Set<AnimationDirectionV1>(['down', 'left', 'right', 'up', 'any']);
const RUNTIME_IMAGE = /\.(?:png|webp|bmp|jpe?g)$/i;

function isAnimationDirection(value: unknown): value is AnimationDirectionV1 {
  return typeof value === 'string' && DIRECTIONS.has(value as AnimationDirectionV1);
}

function isGrid(value: unknown): value is AnimationGridV1 {
  return isRecord(value)
    && isPositiveInteger(value.columns)
    && isPositiveInteger(value.rows)
    && isPositiveInteger(value.cellWidth)
    && isPositiveInteger(value.cellHeight)
    && (value.origin === undefined || (isPoint(value.origin) && value.origin.x >= 0 && value.origin.y >= 0))
    && (value.spacing === undefined || (isPoint(value.spacing) && value.spacing.x >= 0 && value.spacing.y >= 0));
}

function issue(
  issues: AnimationQaIssue[],
  code: AnimationQaCode,
  path: string,
  message: string,
  severity: AnimationQaSeverity = 'error',
): void {
  issues.push({ code, severity, path, message });
}

/**
 * Pure validation for data crossing file, plugin, or generation boundaries.
 * It deliberately returns every useful issue instead of failing at the first one.
 */
export function validateAnimationPackage(input: unknown): AnimationPackageQaReport {
  const issues: AnimationQaIssue[] = [];
  const emptySummary: AnimationQaSummary = {
    errors: 0,
    warnings: 0,
    clipCount: 0,
    frameCount: 0,
    uniqueCellCount: 0,
  };

  if (!isRecord(input)) {
    issue(issues, 'invalid-package', '$', 'Animation package must be an object.');
    return finishReport(null, issues, emptySummary);
  }

  const version = isFiniteNumber(input.schemaVersion) ? input.schemaVersion : null;
  if (version !== ANIMATION_PACKAGE_VERSION) {
    issue(issues, 'unsupported-version', '$.schemaVersion', 'Only AnimationPackage schema version 1 is supported.');
  }
  if (typeof input.id !== 'string' || !ANIMATION_ID.test(input.id)) {
    issue(issues, 'invalid-id', '$.id', 'Package id must be a portable structured id.');
  }

  const source = input.source;
  const sourceValid = isImageSource(source)
    && source.path.trim() !== ''
    && SHA256.test(source.sha256);
  if (!sourceValid) {
    issue(
      issues,
      'invalid-source',
      '$.source',
      'Source requires a non-empty path, SHA-256 hex digest, positive integer dimensions, and grid layout.',
    );
  }

  const grid = input.grid;
  const gridValid = isGrid(grid);
  if (!gridValid) {
    issue(
      issues,
      'invalid-grid',
      '$.grid',
      'Grid dimensions must be positive integers; origin and spacing must be finite, non-negative points.',
    );
  } else if (sourceValid) {
    const origin = grid.origin ?? { x: 0, y: 0 };
    const spacing = grid.spacing ?? { x: 0, y: 0 };
    const right = origin.x + grid.columns * grid.cellWidth + (grid.columns - 1) * spacing.x;
    const bottom = origin.y + grid.rows * grid.cellHeight + (grid.rows - 1) * spacing.y;
    if (right > source.width || bottom > source.height) {
      issue(
        issues,
        'grid-out-of-bounds',
        '$.grid',
        `Grid bounds ${right}x${bottom} exceed image bounds ${source.width}x${source.height}.`,
      );
    }
  }

  if (input.defaultAnchor !== undefined && (!isPoint(input.defaultAnchor)
    || (gridValid && (input.defaultAnchor.x < 0 || input.defaultAnchor.y < 0
      || input.defaultAnchor.x > grid.cellWidth || input.defaultAnchor.y > grid.cellHeight)))) {
    issue(issues, 'invalid-anchor', '$.defaultAnchor', 'Default anchor must contain finite x and y values.');
  }
  if (input.qa !== undefined && !isRecord(input.qa)) {
    issue(issues, 'invalid-qa', '$.qa', 'QA snapshot must be an object when provided.');
  }

  const clips = input.clips;
  if (!Array.isArray(clips) || clips.length === 0) {
    issue(issues, 'missing-clips', '$.clips', 'At least one animation clip is required.');
    return finishReport(version, issues, emptySummary);
  }

  const clipIds = new Set<string>();
  const uniqueCells = new Set<number>();
  let frameCount = 0;
  const cellCapacity = gridValid ? grid.columns * grid.rows : 0;

  clips.forEach((clip, clipIndex) => {
    const path = `$.clips[${clipIndex}]`;
    if (!isRecord(clip)) {
      issue(issues, 'invalid-clip', path, 'Clip must be an object.');
      return;
    }

    if (typeof clip.id !== 'string' || !ANIMATION_ID.test(clip.id)) {
      issue(issues, 'invalid-clip', `${path}.id`, 'Clip id must be a portable structured id.');
    } else if (clipIds.has(clip.id)) {
      issue(issues, 'duplicate-clip-id', `${path}.id`, `Clip id "${clip.id}" is duplicated.`);
    } else {
      clipIds.add(clip.id);
    }
    if (typeof clip.action !== 'string' || !ANIMATION_ID.test(clip.action)) {
      issue(issues, 'invalid-action', `${path}.action`, 'Clip action must be a portable structured id.');
    }
    if (!isAnimationDirection(clip.direction)) {
      issue(
        issues,
        'invalid-direction',
        `${path}.direction`,
        'Clip direction must be down, left, right, up, or any.',
      );
    }
    if (!isFiniteNumber(clip.fps) || clip.fps <= 0) {
      issue(issues, 'invalid-clip', `${path}.fps`, 'Clip fps must be a finite number greater than zero.');
    }
    if (typeof clip.loop !== 'boolean') {
      issue(issues, 'invalid-clip', `${path}.loop`, 'Clip loop must be a boolean.');
    }
    if (clip.anchor !== undefined && (!isPoint(clip.anchor)
      || (gridValid && (clip.anchor.x < 0 || clip.anchor.y < 0
        || clip.anchor.x > grid.cellWidth || clip.anchor.y > grid.cellHeight)))) {
      issue(issues, 'invalid-anchor', `${path}.anchor`, 'Clip anchor must contain finite x and y values.');
    }
    if (!Array.isArray(clip.frameIndices) || clip.frameIndices.length === 0) {
      issue(issues, 'invalid-clip', `${path}.frameIndices`, 'Clip must select at least one frame index.');
      return;
    }

    frameCount += clip.frameIndices.length;
    const cellsInClip = new Set<number>();
    clip.frameIndices.forEach((cell, cellIndex) => {
      const cellPath = `${path}.frameIndices[${cellIndex}]`;
      if (!isFiniteNumber(cell) || !Number.isInteger(cell) || cell < 0 || (gridValid && cell >= cellCapacity)) {
        issue(issues, 'invalid-cell', cellPath, `Cell must be an integer between 0 and ${Math.max(0, cellCapacity - 1)}.`);
        return;
      }
      uniqueCells.add(cell);
      if (cellsInClip.has(cell)) {
        issue(
          issues,
          'duplicate-cell',
          cellPath,
          `Cell ${cell} is repeated in clip "${String(clip.id)}".`,
          'warning',
        );
      }
      cellsInClip.add(cell);
    });
  });

  if (input.artifacts !== undefined) {
    if (!Array.isArray(input.artifacts)) {
      issue(issues, 'invalid-artifact', '$.artifacts', 'Artifacts must be an array when provided.');
    } else {
      const artifactClipIds = new Set<string>();
      const artifactIds = new Set<string>();
      input.artifacts.forEach((artifact, artifactIndex) => {
        const path = `$.artifacts[${artifactIndex}]`;
        if (!isRecord(artifact)) {
          issue(issues, 'invalid-artifact', path, 'Strip artifact must be an object.');
          return;
        }
        const clipId = typeof artifact.clipId === 'string' ? artifact.clipId : '';
        const assetId = typeof artifact.assetId === 'string' ? artifact.assetId : '';
        if (!clipIds.has(clipId)) {
          issue(issues, 'unknown-artifact-clip', `${path}.clipId`, `Unknown clip "${clipId}".`);
        } else if (artifactClipIds.has(clipId)) {
          issue(issues, 'duplicate-artifact-clip', `${path}.clipId`, `Clip "${clipId}" has multiple artifacts.`);
        }
        artifactClipIds.add(clipId);
        if (!ANIMATION_ID.test(assetId)) {
          issue(issues, 'invalid-artifact', `${path}.assetId`, 'Artifact assetId must be portable.');
        } else if (artifactIds.has(assetId)) {
          issue(issues, 'duplicate-artifact-id', `${path}.assetId`, `Artifact id "${assetId}" is duplicated.`);
        }
        artifactIds.add(assetId);

        const portablePath = typeof artifact.path === 'string'
          && isSafeRelativePath(artifact.path)
          && RUNTIME_IMAGE.test(artifact.path);
        const provenance = typeof artifact.provenance === 'string'
          && isSafeRelativePath(artifact.provenance);
        const dimensionsValid = isPositiveInteger(artifact.width)
          && isPositiveInteger(artifact.height)
          && isPositiveInteger(artifact.frameWidth)
          && isPositiveInteger(artifact.frameHeight)
          && isPositiveInteger(artifact.frameCount)
          && artifact.width === artifact.frameWidth * artifact.frameCount
          && artifact.height === artifact.frameHeight;
        const sourceValid = artifact.source === 'local'
          || artifact.source === 'imported'
          || artifact.source === 'generated';
        const reviewValid = artifact.reviewStatus === 'approved' || artifact.reviewStatus === 'frozen';
        const normalizationValid = isRecord(artifact.normalization)
          && isFiniteNumber(artifact.normalization.sharedScale)
          && artifact.normalization.sharedScale > 0
          && isPoint(artifact.normalization.anchor)
          && artifact.normalization.anchor.x >= 0
          && artifact.normalization.anchor.y >= 0
          && (!isPositiveInteger(artifact.frameWidth)
            || artifact.normalization.anchor.x <= artifact.frameWidth)
          && (!isPositiveInteger(artifact.frameHeight)
            || artifact.normalization.anchor.y <= artifact.frameHeight)
          && artifact.normalization.hasAlpha === true;
        if (!portablePath || !provenance || typeof artifact.sha256 !== 'string'
          || !SHA256.test(artifact.sha256) || !dimensionsValid || !sourceValid || !reviewValid
          || !normalizationValid) {
          issue(
            issues,
            'invalid-artifact',
            path,
            'Artifact requires an approved transparent local strip path, lowercase SHA-256, exact horizontal-strip geometry, shared normalization metadata, source, and provenance.',
          );
        }

        const clip = clips.find(candidate => isRecord(candidate) && candidate.id === clipId);
        if (clip && gridValid && Array.isArray(clip.frameIndices)
          && (artifact.frameWidth !== grid.cellWidth
            || artifact.frameHeight !== grid.cellHeight
            || artifact.frameCount !== clip.frameIndices.length)) {
          issue(
            issues,
            'invalid-artifact',
            path,
            'Artifact frame geometry must exactly match its authored clip and package cell size.',
          );
        }
      });
    }
  }

  return finishReport(version, issues, {
    errors: 0,
    warnings: 0,
    clipCount: clips.length,
    frameCount,
    uniqueCellCount: uniqueCells.size,
  });
}

function finishReport(
  version: number | null,
  issues: AnimationQaIssue[],
  summary: AnimationQaSummary,
): AnimationPackageQaReport {
  const errors = issues.filter(item => item.severity === 'error').length;
  const warnings = issues.length - errors;
  return {
    valid: errors === 0,
    packageVersion: version,
    issues,
    summary: { ...summary, errors, warnings },
  };
}

export function isAnimationPackageV1(input: unknown): input is AnimationPackageV1 {
  return validateAnimationPackage(input).valid;
}

/** Returns the source rectangle for a zero-based, row-major grid cell. */
export function gridCellRect(grid: AnimationGridV1, cellIndex: number): AnimationRect {
  const capacity = grid.columns * grid.rows;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= capacity) {
    throw new RangeError(`Cell index ${cellIndex} is outside grid capacity ${capacity}.`);
  }
  const origin = grid.origin ?? { x: 0, y: 0 };
  const spacing = grid.spacing ?? { x: 0, y: 0 };
  const column = cellIndex % grid.columns;
  const row = Math.floor(cellIndex / grid.columns);
  return {
    x: origin.x + column * (grid.cellWidth + spacing.x),
    y: origin.y + row * (grid.cellHeight + spacing.y),
    width: grid.cellWidth,
    height: grid.cellHeight,
  };
}

/**
 * Maps package clips to independent, tightly packed horizontal strips.
 * Callers can crop `sourceRect` into `stripRect` without image dependencies.
 */
export function calculateHorizontalStripClips(packageData: AnimationPackageV1): AnimationClipLayout[] {
  const report = validateAnimationPackage(packageData);
  if (!report.valid) {
    const firstError = report.issues.find(item => item.severity === 'error');
    throw new Error(`Invalid AnimationPackage v1: ${firstError?.path ?? '$'} ${firstError?.message ?? ''}`.trim());
  }

  const packageAnchor = packageData.defaultAnchor ?? {
    x: packageData.grid.cellWidth / 2,
    y: packageData.grid.cellHeight,
  };

  return packageData.clips.map(clip => {
    const anchor = clip.anchor ?? packageAnchor;
    const frames = clip.frameIndices.map((cellIndex, frameIndex): AnimationFrameLayout => ({
      frameIndex,
      cellIndex,
      column: cellIndex % packageData.grid.columns,
      row: Math.floor(cellIndex / packageData.grid.columns),
      sourceRect: gridCellRect(packageData.grid, cellIndex),
      stripRect: {
        x: frameIndex * packageData.grid.cellWidth,
        y: 0,
        width: packageData.grid.cellWidth,
        height: packageData.grid.cellHeight,
      },
      anchor: { ...anchor },
    }));
    return {
      id: clip.id,
      action: clip.action,
      direction: clip.direction,
      fps: clip.fps,
      loop: clip.loop,
      stripSize: {
        width: frames.length * packageData.grid.cellWidth,
        height: packageData.grid.cellHeight,
      },
      frames,
    };
  });
}

/** Converts the earlier in-memory prototype to the serializable v1 contract. */
export function adaptLegacyAnimationPackageV1(
  legacy: LegacyAnimationPackageV1,
  source: Pick<AnimationPackageV1['source'], 'path' | 'sha256'>,
): AnimationPackageV1 {
  return {
    schemaVersion: legacy.version,
    id: legacy.id,
    source: {
      ...source,
      width: legacy.image.width,
      height: legacy.image.height,
      layout: 'grid',
    },
    grid: { ...legacy.grid },
    clips: legacy.clips.map(clip => {
      const { cells, action, direction, ...metadata } = clip;
      const match = /^(.+?)[.-](down|left|right|up|any)$/.exec(clip.id);
      return {
        ...metadata,
        action: action ?? match?.[1] ?? clip.id,
        direction: direction ?? (match?.[2] as AnimationDirectionV1 | undefined) ?? 'any',
        frameIndices: [...cells],
      };
    }),
    defaultAnchor: legacy.defaultAnchor ? { ...legacy.defaultAnchor } : undefined,
  };
}
