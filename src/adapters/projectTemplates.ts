import type { FullProjectState, ProjectTemplateId } from './types';
import { mergeDatabases } from './defaultDatabases';
import { EMPTY_ASSET_CATALOG } from './defaultAssetCatalog';
import type { MapData } from '../types/project';
import { getSceneTemplate } from '../templates/sceneTemplates';
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
  const template = getSceneTemplate('town-street-16x9');
  const source = deepClone(template.map);
  const width = source.width;
  const height = source.height;
  const tileSize = DEFAULT_VISUAL_PROFILE.tileSize;
  const count = width * height;
  const sourceGround = source.layers.find(layer => layer.name === 'ground')?.tiles ?? new Array(count).fill(1);
  const sourceCollision = source.layers.find(layer => layer.name === 'collision')?.tiles ?? new Array(count).fill(0);
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
      { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: sourceGround },
      { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: new Array(count).fill(0) },
      { name: 'collision', type: 'collision', role: 'collision', visible: true, locked: false, tiles: sourceCollision },
      { name: 'region', type: 'region', role: 'region', visible: true, locked: false, tiles: new Array(count).fill(0) },
    ],
    events: source.events,
  };
}

export function createNewProjectState(title?: string): FullProjectState {
  const map = createStarterMap();
  return {
    templateId: 'blank',
    project: {
      schemaVersion: 1,
      title: projectTitle(title),
      startMapId: map.id,
      startPosition: deepClone(getSceneTemplate('town-street-16x9').startPosition),
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

/**
 * Creates the starter data for a named project template. The template's
 * documentation/assets live under `templates/<id>` and are copied by the
 * desktop shell during project creation; the marker is also safe to carry in
 * browser bundles where no filesystem exists.
 */
export function createProjectStateFromTemplate(
  templateId: ProjectTemplateId,
  title?: string,
): FullProjectState {
  const state = createNewProjectState(title);
  state.templateId = templateId;
  if (templateId === 'horror-bl') {
    state.project.title = (title ?? '').trim() || 'La Novena Promesa';
    state.project.visualProfile = {
      aspectRatio: '16:9',
      baseResolution: { width: 960, height: 540 },
      tileSize: 48,
      cameraMode: 'fixed-room',
      mapPresentation: 'full-scene',
      zoom: 1,
      integerScale: true,
    };
  }
  return state;
}
