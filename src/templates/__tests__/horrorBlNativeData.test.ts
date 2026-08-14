import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const templateRoot = resolve(process.cwd(), 'templates/horror-bl');
const dataRoot = resolve(templateRoot, 'data');
const blueprintPath = resolve(dataRoot, 'content/vertical-slice.json');
const projectPath = resolve(dataRoot, 'project.json');

function loadJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any>;
}

function commandsFromMap(map: Record<string, any>): Record<string, any>[] {
  const result: Record<string, any>[] = [];
  const visit = (commands: Record<string, any>[] = []) => {
    for (const command of commands) {
      result.push(command);
      for (const key of ['then', 'else', 'victoryBranch', 'defeatBranch']) {
        if (Array.isArray(command[key])) visit(command[key]);
      }
      if (Array.isArray(command.choices)) {
        for (const choice of command.choices) visit(choice.commands);
      }
    }
  };
  for (const event of map.events ?? []) {
    visit(event.commands);
    for (const page of event.pages ?? []) visit(page.commands);
  }
  return result;
}

describe('horror/BL native runtime data', () => {
  const blueprint = loadJson(blueprintPath);
  const project = loadJson(projectPath);
  const maps = Object.fromEntries(project.maps.map((reference: Record<string, any>) => [
    reference.id,
    loadJson(resolve(templateRoot, reference.path)),
  ])) as Record<string, Record<string, any>>;
  const items = loadJson(resolve(templateRoot, project.database.items));
  const variables = loadJson(resolve(templateRoot, project.database.variables));
  const switches = loadJson(resolve(templateRoot, project.database.switches));

  it('materializes the blueprint beside, not over, the bundled sample project', () => {
    expect(project.schemaVersion).toBe(1);
    expect(project.title).toBe(blueprint.title);
    expect(project.startMapId).toBe(blueprint.startMapId);
    expect(project.maps.map((entry: Record<string, any>) => entry.id)).toEqual(
      blueprint.maps.map((entry: Record<string, any>) => entry.id),
    );
    expect(resolve(projectPath)).not.toBe(resolve(process.cwd(), 'data/project.json'));
    expect(loadJson(resolve(process.cwd(), 'data/project.json')).title).toBe('My First RPG');
  });

  it('keeps every native shard project-relative and present', () => {
    const declaredPaths = [
      ...project.maps.map((entry: Record<string, any>) => entry.path),
      ...Object.values(project.database),
    ] as string[];
    for (const declaredPath of declaredPaths) {
      expect(declaredPath).toMatch(/^data\//);
      expect(declaredPath).not.toContain('..');
      expect(existsSync(resolve(templateRoot, declaredPath))).toBe(true);
    }
    expect(dirname(projectPath)).toBe(dataRoot);
  });

  it('preserves map identity, dimensions, interactions, and traversable layers', () => {
    for (const sourceMap of blueprint.maps as Record<string, any>[]) {
      const map = maps[sourceMap.id];
      expect(map).toBeDefined();
      expect({ name: map.name, width: map.width, height: map.height, tileSize: map.tileSize }).toEqual({
        name: sourceMap.name,
        width: sourceMap.width,
        height: sourceMap.height,
        tileSize: sourceMap.tileSize,
      });
      expect(map.events.map((event: Record<string, any>) => event.id)).toEqual(
        expect.arrayContaining(sourceMap.interactions.map((interaction: Record<string, any>) => interaction.id)),
      );
      for (const layerName of ['ground', 'collision', 'region']) {
        const layer = map.layers.find((candidate: Record<string, any>) => candidate.name === layerName);
        expect(layer?.tiles).toHaveLength(map.width * map.height);
      }
      const collision = map.layers.find((layer: Record<string, any>) => layer.name === 'collision');
      expect(new Set(collision.tiles)).toEqual(new Set([0, 9]));
      for (const event of map.events as Record<string, any>[]) {
        expect(event.x).toBeGreaterThanOrEqual(0);
        expect(event.x).toBeLessThan(map.width);
        expect(event.y).toBeGreaterThanOrEqual(0);
        expect(event.y).toBeLessThan(map.height);
      }
    }

    const startMap = maps[project.startMapId];
    const collision = startMap.layers.find((layer: Record<string, any>) => layer.name === 'collision');
    expect(collision.tiles[project.startPosition.y * startMap.width + project.startPosition.x]).toBe(0);
  });

  it('materializes every declared map connection in both directions', () => {
    for (const sourceMap of blueprint.maps as Record<string, any>[]) {
      const eventIds = new Set(maps[sourceMap.id].events.map((event: Record<string, any>) => event.id));
      for (const connection of sourceMap.connections as Record<string, any>[]) {
        expect(eventIds.has(connection.exitId)).toBe(true);
        const targetEventIds = new Set(
          maps[connection.toMapId].events.map((event: Record<string, any>) => event.id),
        );
        expect(targetEventIds.has(connection.entryId)).toBe(true);
      }
    }
  });

  it('derives evidence items and initial state declarations without substitutions', () => {
    expect(items.items.map((item: Record<string, any>) => item.id)).toEqual(
      blueprint.evidence.map((entry: Record<string, any>) => entry.id),
    );
    for (const evidence of blueprint.evidence as Record<string, any>[]) {
      expect(items.items.find((item: Record<string, any>) => item.id === evidence.id)).toMatchObject({
        name: evidence.title,
        description: evidence.revelation,
        type: 'evidence',
      });
    }
    expect(variables.variables).toEqual(blueprint.state.variables.map((variable: Record<string, any>) => ({
      id: variable.id,
      name: variable.label,
      initial: variable.initial,
      min: variable.min,
      max: variable.max,
      description: variable.description,
    })));
    expect(switches.switches.map((entry: Record<string, any>) => ({ id: entry.id, initial: entry.initial }))).toEqual(
      blueprint.state.flags,
    );
  });

  it('uses only declared maps, items, variables, and switches in native commands', () => {
    const knownMaps = new Set(Object.keys(maps));
    const knownItems = new Set(items.items.map((entry: Record<string, any>) => entry.id));
    const knownVariables = new Set(variables.variables.map((entry: Record<string, any>) => entry.id));
    const knownSwitches = new Set(switches.switches.map((entry: Record<string, any>) => entry.id));
    const commands = Object.values(maps).flatMap(commandsFromMap);

    for (const command of commands) {
      if (command.type === 'transferMap' || command.type === 'setPlayerPosition') {
        expect(knownMaps.has(command.mapId)).toBe(true);
      }
      if (command.type === 'addItem' || command.type === 'removeItem') {
        expect(knownItems.has(command.itemId)).toBe(true);
      }
      if (command.type === 'controlVariable' || command.type === 'ifVariable') {
        expect(knownVariables.has(command.variableId)).toBe(true);
      }
      if (command.type === 'controlSwitch' || command.type === 'ifSwitch') {
        expect(knownSwitches.has(command.switchId)).toBe(true);
      }
    }
  });

  it('retains authored dialogue, choices, and both ending resolutions verbatim', () => {
    const serializedMaps = JSON.stringify(maps);
    for (const beat of blueprint.storyBeats as Record<string, any>[]) {
      for (const line of beat.lines ?? []) expect(serializedMaps).toContain(line.text);
      for (const option of beat.options ?? []) expect(serializedMaps).toContain(option.text);
    }
    for (const ending of blueprint.endings as Record<string, any>[]) {
      expect(serializedMaps).toContain(ending.title);
      expect(serializedMaps).toContain(ending.resolution);
      expect(serializedMaps).toContain(ending.chapterTwoHook);
    }
  });
});
