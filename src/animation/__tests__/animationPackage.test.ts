import { describe, expect, it } from 'vitest';
import {
  calculateHorizontalStripClips,
  gridCellRect,
  isAnimationPackageV1,
  validateAnimationPackage,
  type AnimationPackageV1,
} from '../animationPackage';
import {
  createAnimationPipelineJob,
  isAnimationPipelineReleaseReady,
  transitionAnimationPipelineJob,
} from '../animationPipeline';

const packageData: AnimationPackageV1 = {
  schemaVersion: 1,
  id: 'forest-hero',
  source: {
    path: 'sprites/forest-hero.png',
    sha256: 'a'.repeat(64),
    width: 140,
    height: 105,
    layout: 'grid',
  },
  grid: {
    columns: 4,
    rows: 3,
    cellWidth: 32,
    cellHeight: 32,
    origin: { x: 2, y: 3 },
    spacing: { x: 2, y: 3 },
  },
  defaultAnchor: { x: 16, y: 29 },
  clips: [
    { id: 'idle-down', action: 'idle', direction: 'down', frameIndices: [0, 1], fps: 4, loop: true },
    { id: 'walk-left', action: 'walk', direction: 'left', frameIndices: [7, 6, 5], fps: 10, loop: true, anchor: { x: 15, y: 30 } },
  ],
};

describe('AnimationPackage v1', () => {
  it('validates a complete package and reports deterministic QA totals', () => {
    const report = validateAnimationPackage(packageData);

    expect(report).toEqual({
      valid: true,
      packageVersion: 1,
      issues: [],
      summary: { errors: 0, warnings: 0, clipCount: 2, frameCount: 5, uniqueCellCount: 5 },
    });
    expect(isAnimationPackageV1(packageData)).toBe(true);
  });

  it('calculates source cells including origin/spacing and tight horizontal strips', () => {
    expect(gridCellRect(packageData.grid, 7)).toEqual({ x: 104, y: 38, width: 32, height: 32 });

    const [idle, walk] = calculateHorizontalStripClips(packageData);
    expect(idle.stripSize).toEqual({ width: 64, height: 32 });
    expect(idle.frames[1]).toMatchObject({
      frameIndex: 1,
      cellIndex: 1,
      column: 1,
      row: 0,
      sourceRect: { x: 36, y: 3, width: 32, height: 32 },
      stripRect: { x: 32, y: 0, width: 32, height: 32 },
      anchor: { x: 16, y: 29 },
    });
    expect(walk.frames[0].anchor).toEqual({ x: 15, y: 30 });
  });

  it('uses bottom-center as the effective anchor when none is authored', () => {
    const noAnchor: AnimationPackageV1 = {
      ...packageData,
      defaultAnchor: undefined,
      clips: [{ id: 'idle', action: 'idle', direction: 'any', frameIndices: [0], fps: 1, loop: true }],
    };

    expect(calculateHorizontalStripClips(noAnchor)[0].frames[0].anchor).toEqual({ x: 16, y: 32 });
  });

  it('returns structured errors for unsafe input without throwing', () => {
    const report = validateAnimationPackage({
      schemaVersion: 2,
      id: '',
      source: {
        path: 'sprites/invalid.png',
        sha256: 'b'.repeat(64),
        width: 64,
        height: 32,
        layout: 'grid',
      },
      grid: { columns: 3, rows: 1, cellWidth: 32, cellHeight: 32 },
      clips: [
        { id: 'walk', action: 'walk', direction: 'down', frameIndices: [0, 3], fps: 0, loop: 'yes' },
        { id: 'walk', action: 'walk', direction: 'down', frameIndices: [1, 1], fps: 8, loop: true, anchor: { x: Number.NaN, y: 10 } },
      ],
    });

    expect(report.valid).toBe(false);
    expect(report.summary).toEqual({ errors: 8, warnings: 1, clipCount: 2, frameCount: 4, uniqueCellCount: 2 });
    expect(report.issues.map(item => item.code)).toEqual(expect.arrayContaining([
      'unsupported-version',
      'invalid-id',
      'grid-out-of-bounds',
      'invalid-cell',
      'invalid-clip',
      'duplicate-clip-id',
      'invalid-anchor',
      'duplicate-cell',
    ]));
  });

  it('rejects cell lookup outside the authored grid', () => {
    expect(() => gridCellRect(packageData.grid, 12)).toThrow(RangeError);
  });

  it('keeps AI/import candidates quarantined until explicit review checkpoints', () => {
    const job = createAnimationPipelineJob({ id: 'candidate-1', package: packageData, createdAt: '2026-08-13T00:00:00.000Z' });
    expect(job.status).toBe('quarantined');
    const review = transitionAnimationPipelineJob(job, 'normalized', { reviewedAt: '2026-08-13T00:01:00.000Z' });
    const approved = transitionAnimationPipelineJob(
      transitionAnimationPipelineJob(review, 'review', { reviewedAt: '2026-08-13T00:02:00.000Z' }),
      'approved',
      { reviewedAt: '2026-08-13T00:03:00.000Z' },
    );
    expect(isAnimationPipelineReleaseReady(approved)).toBe(false);
    const frozen = transitionAnimationPipelineJob(approved, 'frozen', { reviewedAt: '2026-08-13T00:04:00.000Z' });
    expect(isAnimationPipelineReleaseReady(frozen)).toBe(true);
    expect(() => transitionAnimationPipelineJob(frozen, 'review')).toThrow(/cannot transition/);
  });
});
