import { describe, it, expect } from 'vitest';
import { BrowserMemoryAdapter } from '../../adapters/BrowserMemoryAdapter';
import { validateProject } from '../validateProject';

describe('Bundled sample project (Phase 6 slice 10)', () => {
  it('validates with zero errors', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    const report = validateProject(state);
    if (report.errors.length > 0) {
      console.log('Validation errors:', report.errors);
    }
    expect(report.errors).toEqual([]);
  });

  it('exposes every Phase 6 database with at least one entry', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    expect(state.databases.actors.length).toBeGreaterThan(0);
    expect(state.databases.classes.length).toBeGreaterThan(0);
    expect(state.databases.skills.length).toBeGreaterThan(0);
    expect(state.databases.enemies.length).toBeGreaterThan(0);
    expect(state.databases.troops.length).toBeGreaterThan(0);
    expect(state.databases.quests.length).toBeGreaterThan(0);
    expect(state.databases.shops.length).toBeGreaterThan(0);
    expect(state.databases.switches.length).toBeGreaterThan(0);
    expect(state.databases.commonEvents.length).toBeGreaterThan(0);
    expect(state.databases.system.startingParty.length).toBeGreaterThan(0);
  });

  it('sample town map exercises every category of v1 commands', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    const town = state.maps.town;
    expect(town).toBeDefined();
    const seen = new Set<string>();
    const walk = (cmds: { type: string }[]): void => {
      for (const cmd of cmds) {
        seen.add(cmd.type);
        const c = cmd as Record<string, unknown>;
        if (Array.isArray(c.then)) walk(c.then as { type: string }[]);
        if (Array.isArray(c.else)) walk(c.else as { type: string }[]);
        if (Array.isArray(c.choices)) {
          for (const choice of c.choices as Array<{ commands: { type: string }[] }>) {
            walk(choice.commands);
          }
        }
        if (Array.isArray(c.victoryBranch)) walk(c.victoryBranch as { type: string }[]);
        if (Array.isArray(c.defeatBranch)) walk(c.defeatBranch as { type: string }[]);
      }
    };
    for (const event of town.events) walk(event.commands);

    // Sanity: the sample exercises a representative subset.
    for (const required of [
      'showText',
      'showChoices',
      'ifSwitch',
      'controlSwitch',
      'controlVariable',
      'addGold',
      'addItem',
      'startQuest',
      'completeQuest',
      'openShop',
      'startBattle',
      'transferMap',
    ]) {
      expect(seen).toContain(required);
    }
  });
});
