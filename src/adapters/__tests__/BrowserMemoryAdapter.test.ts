import { describe, it, expect } from 'vitest';
import { BrowserMemoryAdapter } from '../BrowserMemoryAdapter';
import type { AssetCatalogEntry } from '../../types/project';

describe('BrowserMemoryAdapter', () => {
  it('reports browser-mode capabilities honestly', () => {
    const a = new BrowserMemoryAdapter();
    const caps = a.getCapabilities();
    expect(caps.canReadFiles).toBe(false);
    expect(caps.canWriteFiles).toBe(false);
    expect(caps.canCreateBackups).toBe(false);
    expect(caps.adapterName).toBe('BrowserMemoryAdapter');
  });

  it('loads a project with the seeded data', async () => {
    const a = new BrowserMemoryAdapter();
    const state = await a.loadProject();
    expect(state.project.title).toBe('My First RPG');
    expect(state.project.visualProfile).toMatchObject({
      aspectRatio: '16:9',
      baseResolution: { width: 1280, height: 720 },
    });
    expect(state.maps.town).toBeDefined();
    expect(state.maps.house).toBeDefined();
    expect(state.items.items.length).toBeGreaterThan(0);
    expect(state.databases.weapons.map(w => w.id)).toContain('iron_sword');
    expect(state.databases.armors.map(armor => armor.id)).toContain('leather_armor');
    expect(state.databases.states.map(status => status.id)).toContain('poison');
    expect(state.project.database.types).toBe('data/database/types.json');
    expect(state.project.database.terms).toBe('data/database/terms.json');
    expect(state.project.assetCatalog).toBe('data/assets/catalog.json');
    expect(state.assets?.assets.map(asset => asset.id)).toContain('player_adventurer_sheet');
    expect(state.databases.types.weaponTypes.map(type => type.id)).toContain('sword');
    expect(state.databases.types.equipmentSlots.map(slot => slot.id)).toEqual(
      expect.arrayContaining(['weapon', 'armor', 'accessory']),
    );
    expect(state.databases.terms.currencyUnit).toBe('G');
    expect(state.databases.terms.stats.attack).toBe('Attack');
  });

  it('saveProject updates the in-memory snapshot', async () => {
    const a = new BrowserMemoryAdapter();
    const before = await a.loadProject();
    const next = { ...before.project, title: 'Renamed RPG' };
    const result = await a.saveProject(next);
    expect(result.success).toBe(true);
    const after = await a.loadProject();
    expect(after.project.title).toBe('Renamed RPG');
  });

  it('saveAll roundtrips the full project', async () => {
    const a = new BrowserMemoryAdapter();
    const state = await a.loadProject();
    state.maps.town.events[0].x = 99;
    const result = await a.saveAll(state);
    expect(result.success).toBe(true);
    const reloaded = await a.loadProject();
    expect(reloaded.maps.town.events[0].x).toBe(99);
  });

  it('export → import roundtrip preserves data', async () => {
    const a = new BrowserMemoryAdapter();
    const state = await a.loadProject();
    state.project.title = 'Roundtrip RPG';
    state.project.database.audio = 'data/database/audio.json';
    state.databases.types.weaponTypes.push({ id: 'axe', name: 'Axe' });
    state.databases.terms.currencyUnit = 'Credits';
    state.databases.audio = {
      audio: { confirm: 'assets/audio/confirm.wav' },
      sounds: [{ id: 'click', path: 'assets/audio/click.wav' }],
      bgm: [{ id: 'town', path: 'assets/audio/town.wav' }],
    };
    expect(state.assets).toBeDefined();
    state.assets!.assets.push({
      id: 'roundtrip_audio',
      name: 'Roundtrip Audio',
      kind: 'audio',
      path: 'assets/audio/roundtrip.wav',
      source: 'local',
      tags: ['test'],
    });
    await a.saveAll(state);

    const blob = await a.exportAll(state);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.project.title).toBe('Roundtrip RPG');
    expect(parsed.assets.assets.map((asset: { id: string }) => asset.id)).toContain('roundtrip_audio');

    const fresh = new BrowserMemoryAdapter();
    const imported = await fresh.importAll(text);
    expect(imported.project.title).toBe('Roundtrip RPG');
    expect(imported.project.database.audio).toBe('data/database/audio.json');
    expect(imported.databases.types.weaponTypes.map(type => type.id)).toContain('axe');
    expect(imported.databases.terms.currencyUnit).toBe('Credits');
    expect(imported.databases.audio?.audio?.confirm).toBe('assets/audio/confirm.wav');
    expect(imported.databases.audio?.sounds?.[0].id).toBe('click');
    expect(imported.databases.audio?.bgm?.[0].path).toBe('assets/audio/town.wav');
    expect(imported.assets?.assets.map(asset => asset.id)).toContain('roundtrip_audio');
  });

  it('export → import roundtrip preserves integrated imported asset library references', async () => {
    const a = new BrowserMemoryAdapter();
    const state = await a.loadProject();
    const importedAssets: AssetCatalogEntry[] = [
      {
        id: 'hero_portrait_imported',
        name: 'Hero Portrait Imported',
        kind: 'image',
        source: 'imported',
        path: 'assets/imported/images/hero-portrait.png',
        tags: ['imported', 'image', 'runtime'],
        provenance: 'Local integration fixture',
        runtimeCompatible: true,
        runtimeNotes: 'Ready for runtime export.',
        protected: true,
        width: 128,
        height: 128,
      },
      {
        id: 'hero_run_sheet',
        name: 'Hero Run Sheet',
        kind: 'spritesheet',
        source: 'imported',
        path: 'assets/imported/spritesheets/hero-run-sheet.png',
        tags: ['imported', 'spritesheet'],
        frameWidth: 64,
        frameHeight: 64,
        frames: 6,
      },
      {
        id: 'forest_pack',
        name: 'Forest Pack',
        kind: 'tileset',
        source: 'imported',
        path: 'assets/imported/tilesets/forest-pack.png',
        tags: ['imported', 'tileset'],
        width: 256,
        height: 256,
      },
      {
        id: 'town_loop',
        name: 'Town Loop',
        kind: 'audio',
        source: 'imported',
        path: 'assets/imported/audio/town-loop.wav',
        tags: ['imported', 'audio', 'bgm'],
        durationMs: 120000,
      },
    ];
    state.assets!.assets.push(...importedAssets);
    state.databases.animations.sets.push({
      id: 'hero_run_imported',
      display: { heightTiles: 1.5, widthTiles: 1, yOffsetPx: 0 },
      clips: [
        {
          action: 'run',
          direction: 'right',
          asset: 'hero_run_sheet',
          frameSize: { width: 64, height: 64 },
          frameCount: 6,
          fps: 10,
          loop: true,
          anchor: { x: 32, y: 54 },
        },
      ],
    });
    state.databases.tilesets.tilesets.push({
      id: 'forest_tiles',
      name: 'Forest Pack',
      tileSize: 16,
      tiles: [
        {
          id: 0,
          name: 'Tile 0',
          asset: 'forest_pack',
          group: 'A',
          passability: 'blocked',
          priority: 0,
        },
      ],
    });
    state.databases.system.audio = {
      ...state.databases.system.audio,
      town_loop: 'assets/imported/audio/town-loop.wav',
    };

    const originalCatalogSnapshot = JSON.stringify(state.assets);
    const blob = await a.exportAll(state);
    const imported = await new BrowserMemoryAdapter().importAll(await blob.text());
    const assetsById = Object.fromEntries(
      imported.assets!.assets.map(asset => [asset.id, asset]),
    );

    expect(assetsById.hero_portrait_imported).toMatchObject({
      kind: 'image',
      path: 'assets/imported/images/hero-portrait.png',
      provenance: 'Local integration fixture',
      runtimeCompatible: true,
      runtimeNotes: 'Ready for runtime export.',
      protected: true,
      width: 128,
      height: 128,
    });
    expect(assetsById.hero_run_sheet).toMatchObject({
      kind: 'spritesheet',
      frameWidth: 64,
      frameHeight: 64,
      frames: 6,
    });
    expect(assetsById.forest_pack).toMatchObject({ kind: 'tileset', width: 256, height: 256 });
    expect(assetsById.town_loop).toMatchObject({ kind: 'audio', durationMs: 120000 });
    expect(imported.databases.animations.sets.find(set => set.id === 'hero_run_imported')?.clips[0].asset).toBe(
      'hero_run_sheet',
    );
    expect(imported.databases.tilesets.tilesets.find(tileset => tileset.id === 'forest_tiles')?.tiles[0].asset).toBe(
      'forest_pack',
    );
    expect(imported.databases.system.audio?.town_loop).toBe('assets/imported/audio/town-loop.wav');
    expect(JSON.stringify(state.assets)).toBe(originalCatalogSnapshot);
  });

  it('export → import roundtrip preserves polished map metadata', async () => {
    const a = new BrowserMemoryAdapter();
    const state = await a.loadProject();
    state.project.startPosition = { x: 3, y: 4, direction: 'right' };
    state.maps.town.scrollType = 'both';
    state.maps.town.battleback = 'field';
    state.maps.town.encounterSteps = 18;
    state.maps.town.parallax = {
      image: 'clouds',
      loopX: true,
      loopY: false,
      scrollX: 1.5,
      scrollY: -0.5,
    };

    const blob = await a.exportAll(state);
    const imported = await new BrowserMemoryAdapter().importAll(await blob.text());

    expect(imported.project.startPosition).toEqual({ x: 3, y: 4, direction: 'right' });
    expect(imported.maps.town.scrollType).toBe('both');
    expect(imported.maps.town.battleback).toBe('field');
    expect(imported.maps.town.encounterSteps).toBe(18);
    expect(imported.maps.town.parallax).toEqual({
      image: 'clouds',
      loopX: true,
      loopY: false,
      scrollX: 1.5,
      scrollY: -0.5,
    });
  });

  it('importAll rejects malformed bundles', async () => {
    const a = new BrowserMemoryAdapter();
    await expect(a.importAll('{}')).rejects.toThrow();
    await expect(a.importAll('not json')).rejects.toThrow();
  });
});
