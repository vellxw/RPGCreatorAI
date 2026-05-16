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
    expect(state.maps.town).toBeDefined();
    expect(state.maps.house).toBeDefined();
    expect(state.items.items.length).toBeGreaterThan(0);
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
    await a.saveAll(state);

    const blob = await a.exportAll(state);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.project.title).toBe('Roundtrip RPG');

    const fresh = new BrowserMemoryAdapter();
    const imported = await fresh.importAll(text);
    expect(imported.project.title).toBe('Roundtrip RPG');
  });

  it('importAll rejects malformed bundles', async () => {
    const a = new BrowserMemoryAdapter();
    await expect(a.importAll('{}')).rejects.toThrow();
    await expect(a.importAll('not json')).rejects.toThrow();
  });
});
