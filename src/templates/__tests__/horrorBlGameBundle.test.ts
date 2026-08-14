import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExplorationSimulation } from '../../runtime-core';
import {
  materializeHorrorBlGameBundle,
  materializeHorrorBlProjectState,
} from '../horrorBlGameBundle';
import { adaptHorrorBlVerticalSliceToRuntime } from '../horrorBlRuntimeAdapter';

const blueprintPath = resolve(process.cwd(), 'templates/horror-bl/data/content/vertical-slice.json');
const fixturePath = resolve(process.cwd(), 'templates/horror-bl/release-input/materialization-fixture.v1.json');
const releaseMaterializerPath = resolve(process.cwd(), 'scripts/dev/materialize-horror-bl-release.mjs');

function loadJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
}

describe('horror/BL GameBundle materialization', () => {
  it('compiles all three chapter maps into an offline GameBundle v1', () => {
    const blueprint = loadJson(blueprintPath);
    const fixture = loadJson(fixturePath);
    const before = JSON.stringify(blueprint);

    const result = materializeHorrorBlGameBundle(blueprint);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.bundle.maps)).toEqual(fixture.expected.mapIds);
    expect(result.bundle.project.startMapId).toBe('facility_lobby');
    expect(result.bundle.maps.facility_lobby.events.map(event => event.id)).toContain('freight_lift');
    expect(result.bundle.maps.archive_sublevel.events.map(event => event.id)).toContain('archive_lift');
    expect(result.bundle.maps.service_corridor.events.map(event => event.id)).toContain('archive_door');
    expect(result.bundle.assets?.assets).toEqual([]);
    expect(result.report).toMatchObject({
      blueprintId: fixture.blueprintId,
      mapIds: fixture.expected.mapIds,
      offlineOnly: true,
      externalReferencesAllowed: false,
    });
    expect(JSON.stringify(blueprint)).toBe(before);
    expect(JSON.stringify(result.bundle)).not.toMatch(/https?:\/\//i);
  });

  it('includes the canonical visual-novel adaptation used by the release materializer', () => {
    const blueprint = loadJson(blueprintPath);
    const adaptation = adaptHorrorBlVerticalSliceToRuntime(blueprint);
    const materializerSource = readFileSync(releaseMaterializerPath, 'utf8');

    const result = materializeHorrorBlGameBundle(blueprint, {
      dialogue: adaptation.dialogue,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.dialogueIncluded).toBe(true);
    expect(result.bundle.dialogue).toEqual(adaptation.dialogue);
    expect(result.bundle.dialogue?.scenes[adaptation.chapterId]).toMatchObject({
      entryNodeId: 'beat.arrival_message.audio.ambience',
    });
    expect(materializerSource).toContain('adaptHorrorBlVerticalSliceToRuntime(blueprint)');
    expect(materializerSource).toMatch(/dialogue:\s*runtimeAdaptation\.dialogue/);
  });

  it('keeps every map start in bounds and on a traversable tile', () => {
    const state = materializeHorrorBlProjectState(loadJson(blueprintPath));
    for (const map of Object.values(state.maps)) {
      const start = map.id === state.project.startMapId
        ? state.project.startPosition
        : { x: 2, y: Math.floor(map.height / 2) };
      const collision = map.layers.find(layer => layer.type === 'collision');
      expect(start.x).toBeGreaterThanOrEqual(0);
      expect(start.x).toBeLessThan(map.width);
      expect(start.y).toBeGreaterThanOrEqual(0);
      expect(start.y).toBeLessThan(map.height);
      expect(collision?.tiles[start.y * map.width + start.x]).toBe(0);
      expect(collision?.tiles[0]).toBe(9);
      expect(collision?.tiles[map.width - 1]).toBe(9);
    }
  });

  it('connects approved background slot IDs to maps without embedding external URLs', () => {
    const blueprint = loadJson(blueprintPath);
    const backgroundAssets = blueprint.maps.map((map: Record<string, string>) => ({
      id: map.backgroundSlot,
      name: `${map.name} background`,
      kind: 'image' as const,
      path: `assets/backgrounds/${map.id}.webp`,
      source: 'generated' as const,
      runtimeCompatible: true,
    }));

    const characterAndThreatAssets = [
      { id: 'portrait.damian', name: 'Damián portrait', kind: 'image' as const, path: 'assets/portraits/damian.webp', source: 'generated' as const, runtimeCompatible: true },
      { id: 'portrait.elian', name: 'Elian portrait', kind: 'image' as const, path: 'assets/portraits/elian.webp', source: 'generated' as const, runtimeCompatible: true },
      { id: 'threat.ninth-witness', name: 'Noveno Testigo', kind: 'image' as const, path: 'assets/sprites/ninth-witness.webp', source: 'generated' as const, runtimeCompatible: true },
      {
        id: 'sprite.damian.idle.down',
        name: 'Damián idle down',
        kind: 'spritesheet' as const,
        path: 'assets/sprites/damian_idle_down.webp',
        source: 'generated' as const,
        runtimeCompatible: true,
        frameWidth: 48,
        frameHeight: 64,
        frames: 4,
        generated: {
          ownerId: 'damian',
          spriteSheet: {
            frameWidth: 48,
            frameHeight: 64,
            frameCount: 4,
            action: 'idle',
            direction: 'down' as const,
            frameLayout: 'horizontal-strip' as const,
            transparentBackgroundRequired: true,
            animationSetId: 'actor.damian',
            fps: 6,
          },
        },
      },
    ];
    const assets = [...backgroundAssets, ...characterAndThreatAssets];
    const result = materializeHorrorBlGameBundle(blueprint, {
      assets: { schemaVersion: 1, assets },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const map of blueprint.maps) {
      expect(result.bundle.maps[map.id].parallax?.image).toBe(map.backgroundSlot);
    }
    expect(result.bundle.assets?.assets.map(asset => asset.id)).toEqual(
      assets.map(asset => asset.id),
    );
    expect(result.state.databases.actors.map(actor => actor.portraitAssetId)).toEqual([
      'portrait.damian',
      'portrait.elian',
    ]);
    expect(result.bundle.maps.service_corridor.events.find(event => event.id === 'chase_trigger')?.sprite)
      .toBe('threat.ninth-witness');
    expect(result.state.databases.system.playerAnimationSet).toBe('actor.damian');
    expect(new ExplorationSimulation({ bundle: result.bundle })
      .getRenderSnapshot().sprites.find(sprite => sprite.id === 'player')?.assetKey)
      .toBe('sprite.damian.idle.down');
  });

  it('fails closed before compilation when the blueprint is invalid', () => {
    const blueprint = loadJson(blueprintPath);
    blueprint.maps = blueprint.maps.slice(0, 1);

    const result = materializeHorrorBlGameBundle(blueprint);

    expect(result).toMatchObject({ ok: false, stage: 'blueprint' });
  });
});
