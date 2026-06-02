import type { FullProjectState } from './types';
import { mergeDatabases } from './defaultDatabases';
import { EMPTY_ASSET_CATALOG } from './defaultAssetCatalog';
import type { MapData } from '../types/project';
import { DEFAULT_VISUAL_PROFILE } from '../visual/visualProfile';

import tilesetsJson from '../../data/database/tilesets.json';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function projectTitle(input: string | undefined): string {
  const trimmed = (input ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'Untitled RPG';
}

function createStarterMap(): MapData {
  const width = 20;
  const height = 15;
  const tileSize = DEFAULT_VISUAL_PROFILE.tileSize;
  const count = width * height;
  return {
    schemaVersion: 1,
    id: 'town',
    name: 'Town',
    displayName: 'Town',
    tilesetId: 'sample-town',
    scrollType: 'none',
    battleback: '',
    encounterSteps: 30,
    encounters: [],
    parallax: {},
    width,
    height,
    tileSize,
    layers: [
      { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: new Array(count).fill(1) },
      { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'collision', type: 'collision', role: 'collision', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'region', type: 'region', role: 'region', visible: true, locked: false, tiles: new Array(count).fill(0) },
    ],
    events: [],
  };
}

export function createNewProjectState(title?: string): FullProjectState {
  const map = createStarterMap();
  return {
    project: {
      schemaVersion: 1,
      title: projectTitle(title),
      startMapId: map.id,
      startPosition: { x: 10, y: 7, direction: 'down' },
      maps: [{ id: map.id, path: 'data/maps/town.json', parentId: null, order: 0, expanded: true }],
      database: {
        items: 'data/database/items.json',
        actors: 'data/database/actors.json',
        classes: 'data/database/classes.json',
        skills: 'data/database/skills.json',
        weapons: 'data/database/weapons.json',
        armors: 'data/database/armors.json',
        states: 'data/database/states.json',
        types: 'data/database/types.json',
        terms: 'data/database/terms.json',
        enemies: 'data/database/enemies.json',
        troops: 'data/database/troops.json',
        quests: 'data/database/quests.json',
        shops: 'data/database/shops.json',
        system: 'data/database/system.json',
        switches: 'data/database/switches.json',
        variables: 'data/database/variables.json',
        commonEvents: 'data/database/commonEvents.json',
        animations: 'data/database/animations.json',
        tilesets: 'data/database/tilesets.json',
      },
      assetCatalog: 'data/assets/catalog.json',
      visualProfile: deepClone(DEFAULT_VISUAL_PROFILE),
    },
    maps: { [map.id]: map },
    items: { items: [] },
    databases: mergeDatabases({
      tilesets: {
        tilesets: Array.isArray((tilesetsJson as { tilesets?: unknown[] }).tilesets)
          ? deepClone(
              (tilesetsJson as {
                tilesets: FullProjectState['databases']['tilesets']['tilesets'];
              }).tilesets,
            )
          : [],
      },
    }),
    assets: deepClone(EMPTY_ASSET_CATALOG),
  };
}
