import { describe, it, expect } from 'vitest';
import { BrowserMemoryAdapter } from '../BrowserMemoryAdapter';

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
    await a.saveAll(state);

    const blob = await a.exportAll(state);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.project.title).toBe('Roundtrip RPG');

    const fresh = new BrowserMemoryAdapter();
    const imported = await fresh.importAll(text);
    expect(imported.project.title).toBe('Roundtrip RPG');
    expect(imported.project.database.audio).toBe('data/database/audio.json');
    expect(imported.databases.types.weaponTypes.map(type => type.id)).toContain('axe');
    expect(imported.databases.terms.currencyUnit).toBe('Credits');
    expect(imported.databases.audio?.audio?.confirm).toBe('assets/audio/confirm.wav');
    expect(imported.databases.audio?.sounds?.[0].id).toBe('click');
    expect(imported.databases.audio?.bgm?.[0].path).toBe('assets/audio/town.wav');
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
