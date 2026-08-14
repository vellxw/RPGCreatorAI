import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNewProjectState } from '../../adapters/projectTemplates';
import type { AnimationPackageV1 } from '../animationPackage';
import {
  applyAnimationPackagePersistenceToProject,
  persistAnimationPackageV1,
  registerAnimationSeedReference,
  type PersistAnimationPackageOptions,
} from '../animationPackagePersistence';

const fixture = JSON.parse(readFileSync(resolve(
  process.cwd(),
  'src/animation/__fixtures__/animation-package-persistence.v1.json',
), 'utf8')) as {
  package: AnimationPackageV1;
  options: PersistAnimationPackageOptions;
};

describe('AnimationPackage persistence bridge', () => {
  it('reproduces the retained Damián seed registration without creating clips', () => {
    const retained = JSON.parse(readFileSync(resolve(
      process.cwd(),
      'templates/horror-bl/data/assets/animation-packages/damian-seed.registration.v1.json',
    ), 'utf8')) as Record<string, any>;
    const result = registerAnimationSeedReference(
      retained.packageId,
      retained.animationSetId,
      retained.registrationPath,
      retained.seed,
    );

    expect(result).toEqual({ ok: true, registration: retained });
    expect(retained).not.toHaveProperty('clips');
    expect(retained.status).toBe('seed-ready-awaiting-strips');
  });

  it('persists exact strip artifacts into catalog, manifest, and AnimationSetData', () => {
    const before = JSON.stringify(fixture);

    const result = persistAnimationPackageV1(fixture.package, fixture.options);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.animationSet).toMatchObject({
      id: 'damian',
      display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
      clips: [
        { action: 'idle', direction: 'down', asset: 'sprite.damian.idle.down' },
        { action: 'walk', direction: 'down', asset: 'sprite.damian.walk.down' },
      ],
    });
    expect(result.assetCatalog.assets).toHaveLength(2);
    expect(result.assetCatalog.assets[0]).toMatchObject({
      id: 'sprite.damian.idle.down',
      kind: 'spritesheet',
      runtimeCompatible: true,
      provenance: 'data/assets/animation-packages/damian-idle-walk.provenance.v1.json',
      width: 192,
      height: 64,
      frameWidth: 48,
      frameHeight: 64,
      frames: 4,
      generated: {
        ownerId: 'damian',
        spriteSheet: {
          animationSetId: 'damian',
          action: 'idle',
          direction: 'down',
          anchor: { x: 24, y: 62 },
        },
      },
    });
    expect(result.manifest.strips.map(strip => strip.sha256)).toEqual([
      'b'.repeat(64),
      'c'.repeat(64),
    ]);
    expect(result.manifest.source.sha256).toBe('a'.repeat(64));
    expect(result.manifest).toMatchObject({
      packagePath: 'data/assets/animation-packages/damian-idle-walk.animation-package.v1.json',
      manifestPath: 'data/assets/animation-packages/damian-idle-walk.persistence.v1.json',
    });
    const sourceState = createNewProjectState('Persistence fixture');
    const persistedState = applyAnimationPackagePersistenceToProject(sourceState, result, {
      assignToPlayer: true,
    });
    expect(persistedState.assets?.assets).toHaveLength(2);
    expect(persistedState.databases.animations.sets).toEqual(result.animationSets);
    expect(persistedState.databases.system.playerAnimationSet).toBe('damian');
    expect(sourceState.databases.system.playerAnimationSet).toBeUndefined();
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('is idempotent and can merge multiple packages into one persisted set', () => {
    const first = persistAnimationPackageV1(fixture.package, fixture.options);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const repeated = persistAnimationPackageV1(fixture.package, {
      ...fixture.options,
      existingCatalog: first.assetCatalog,
      existingAnimationSets: first.animationSets,
    });
    expect(repeated.ok).toBe(true);
    if (!repeated.ok) return;
    expect(repeated.assetCatalog.assets).toHaveLength(2);
    expect(repeated.animationSet.clips).toHaveLength(2);

    const interact: AnimationPackageV1 = {
      ...fixture.package,
      id: 'fixture.damian.interact',
      source: { ...fixture.package.source, sha256: 'd'.repeat(64) },
      grid: { columns: 4, rows: 1, cellWidth: 48, cellHeight: 64 },
      clips: [{
        id: 'interact.down',
        action: 'interact',
        direction: 'down',
        frameIndices: [0, 1, 2, 3],
        fps: 6,
        loop: false,
      }],
      artifacts: [{
        ...fixture.package.artifacts![0],
        clipId: 'interact.down',
        assetId: 'sprite.damian.interact.down',
        path: 'assets/generated/runtime/sprites/damian_interact_down.png',
        sha256: 'e'.repeat(64),
      }],
    };
    const merged = persistAnimationPackageV1(interact, {
      ...fixture.options,
      existingCatalog: repeated.assetCatalog,
      existingAnimationSets: repeated.animationSets,
    });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.assetCatalog.assets).toHaveLength(3);
    expect(merged.animationSet.clips.map(clip => `${clip.action}.${clip.direction}`)).toEqual([
      'idle.down',
      'interact.down',
      'walk.down',
    ]);
  });

  it('registers an approved seed without pretending that animation strips exist', () => {
    const result = registerAnimationSeedReference(
      'damian-idle-v1',
      'damian',
      'data/assets/animation-packages/damian-seed.registration.v1.json',
      {
        assetId: 'seed.damian.full-body',
        path: 'assets/source/generated/damian-full-body-seed.png',
        sha256: 'f'.repeat(64),
        width: 1024,
        height: 1024,
        provenance: 'assets/source/generated/damian-seed-session.v1.json',
        source: 'generated',
        reviewStatus: 'approved',
      },
    );

    expect(result).toMatchObject({
      ok: true,
      registration: {
        status: 'seed-ready-awaiting-strips',
        blockers: [{ code: 'normalized-strips-required' }],
      },
    });
  });

  it('fails closed when a clip has no real strip or geometry drifts', () => {
    const missing = persistAnimationPackageV1(
      { ...fixture.package, artifacts: fixture.package.artifacts?.slice(0, 1) },
      fixture.options,
    );
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.map(error => error.code)).toContain('missing-artifact');

    const malformed: AnimationPackageV1 = {
      ...fixture.package,
      artifacts: fixture.package.artifacts?.map((artifact, index) =>
        index === 0 ? { ...artifact, frameCount: 3, width: 144 } : artifact),
    };
    const invalid = persistAnimationPackageV1(malformed, fixture.options);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.errors.map(error => error.code)).toContain('invalid-package');
  });
});
