import { describe, it, expect } from 'vitest';
import { BrowserMemoryAdapter } from '../../adapters/BrowserMemoryAdapter';
import { validateProject } from '../validateProject';
import type { FullProjectState } from '../../adapters/types';
import type { EventCommand, GameEvent } from '../../types/project';

type LooseCommand = { type: string } & Record<string, unknown>;

function walkCommands(cmds: { type: string }[] | undefined, visit: (cmd: LooseCommand) => void): void {
  for (const cmd of cmds ?? []) {
    const c = cmd as LooseCommand;
    visit(c);
    if (Array.isArray(c.then)) walkCommands(c.then as { type: string }[], visit);
    if (Array.isArray(c.else)) walkCommands(c.else as { type: string }[], visit);
    if (Array.isArray(c.choices)) {
      for (const choice of c.choices as Array<{ commands: { type: string }[] }>) {
        walkCommands(choice.commands, visit);
      }
    }
    if (Array.isArray(c.victoryBranch)) walkCommands(c.victoryBranch as { type: string }[], visit);
    if (Array.isArray(c.defeatBranch)) walkCommands(c.defeatBranch as { type: string }[], visit);
  }
}

function collectCommands(state: FullProjectState): LooseCommand[] {
  const commands: LooseCommand[] = [];
  for (const map of Object.values(state.maps)) {
    for (const event of map.events) {
      walkCommands(event.commands, command => commands.push(command));
      for (const page of event.pages ?? []) {
        walkCommands(page.commands, command => commands.push(command));
      }
    }
  }
  for (const commonEvent of state.databases.commonEvents) {
    walkCommands(commonEvent.commands, command => commands.push(command));
  }
  return commands;
}

function sampleEvents(state: FullProjectState): GameEvent[] {
  return Object.values(state.maps).flatMap(map => map.events);
}

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
    expect(state.databases.system.playerAnimationSet).toBe('player_adventurer');
    expect(state.databases.system.playerMovementSpeed).toBe('double');
    expect(state.databases.system.defaultCharacterHeightTiles).toBe(1.5);
    expect(state.databases.animations.sets.length).toBeGreaterThan(0);
    expect(state.databases.animations.sets[0].display?.heightTiles).toBe(1.5);
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
      'playAnimation',
    ]) {
      expect(seen).toContain(required);
    }
  });

  it('sample project exercises the Phase 10 MVP command surface', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    const commands = collectCommands(state);
    const seen = new Set(commands.map(cmd => cmd.type));

    for (const required of [
      'showChoices',
      'controlSelfSwitch',
      'ifSelfSwitch',
      'setMovementRoute',
      'playSound',
      'pluginCommand',
    ]) {
      expect(seen).toContain(required);
    }

    const choice = commands.find(cmd => cmd.type === 'showChoices') as
      | ({ choices?: Array<{ label: string; commands: EventCommand[] }> } & LooseCommand)
      | undefined;
    expect(choice?.choices?.map(option => option.label)).toEqual(
      expect.arrayContaining(['Si, te ayudo', 'Ahora no']),
    );
    expect(choice?.choices?.every(option => option.commands.length > 0)).toBe(true);

    expect(commands.some(cmd =>
      cmd.type === 'setMovementRoute' &&
      cmd.target === 'event' &&
      typeof cmd.eventId === 'string' &&
      Array.isArray(cmd.steps) &&
      cmd.steps.length >= 2,
    )).toBe(true);
    expect(commands.some(cmd =>
      cmd.type === 'pluginCommand' &&
      cmd.pluginId === 'debug' &&
      cmd.command === 'log',
    )).toBe(true);
  });

  it('sample project includes self-switch pages, gated common events, and foreground occlusion', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    const selfSwitchPages = sampleEvents(state).flatMap(event =>
      (event.pages ?? []).filter(page => page.conditions.selfSwitches && Object.keys(page.conditions.selfSwitches).length > 0),
    );
    const switchIds = new Set(state.databases.switches.map(s => s.id));
    const gatedCommonEvents = state.databases.commonEvents.filter(event =>
      (event.trigger === 'autorun' || event.trigger === 'parallel') &&
      !!event.switchId &&
      switchIds.has(event.switchId),
    );
    const foregroundTileCount = Object.values(state.maps).reduce((count, map) => {
      const foreground = map.layers.find(layer => layer.role === 'foreground' || layer.name === 'foreground');
      return count + (foreground?.tiles.filter(tile => tile !== 0).length ?? 0);
    }, 0);

    expect(selfSwitchPages.length).toBeGreaterThan(0);
    expect(gatedCommonEvents.length).toBeGreaterThan(0);
    expect(foregroundTileCount).toBeGreaterThan(0);
  });

  it('opens on a full-scene widescreen town instead of the old tiny square board', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    expect(state.project.visualProfile).toMatchObject({
      aspectRatio: '16:9',
      baseResolution: { width: 1280, height: 720 },
    });
    expect(state.maps.town.width).toBeGreaterThanOrEqual(40);
    expect(state.maps.town.height).toBeGreaterThanOrEqual(23);
    expect(state.maps.town.layers[0].tiles).not.toContain(0);
  });

  it('includes accepted local mock generation evidence for complete-platform workflows', async () => {
    const adapter = new BrowserMemoryAdapter();
    const state = await adapter.loadProject();
    const assets = state.assets?.assets ?? [];

    expect([...new Set(assets.map(asset => asset.kind))]).toEqual(
      expect.arrayContaining(['image', 'spritesheet', 'tileset', 'audio', 'generated']),
    );

    const acceptedGeneratedAssets = assets.filter(asset =>
      asset.source === 'generated' &&
      asset.generated?.providerId === 'local' &&
      asset.generated.visualQa?.status === 'accepted',
    );
    expect(acceptedGeneratedAssets.map(asset => asset.id)).toEqual(
      expect.arrayContaining(['sample_town_tiles', 'shopkeeper_portrait']),
    );
    expect(acceptedGeneratedAssets.every(asset =>
      !!asset.generated?.promptTemplateId &&
      !!asset.generated.modelId &&
      asset.generated.visualQa?.unresolvedWarnings.length === 0,
    )).toBe(true);

    expect(state.project.generationHistory?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'sample-history-tileset',
          reviewState: 'accepted',
          providerId: 'local',
          linkedOutputs: expect.arrayContaining([
            expect.objectContaining({ kind: 'asset', id: 'sample_town_tiles' }),
            expect.objectContaining({ kind: 'database', table: 'tilesets', id: 'sample-town' }),
          ]),
        }),
        expect.objectContaining({
          id: 'sample-history-quest',
          kind: 'structured-data',
          operation: 'quest.generate',
          providerId: 'local',
          reviewState: 'accepted',
          linkedOutputs: expect.arrayContaining([
            expect.objectContaining({ kind: 'database', table: 'quests', id: 'lost_chest' }),
            expect.objectContaining({ kind: 'event', id: 'old_man' }),
          ]),
        }),
      ]),
    );
  });
});
