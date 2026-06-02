// Cross-project validation that spans maps, items, and the Phase 6 databases.

import type {
  AssetCatalogData,
  AssetKind,
  AssetSource,
  CommonEventData,
  DatabaseEntries,
  EventCommand,
  GameEvent,
  ItemDatabase,
  MapData,
  ProjectData,
  Stats,
  TilesetDatabaseData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { validateMap } from './validateMap';
import { isSupportedVisualTile, TILE_ASSET_KEYS } from '../visual/tileCatalog';
import { animationSheetKeys } from '../assets/generated/assetCatalog';
import { DEFAULT_AUDIO_REGISTRY, mergeAudioRegistry } from '../audio/audioRegistry';
import {
  findPluginCommandDefinition,
  pluginCommandKey,
  type PluginCommandArgDefinition,
} from '../plugins/pluginCommandRegistry';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];
const VALID_COMMON_EVENT_TRIGGERS = ['manual', 'autorun', 'parallel'];
const VALID_TILE_GROUPS = new Set(['A', 'B', 'C', 'D', 'E', 'Region', 'Collision']);
const VALID_TILE_PASSABILITY = new Set(['passable', 'blocked']);
const VALID_LEGACY_ITEM_TYPES = new Set(['weapon', 'armor']);
const VALID_STATE_RESTRICTIONS = new Set(['none', 'cannotMove']);
const VALID_SKILL_TARGETS = new Set(['singleEnemy', 'allEnemies', 'singleAlly', 'allAllies', 'self']);
const STAT_KEYS: Array<keyof Stats> = [
  'maxHp',
  'maxMp',
  'attack',
  'defense',
  'magicAttack',
  'magicDefense',
  'agility',
  'luck',
];
const VALID_MOVEMENT_SPEEDS = new Set([
  'oneEighth',
  'oneQuarter',
  'half',
  'normal',
  'double',
  'quadruple',
]);
const VALID_MOVEMENT_ROUTE_TARGETS = ['player', 'thisEvent', 'event'];
const VALID_ANIMATION_DIRECTIONS = new Set(['down', 'left', 'right', 'up', 'any']);
const REQUIRED_PLAYER_ANIMATION_DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const REQUIRED_PLAYER_ANIMATION_ACTIONS = ['idle', 'walk'] as const;
const ANIMATION_SHEET_KEY_SET = new Set<string>(animationSheetKeys);
const VALID_MOVEMENT_ROUTE_STEPS = new Set([
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'turnUp',
  'turnDown',
  'turnLeft',
  'turnRight',
  'wait',
]);
const REQUIRED_EQUIPMENT_SLOT_IDS = ['weapon', 'armor', 'accessory'];
const TYPE_TABLES = [
  'weaponTypes',
  'armorTypes',
  'skillTypes',
  'elements',
  'equipmentSlots',
  'itemCategories',
] as const;
const REQUIRED_TERM_GROUPS = {
  stats: [
    'maxHp',
    'maxMp',
    'attack',
    'defense',
    'magicAttack',
    'magicDefense',
    'agility',
    'luck',
  ],
  menu: ['item', 'skill', 'equip', 'status', 'formation', 'options', 'save', 'load'],
  commands: ['attack', 'guard', 'item', 'skill', 'escape'],
  battle: ['fight', 'escape', 'victory', 'defeat', 'exp', 'levelUp'],
  saveLoad: ['save', 'load', 'file', 'empty'],
} as const;

// Phase 6 v1 command set. Used both for editor-side type checks and for
// the runtime parser, which mirrors this list.
const VALID_COMMAND_TYPES = new Set([
  'showText',
  'showChoices',
  'setFlag',
  'ifFlag',
  'ifSwitch',
  'ifSelfSwitch',
  'ifVariable',
  'controlSwitch',
  'controlSelfSwitch',
  'controlVariable',
  'addItem',
  'removeItem',
  'addGold',
  'removeGold',
  'transferMap',
  'setPlayerPosition',
  'wait',
  'playSound',
  'pluginCommand',
  'comment',
  'callCommonEvent',
  'startQuest',
  'updateQuestObjective',
  'completeQuest',
  'openShop',
  'startBattle',
  'changeActorHp',
  'playAnimation',
  'setMovementRoute',
]);

const SAFE_PLUGIN_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_PLUGIN_COMMAND = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;
const SAFE_PLUGIN_ARG_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_AUDIO_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_ASSET_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;
const VALID_ASSET_KINDS = new Set<AssetKind>(['image', 'spritesheet', 'tileset', 'audio', 'generated']);
const VALID_ASSET_SOURCES = new Set<AssetSource>(['local', 'generated', 'imported']);
const CODE_LIKE_PLUGIN_TEXT =
  /(?:=>|\bfunction\b|\beval\s*\(|\bimport\s*\(|\brequire\s*\(|\bnew\s+Function\b|<script\b)/i;

export interface ValidationReport {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

interface RefIndex {
  itemIds: Set<string>;
  switchIds: Set<string>;
  variableIds: Set<string>;
  actorIds: Set<string>;
  classIds: Set<string>;
  skillIds: Set<string>;
  enemyIds: Set<string>;
  troopIds: Set<string>;
  questIds: Set<string>;
  shopIds: Set<string>;
  commonEventIds: Set<string>;
  questObjectives: Map<string, Set<string>>;
  animationClips: Map<string, Set<string>>;
  tilesetIds: Set<string>;
  audioIds: Set<string>;
  playerAnimationSet: string;
}

function buildIndex(items: ItemDatabase, db: DatabaseEntries): RefIndex {
  const questObjectives = new Map<string, Set<string>>();
  for (const q of db.quests) {
    questObjectives.set(q.id, new Set(q.objectives.map(o => o.id)));
  }
  const animationClips = new Map<string, Set<string>>();
  for (const set of db.animations.sets) {
    animationClips.set(
      set.id,
      new Set(set.clips.map(clip => `${clip.action}:${clip.direction}`)),
    );
  }
  return {
    itemIds: new Set(items.items.map(i => i.id)),
    switchIds: new Set(db.switches.map(s => s.id)),
    variableIds: new Set(db.variables.map(v => v.id)),
    actorIds: new Set(db.actors.map(a => a.id)),
    classIds: new Set(db.classes.map(c => c.id)),
    skillIds: new Set(db.skills.map(s => s.id)),
    enemyIds: new Set(db.enemies.map(e => e.id)),
    troopIds: new Set(db.troops.map(t => t.id)),
    questIds: new Set(db.quests.map(q => q.id)),
    shopIds: new Set(db.shops.map(s => s.id)),
    commonEventIds: new Set(db.commonEvents.map(c => c.id)),
    questObjectives,
    animationClips,
    tilesetIds: new Set(db.tilesets.tilesets.map(tileset => tileset.id)),
    audioIds: new Set(Object.keys(mergeAudioRegistry(db.system.audio))),
    playerAnimationSet: db.system.playerAnimationSet || 'player_adventurer',
  };
}

function createProjectVisualTileSupport(tilesetDatabase: TilesetDatabaseData) {
  const visualTileIdsByTileset = new Map<string, Set<number>>();
  for (const tileset of tilesetDatabase.tilesets) {
    visualTileIdsByTileset.set(
      tileset.id,
      new Set(
        tileset.tiles
          .filter(tile => tile.group !== 'Region' && tile.group !== 'Collision')
          .map(tile => tile.id),
      ),
    );
  }

  return (tileId: number, tilesetId: string | undefined): boolean => {
    if (tilesetId && visualTileIdsByTileset.has(tilesetId)) {
      return visualTileIdsByTileset.get(tilesetId)?.has(tileId) ?? false;
    }
    return isSupportedVisualTile(tileId, tilesetId);
  };
}

export function validateProject(state: FullProjectState): ValidationReport {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  const projectMeta = validateProjectMeta(state.project, state.maps);
  errors.push(...projectMeta.errors);
  warnings.push(...projectMeta.warnings);
  for (const message of validateDatabaseInternal(state.databases, state.assets)) {
    if (message.level === 'error') errors.push(message);
    else warnings.push(message);
  }
  errors.push(...validateItemDatabaseInternal(state.items, state.databases));
  errors.push(...validateAssetCatalog(state));

  const index = buildIndex(state.items, state.databases);
  const mapIds = Object.keys(state.maps);

  for (const [, map] of Object.entries(state.maps)) {
    const mapMessages = validateMap(map, mapIds, {
      isSupportedVisualTile: createProjectVisualTileSupport(state.databases.tilesets),
    });
    for (const m of mapMessages) {
      if (m.level === 'error') errors.push(m);
      else if (m.level === 'warning') warnings.push(m);
    }
    if (map.tilesetId && !index.tilesetIds.has(map.tilesetId)) {
      errors.push({
        level: 'error',
        message: `Map "${map.id}" references unknown tileset "${map.tilesetId}"`,
        source: `${map.id}/tilesetId`,
      });
    }
    if (map.bgm && !index.audioIds.has(map.bgm)) {
      errors.push({
        level: 'error',
        message: `Map "${map.id}" references unknown BGM audio id "${map.bgm}"`,
        source: `${map.id}/bgm`,
      });
    }
    errors.push(...validateUniqueEventIds(map));
    errors.push(...validateCommandsInMap(map, mapIds, index));
    errors.push(
      ...map.events
        .filter(e => !VALID_TRIGGERS.includes(e.trigger))
        .map(e => ({
          level: 'error' as const,
          message: `Event "${e.id}" has invalid trigger "${e.trigger}"`,
          source: `${map.id}/${e.id}`,
        })),
    );
  }

  // Cross-database referential checks
  errors.push(...validateCrossDbRefs(state.databases, index));

  // Validate common events command lists (same rules as map events)
  for (const ce of state.databases.commonEvents) {
    errors.push(...validateCommandsInCommonEvent(ce, mapIds, index));
  }

  return { errors, warnings };
}

function validateProjectMeta(project: ProjectData, maps: Record<string, MapData>): ValidationReport {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  const referencedIds = new Set<string>();
  const referencedPaths = new Set<string>();
  const parentById = new Map<string, string | null>();
  for (const ref of project.maps) {
    if (referencedIds.has(ref.id)) {
      errors.push({
        level: 'error',
        message: `Duplicate project map reference id "${ref.id}"`,
        source: 'project/maps',
      });
    }
    referencedIds.add(ref.id);
    parentById.set(ref.id, ref.parentId ?? null);

    const path = ref.path.trim();
    if (!path) {
      errors.push({
        level: 'error',
        message: `Project map "${ref.id}" has an empty path`,
        source: `project/maps/${ref.id}`,
      });
    } else {
      const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
      if (referencedPaths.has(normalizedPath)) {
        errors.push({
          level: 'error',
          message: `Duplicate project map path "${path}"`,
          source: `project/maps/${ref.id}`,
        });
      }
      referencedPaths.add(normalizedPath);
      if (path.includes('..') || /^[a-z]:/i.test(path) || path.startsWith('/') || path.startsWith('\\')) {
        errors.push({
          level: 'error',
          message: `Project map "${ref.id}" has unsafe path "${path}"`,
          source: `project/maps/${ref.id}`,
        });
      }
    }

    if (!maps[ref.id]) {
      errors.push({
        level: 'error',
        message: `Project maps references missing map data "${ref.id}"`,
        source: `project/maps/${ref.id}`,
      });
    }
    if ((ref.parentId ?? null) && !project.maps.some(candidate => candidate.id === ref.parentId)) {
      errors.push({
        level: 'error',
        message: `Project map "${ref.id}" references unknown parent map "${ref.parentId}"`,
        source: `project/maps/${ref.id}`,
      });
    }
    if (ref.order !== undefined && (!Number.isFinite(ref.order) || ref.order < 0)) {
      errors.push({
        level: 'error',
        message: `Project map "${ref.id}" has invalid order "${ref.order}"`,
        source: `project/maps/${ref.id}`,
      });
    }
  }

  for (const mapId of Object.keys(maps)) {
    if (!referencedIds.has(mapId)) {
      warnings.push({
        level: 'warning',
        message: `Loaded map "${mapId}" has no project reference`,
        source: `maps/${mapId}`,
      });
    }
  }

  for (const ref of project.maps) {
    const seen = new Set<string>();
    let cursor: string | null = ref.id;
    while (cursor) {
      if (seen.has(cursor)) {
        errors.push({
          level: 'error',
          message: `Project map "${ref.id}" has a cyclic map parent chain`,
          source: `project/maps/${ref.id}`,
        });
        break;
      }
      seen.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
  }

  if (!project.startMapId || !maps[project.startMapId]) {
    errors.push({
      level: 'error',
      message: `Project startMapId "${project.startMapId}" does not exist`,
      source: 'project',
    });
    return { errors, warnings };
  }

  const startMap = maps[project.startMapId];
  const { x, y } = project.startPosition;
  if (x < 0 || x >= startMap.width || y < 0 || y >= startMap.height) {
    errors.push({
      level: 'error',
      message: `Project startPosition (${x}, ${y}) is out of bounds for map "${project.startMapId}"`,
      source: 'project',
    });
  }

  return { errors, warnings };
}

export function validateUniqueEventIds(map: MapData): ValidationMessage[] {
  const seen = new Map<string, number>();
  for (const event of map.events) {
    seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
  }
  const out: ValidationMessage[] = [];
  for (const [id, count] of seen) {
    if (count > 1) {
      out.push({
        level: 'error',
        message: `Map "${map.id}" has ${count} events with duplicate id "${id}"`,
        source: `${map.id}/${id}`,
      });
    }
  }
  return out;
}

function isSafeProjectRelativePath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/').trim();
  if (!normalized) return false;
  if (/^[A-Za-z]:\//.test(normalized)) return false;
  if (normalized.startsWith('/') || normalized.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return false;
  return !normalized.split('/').some(part => part === '..');
}

function validateAssetCatalog(state: FullProjectState): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const catalog = state.assets;
  if (!catalog) return out;

  if (!Number.isInteger(catalog.schemaVersion) || catalog.schemaVersion <= 0) {
    out.push({
      level: 'error',
      message: 'Asset catalog schemaVersion must be a positive integer',
      source: 'assets/schemaVersion',
    });
  }

  const seen = new Set<string>();
  for (const asset of catalog.assets) {
    const id = asset.id.trim();
    const source = id ? `assets/${id}` : 'assets';
    if (!id) {
      out.push({
        level: 'error',
        message: 'Asset catalog entry is missing an id',
        source,
      });
    } else {
      if (!SAFE_ASSET_IDENTIFIER.test(id)) {
        out.push({
          level: 'error',
          message: `Asset "${id}" has invalid id`,
          source,
        });
      }
      if (seen.has(id)) {
        out.push({
          level: 'error',
          message: `Duplicate asset id "${id}"`,
          source: 'assets',
        });
      }
      seen.add(id);
    }

    if (!asset.name || asset.name.trim() === '') {
      out.push({
        level: 'error',
        message: `Asset "${id}" name is required`,
        source,
      });
    }
    if (!VALID_ASSET_KINDS.has(asset.kind)) {
      out.push({
        level: 'error',
        message: `Asset "${id}" has invalid kind "${asset.kind}"`,
        source,
      });
    }
    if (!VALID_ASSET_SOURCES.has(asset.source)) {
      out.push({
        level: 'error',
        message: `Asset "${id}" has invalid source "${asset.source}"`,
        source,
      });
    }
    if (!asset.path || asset.path.trim() === '') {
      out.push({
        level: 'error',
        message: `Asset "${id}" path is required`,
        source,
      });
    } else if (!isSafeProjectRelativePath(asset.path)) {
      out.push({
        level: 'error',
        message: `Asset "${id}" uses unsafe project-relative path "${asset.path}"`,
        source,
      });
    }

    for (const key of ['width', 'height', 'frameWidth', 'frameHeight', 'frames', 'durationMs'] as const) {
      const value = asset[key];
      if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
        out.push({
          level: 'error',
          message: `Asset "${id}" ${key} must be a positive finite number`,
          source,
        });
      }
    }

    const rawAsset = asset as unknown as Record<string, unknown>;
    if (rawAsset.tags !== undefined) {
      if (!Array.isArray(rawAsset.tags)) {
        out.push({
          level: 'error',
          message: `Asset "${id}" tags must be an array`,
          source,
        });
      } else {
        const seenTags = new Set<string>();
        rawAsset.tags.forEach((tag, index) => {
          if (typeof tag !== 'string') {
            out.push({
              level: 'error',
              message: `Asset "${id}" tag ${index + 1} must be text`,
              source,
            });
            return;
          }
          const normalized = tag.trim();
          if (!normalized) {
            out.push({
              level: 'error',
              message: `Asset "${id}" has blank tag`,
              source,
            });
            return;
          }
          const tagKey = normalized.toLowerCase();
          if (seenTags.has(tagKey)) {
            out.push({
              level: 'error',
              message: `Asset "${id}" has duplicate tag "${normalized}"`,
              source,
            });
            return;
          }
          seenTags.add(tagKey);
        });
      }
    }

    for (const key of ['provenance', 'runtimeNotes', 'notes'] as const) {
      if (rawAsset[key] !== undefined && typeof rawAsset[key] !== 'string') {
        out.push({
          level: 'error',
          message: `Asset "${id}" ${key} must be text`,
          source,
        });
      }
    }

    for (const key of ['runtimeCompatible', 'protected'] as const) {
      if (rawAsset[key] !== undefined && typeof rawAsset[key] !== 'boolean') {
        out.push({
          level: 'error',
          message: `Asset "${id}" ${key} must be boolean`,
          source,
        });
      }
    }
  }

  return out;
}

function validateAudioRegistry(db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const registry = db.system.audio ?? {};
  const knownAudioIds = new Set(Object.keys(DEFAULT_AUDIO_REGISTRY));

  for (const [id, path] of Object.entries(registry)) {
    if (!SAFE_AUDIO_IDENTIFIER.test(id)) {
      out.push({
        level: 'error',
        message: `Audio asset "${id}" has invalid id`,
        source: `database/system/audio/${id}`,
      });
    }
    knownAudioIds.add(id);

    if (typeof path !== 'string' || path.trim() === '') {
      out.push({
        level: 'error',
        message: `Audio asset "${id}" path is required`,
        source: `database/system/audio/${id}`,
      });
      continue;
    }
    if (!isSafeProjectRelativePath(path)) {
      out.push({
        level: 'error',
        message: `Audio asset "${id}" uses unsafe project-relative path "${path}"`,
        source: `database/system/audio/${id}`,
      });
    }
    if (!path.toLowerCase().endsWith('.wav')) {
      out.push({
        level: 'error',
        message: `Audio asset "${id}" must use a .wav file`,
        source: `database/system/audio/${id}`,
      });
    }
  }

  if (db.system.defaultBgm && !knownAudioIds.has(db.system.defaultBgm)) {
    out.push({
      level: 'error',
      message: `System defaultBgm references unknown audio id "${db.system.defaultBgm}"`,
      source: 'database/system/defaultBgm',
    });
  }

  return out;
}

function validateItemDatabaseInternal(items: ItemDatabase, db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const seen = new Set<string>();
  const itemCategoryIds = new Set(db.types.itemCategories.map(entry => entry.id));
  const equipmentSlotIds = new Set(db.types.equipmentSlots.map(entry => entry.id));
  for (const item of items.items) {
    if (seen.has(item.id)) {
      out.push({
        level: 'error',
        message: `Duplicate item id "${item.id}"`,
        source: 'database/items',
      });
    }
    seen.add(item.id);
    if (
      itemCategoryIds.size > 0 &&
      !itemCategoryIds.has(item.type) &&
      !VALID_LEGACY_ITEM_TYPES.has(item.type)
    ) {
      out.push({
        level: 'error',
        message: `Item "${item.id}" references unknown item category "${item.type}"`,
        source: `database/items/${item.id}`,
      });
    }
    if (item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0)) {
      out.push({
        level: 'error',
        message: `Item "${item.id}" price must be non-negative`,
        source: `database/items/${item.id}`,
      });
    }
    if (item.slot && equipmentSlotIds.size > 0 && !equipmentSlotIds.has(item.slot)) {
      out.push({
        level: 'error',
        message: `Item "${item.id}" references unknown equipment slot "${item.slot}"`,
        source: `database/items/${item.id}`,
      });
    }
    if (item.effect) {
      for (const [key, value] of Object.entries(item.effect)) {
        if (value !== undefined && !Number.isFinite(value)) {
          out.push({
            level: 'error',
            message: `Item "${item.id}" effect.${key} must be finite`,
            source: `database/items/${item.id}`,
          });
        }
      }
    }
    out.push(...validateStatParams(`Item "${item.id}"`, `database/items/${item.id}`, item.modifiers));
  }
  return out;
}

function validateStatParams(
  label: string,
  source: string,
  params: Partial<Stats> | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  if (!params) return out;
  for (const key of STAT_KEYS) {
    const value = params[key];
    if (value !== undefined && !Number.isFinite(value)) {
      out.push({
        level: 'error',
        message: `${label} ${key} modifier must be finite`,
        source,
      });
    }
  }
  return out;
}

function validateTraitList(
  label: string,
  source: string,
  traits: string[] | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  if (!traits) return out;
  const seen = new Set<string>();
  traits.forEach((trait, index) => {
    const normalized = trait.trim();
    if (!normalized) {
      out.push({
        level: 'error',
        message: `${label} trait ${index + 1} is blank`,
        source,
      });
      return;
    }
    if (seen.has(normalized)) {
      out.push({
        level: 'error',
        message: `${label} has duplicate trait "${normalized}"`,
        source,
      });
      return;
    }
    seen.add(normalized);
  });
  return out;
}

function validateDatabaseInternal(db: DatabaseEntries, assets?: AssetCatalogData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  out.push(...validateAudioRegistry(db));
  const tables: Array<[string, Array<{ id: string }>]> = [
    ['actors', db.actors],
    ['classes', db.classes],
    ['skills', db.skills],
    ['weapons', db.weapons],
    ['armors', db.armors],
    ['states', db.states],
    ['enemies', db.enemies],
    ['troops', db.troops],
    ['quests', db.quests],
    ['shops', db.shops],
    ['switches', db.switches],
    ['variables', db.variables],
    ['commonEvents', db.commonEvents],
  ];
  for (const [name, list] of tables) {
    const seen = new Set<string>();
    for (const entry of list) {
      if (!entry.id || entry.id.trim() === '') {
        out.push({
          level: 'error',
          message: `${name} entry is missing an id`,
          source: `database/${name}`,
        });
        continue;
      }
      if (seen.has(entry.id)) {
        out.push({
          level: 'error',
          message: `Duplicate ${name.slice(0, -1)} id "${entry.id}"`,
          source: `database/${name}`,
        });
      }
      seen.add(entry.id);
    }
  }

  out.push(...validateTilesetDatabase(db, assets));
  out.push(...validateEquipmentAndStateDatabases(db));
  out.push(...validatePartyCombatDatabases(db));
  out.push(...validateSetupProgressionDatabases(db));
  out.push(...validateAnimationDatabase(db, assets));

  for (const tableName of TYPE_TABLES) {
    const seen = new Set<string>();
    for (const entry of db.types[tableName]) {
      if (!entry.id || entry.id.trim() === '') {
        out.push({
          level: 'error',
          message: `${tableName} entry is missing an id`,
          source: `database/types/${tableName}`,
        });
        continue;
      }
      if (!entry.name || entry.name.trim() === '') {
        out.push({
          level: 'error',
          message: `${tableName} entry "${entry.id}" is missing a name`,
          source: `database/types/${tableName}/${entry.id}`,
        });
      }
      if (seen.has(entry.id)) {
        out.push({
          level: 'error',
          message: `Duplicate ${tableName} id "${entry.id}"`,
          source: `database/types/${tableName}`,
        });
      }
      seen.add(entry.id);
    }
  }

  const equipmentSlotIds = new Set(db.types.equipmentSlots.map(slot => slot.id));
  for (const slotId of REQUIRED_EQUIPMENT_SLOT_IDS) {
    if (!equipmentSlotIds.has(slotId)) {
      out.push({
        level: 'error',
        message: `Types database missing required equipment slot "${slotId}"`,
        source: 'database/types/equipmentSlots',
      });
    }
  }

  if (!db.terms.currencyUnit || db.terms.currencyUnit.trim() === '') {
    out.push({
      level: 'error',
      message: 'Terms currencyUnit is required',
      source: 'database/terms/currencyUnit',
    });
  }
  for (const [groupName, labels] of Object.entries(REQUIRED_TERM_GROUPS)) {
    const group = db.terms[groupName as keyof typeof REQUIRED_TERM_GROUPS] as Record<string, string>;
    for (const label of labels) {
      if (!group?.[label] || group[label].trim() === '') {
        out.push({
          level: 'error',
          message: `Terms ${groupName}.${label} is required`,
          source: `database/terms/${groupName}`,
        });
      }
    }
  }

  const switchIds = new Set(db.switches.map(s => s.id));
  for (const commonEvent of db.commonEvents) {
    if (!VALID_COMMON_EVENT_TRIGGERS.includes(commonEvent.trigger)) {
      out.push({
        level: 'error',
        message: `Common event "${commonEvent.id}" has invalid trigger "${commonEvent.trigger}"`,
        source: `database/commonEvents/${commonEvent.id}`,
      });
    }
    if (
      (commonEvent.trigger === 'autorun' || commonEvent.trigger === 'parallel') &&
      !commonEvent.switchId
    ) {
      out.push({
        level: 'error',
        message: `Common event "${commonEvent.id}" requires a condition switch for ${commonEvent.trigger}`,
        source: `database/commonEvents/${commonEvent.id}`,
      });
    }
    if (commonEvent.switchId && !switchIds.has(commonEvent.switchId)) {
      out.push({
        level: 'error',
        message: `Common event "${commonEvent.id}" references unknown switch "${commonEvent.switchId}"`,
        source: `database/commonEvents/${commonEvent.id}`,
      });
    }
  }

  if (
    db.system.playerMovementSpeed !== undefined &&
    !VALID_MOVEMENT_SPEEDS.has(db.system.playerMovementSpeed)
  ) {
    out.push({
      level: 'error',
      message: `System playerMovementSpeed "${db.system.playerMovementSpeed}" is invalid`,
      source: 'database/system',
    });
  }
  if (
    db.system.defaultCharacterHeightTiles !== undefined &&
    (!Number.isFinite(db.system.defaultCharacterHeightTiles) || db.system.defaultCharacterHeightTiles <= 0)
  ) {
    out.push({
      level: 'error',
      message: `System defaultCharacterHeightTiles must be a positive finite number`,
      source: 'database/system',
    });
  }

  for (const set of db.animations.sets) {
    if (!set.display) continue;
    if (!Number.isFinite(set.display.heightTiles) || set.display.heightTiles <= 0) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.heightTiles must be a positive finite number`,
        source: `database/animations/${set.id}`,
      });
    }
    if (
      set.display.widthTiles !== undefined &&
      (!Number.isFinite(set.display.widthTiles) || set.display.widthTiles <= 0)
    ) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.widthTiles must be a positive finite number`,
        source: `database/animations/${set.id}`,
      });
    }
    if (
      set.display.yOffsetPx !== undefined &&
      !Number.isFinite(set.display.yOffsetPx)
    ) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.yOffsetPx must be finite`,
        source: `database/animations/${set.id}`,
      });
    }
  }
  return out;
}

function validateAnimationDatabase(db: DatabaseEntries, assets?: AssetCatalogData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const seenSetIds = new Set<string>();
  const validAnimationAssets = new Set<string>(ANIMATION_SHEET_KEY_SET);
  const catalogSpritesheets = new Map<string, NonNullable<AssetCatalogData['assets'][number]>>();
  for (const asset of assets?.assets ?? []) {
    if (asset.kind === 'spritesheet') {
      validAnimationAssets.add(asset.id);
      catalogSpritesheets.set(asset.id, asset);
    }
  }

  for (const set of db.animations.sets) {
    const source = `database/animations/${set.id}`;
    if (!set.id || set.id.trim() === '') {
      out.push({
        level: 'error',
        message: 'Animation set is missing an id',
        source: 'database/animations',
      });
      continue;
    }
    if (seenSetIds.has(set.id)) {
      out.push({
        level: 'error',
        message: `Duplicate animation set id "${set.id}"`,
        source: 'database/animations',
      });
    }
    seenSetIds.add(set.id);

    set.clips.forEach((clip, index) => {
      const clipNo = index + 1;
      const label = `Animation set "${set.id}" clip ${clipNo}`;
      if (!clip.action || clip.action.trim() === '') {
        out.push({ level: 'error', message: `${label} action is required`, source });
      }
      if (!VALID_ANIMATION_DIRECTIONS.has(clip.direction)) {
        out.push({ level: 'error', message: `${label} has invalid direction "${clip.direction}"`, source });
      }
      if (!validAnimationAssets.has(clip.asset)) {
        out.push({
          level: 'error',
          message: `${label} references unknown animation asset "${clip.asset}"`,
          source,
        });
      }
      const catalogAsset = catalogSpritesheets.get(clip.asset);
      if (!Number.isFinite(clip.frameSize.width) || clip.frameSize.width <= 0) {
        out.push({ level: 'error', message: `${label} frameSize.width must be a positive finite number`, source });
      } else if (catalogAsset?.frameWidth !== undefined && clip.frameSize.width !== catalogAsset.frameWidth) {
        out.push({
          level: 'error',
          message: `${label} frameSize.width must match spritesheet asset "${clip.asset}" frameWidth ${catalogAsset.frameWidth}`,
          source,
        });
      }
      if (!Number.isFinite(clip.frameSize.height) || clip.frameSize.height <= 0) {
        out.push({ level: 'error', message: `${label} frameSize.height must be a positive finite number`, source });
      } else if (catalogAsset?.frameHeight !== undefined && clip.frameSize.height !== catalogAsset.frameHeight) {
        out.push({
          level: 'error',
          message: `${label} frameSize.height must match spritesheet asset "${clip.asset}" frameHeight ${catalogAsset.frameHeight}`,
          source,
        });
      }
      if (!Number.isInteger(clip.frameCount) || clip.frameCount <= 0) {
        out.push({ level: 'error', message: `${label} frameCount must be a positive integer`, source });
      } else if (catalogAsset?.frames !== undefined && clip.frameCount > catalogAsset.frames) {
        out.push({
          level: 'error',
          message: `${label} frameCount must not exceed spritesheet asset "${clip.asset}" frame count ${catalogAsset.frames}`,
          source,
        });
      }
      if (!Number.isFinite(clip.fps) || clip.fps <= 0) {
        out.push({ level: 'error', message: `${label} fps must be a positive finite number`, source });
      }
      if (!Number.isFinite(clip.anchor.x)) {
        out.push({ level: 'error', message: `${label} anchor.x must be finite`, source });
      }
      if (!Number.isFinite(clip.anchor.y)) {
        out.push({ level: 'error', message: `${label} anchor.y must be finite`, source });
      }
    });
  }

  const playerSetId = db.system.playerAnimationSet || 'player_adventurer';
  const playerSet = db.animations.sets.find(set => set.id === playerSetId);
  if (playerSet) {
    for (const action of REQUIRED_PLAYER_ANIMATION_ACTIONS) {
      for (const direction of REQUIRED_PLAYER_ANIMATION_DIRECTIONS) {
        const hasClip = playerSet.clips.some(clip =>
          clip.action === action && (clip.direction === direction || clip.direction === 'any'),
        );
        if (!hasClip) {
          out.push({
            level: 'warning',
            message: `Player animation set "${playerSetId}" is missing ${action}/${direction}`,
            source: `database/animations/${playerSetId}`,
          });
        }
      }
    }
  }

  return out;
}

function validateSetupProgressionDatabases(db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const animationSetIds = new Set(db.animations.sets.map(set => set.id));

  for (const quest of db.quests) {
    const source = `database/quests/${quest.id}`;
    const objectiveIds = new Set<string>();
    for (const objective of quest.objectives) {
      if (!objective.id || objective.id.trim() === '') {
        out.push({
          level: 'error',
          message: `Quest "${quest.id}" objective is missing an id`,
          source,
        });
      } else if (objectiveIds.has(objective.id)) {
        out.push({
          level: 'error',
          message: `Quest "${quest.id}" has duplicate objective id "${objective.id}"`,
          source,
        });
      }
      objectiveIds.add(objective.id);
    }
    if (!Number.isFinite(quest.rewards.gold) || quest.rewards.gold < 0) {
      out.push({
        level: 'error',
        message: `Quest "${quest.id}" reward gold must be non-negative`,
        source,
      });
    }
    if (!Number.isFinite(quest.rewards.exp) || quest.rewards.exp < 0) {
      out.push({
        level: 'error',
        message: `Quest "${quest.id}" reward exp must be non-negative`,
        source,
      });
    }
    for (const reward of quest.rewards.items) {
      if (!Number.isFinite(reward.amount) || reward.amount < 1) {
        out.push({
          level: 'error',
          message: `Quest "${quest.id}" rewards item amount must be at least 1`,
          source,
        });
      }
    }
  }

  for (const shop of db.shops) {
    const source = `database/shops/${shop.id}`;
    const seenListings = new Set<string>();
    if (shop.listings.length === 0) {
      out.push({
        level: 'error',
        message: `Shop "${shop.id}" must contain at least one listing`,
        source,
      });
    }
    for (const listing of shop.listings) {
      if (!Number.isFinite(listing.price) || listing.price < 0) {
        out.push({
          level: 'error',
          message: `Shop "${shop.id}" listing price must be non-negative`,
          source,
        });
      }
      if (seenListings.has(listing.itemId)) {
        out.push({
          level: 'error',
          message: `Shop "${shop.id}" lists duplicate item "${listing.itemId}"`,
          source,
        });
      }
      seenListings.add(listing.itemId);
    }
  }

  for (const variable of db.variables) {
    if (!Number.isFinite(variable.initial)) {
      out.push({
        level: 'error',
        message: `Variable "${variable.id}" initial value must be finite`,
        source: `database/variables/${variable.id}`,
      });
    }
  }

  if (!Number.isFinite(db.system.startingGold) || db.system.startingGold < 0) {
    out.push({
      level: 'error',
      message: 'System startingGold must be non-negative',
      source: 'database/system',
    });
  }
  if (db.actors.length > 0 && db.system.startingParty.length === 0) {
    out.push({
      level: 'warning',
      message: 'System startingParty is empty while actors exist',
      source: 'database/system',
    });
  }
  const startingPartySeen = new Set<string>();
  for (const actorId of db.system.startingParty) {
    if (startingPartySeen.has(actorId)) {
      out.push({
        level: 'error',
        message: `System startingParty contains duplicate actor "${actorId}"`,
        source: 'database/system',
      });
    }
    startingPartySeen.add(actorId);
  }
  if (animationSetIds.size > 0 && !db.system.playerAnimationSet) {
    out.push({
      level: 'warning',
      message: 'System playerAnimationSet is not set while animation sets exist',
      source: 'database/system',
    });
  }
  if (
    db.system.playerAnimationSet &&
    animationSetIds.size > 0 &&
    !animationSetIds.has(db.system.playerAnimationSet)
  ) {
    out.push({
      level: 'error',
      message: `System playerAnimationSet references unknown animation set "${db.system.playerAnimationSet}"`,
      source: 'database/system',
    });
  }

  return out;
}

function validateNonNegativeStats(
  label: string,
  source: string,
  fieldName: string,
  stats: Stats,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const key of STAT_KEYS) {
    const value = stats[key];
    if (!Number.isFinite(value) || value < 0) {
      out.push({
        level: 'error',
        message: `${label} ${fieldName}.${key} must be a non-negative finite number`,
        source,
      });
    }
  }
  return out;
}

function validatePartyCombatDatabases(db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const classIds = new Set(db.classes.map(entry => entry.id));
  const skillIds = new Set(db.skills.map(entry => entry.id));
  const enemyIds = new Set(db.enemies.map(entry => entry.id));
  const equipmentSlotIds = new Set(db.types.equipmentSlots.map(entry => entry.id));
  const elementIds = new Set(db.types.elements.map(entry => entry.id));

  for (const actor of db.actors) {
    const source = `database/actors/${actor.id}`;
    if (!Number.isFinite(actor.level) || actor.level < 1) {
      out.push({
        level: 'error',
        message: `Actor "${actor.id}" level must be at least 1`,
        source,
      });
    }
    if (!Number.isFinite(actor.hp) || actor.hp < 0) {
      out.push({
        level: 'error',
        message: `Actor "${actor.id}" hp must be a non-negative finite number`,
        source,
      });
    }
    if (!Number.isFinite(actor.mp) || actor.mp < 0) {
      out.push({
        level: 'error',
        message: `Actor "${actor.id}" mp must be a non-negative finite number`,
        source,
      });
    }
    out.push(...validateNonNegativeStats(`Actor "${actor.id}"`, source, 'baseStats', actor.baseStats));
  }

  for (const cls of db.classes) {
    const source = `database/classes/${cls.id}`;
    out.push(...validateNonNegativeStats(`Class "${cls.id}"`, source, 'growth', cls.growth));
    for (const slot of cls.usableEquipment) {
      if (equipmentSlotIds.size > 0 && !equipmentSlotIds.has(slot)) {
        out.push({
          level: 'error',
          message: `Class "${cls.id}" references unknown equipment slot "${slot}"`,
          source,
        });
      }
    }
    for (const learned of cls.learnedSkills) {
      if (!Number.isFinite(learned.level) || learned.level < 1) {
        out.push({
          level: 'error',
          message: `Class "${cls.id}" learned skill level must be at least 1`,
          source,
        });
      }
      if (skillIds.size > 0 && !skillIds.has(learned.skillId)) {
        out.push({
          level: 'error',
          message: `Class "${cls.id}" references unknown learned skill "${learned.skillId}"`,
          source,
        });
      }
    }
  }

  for (const skill of db.skills) {
    const source = `database/skills/${skill.id}`;
    if (!Number.isFinite(skill.mpCost) || skill.mpCost < 0) {
      out.push({
        level: 'error',
        message: `Skill "${skill.id}" mpCost must be a non-negative finite number`,
        source,
      });
    }
    if (!Number.isFinite(skill.power)) {
      out.push({
        level: 'error',
        message: `Skill "${skill.id}" power must be finite`,
        source,
      });
    }
    if (!VALID_SKILL_TARGETS.has(skill.target)) {
      out.push({
        level: 'error',
        message: `Skill "${skill.id}" has invalid target "${skill.target}"`,
        source,
      });
    }
    if (skill.element && elementIds.size > 0 && !elementIds.has(skill.element)) {
      out.push({
        level: 'error',
        message: `Skill "${skill.id}" references unknown element "${skill.element}"`,
        source,
      });
    }
  }

  for (const enemy of db.enemies) {
    const source = `database/enemies/${enemy.id}`;
    out.push(...validateNonNegativeStats(`Enemy "${enemy.id}"`, source, 'stats', enemy.stats));
    if (!Number.isFinite(enemy.exp) || enemy.exp < 0) {
      out.push({
        level: 'error',
        message: `Enemy "${enemy.id}" exp must be a non-negative finite number`,
        source,
      });
    }
    if (!Number.isFinite(enemy.gold) || enemy.gold < 0) {
      out.push({
        level: 'error',
        message: `Enemy "${enemy.id}" gold must be a non-negative finite number`,
        source,
      });
    }
    for (const drop of enemy.drops) {
      if (!Number.isFinite(drop.rate) || drop.rate < 0 || drop.rate > 1) {
        out.push({
          level: 'error',
          message: `Enemy "${enemy.id}" drop rate must be between 0 and 1`,
          source,
        });
      }
    }
  }

  for (const troop of db.troops) {
    if (troop.members.length === 0) {
      out.push({
        level: 'error',
        message: `Troop "${troop.id}" must contain at least one enemy`,
        source: `database/troops/${troop.id}`,
      });
    }
    for (const memberId of troop.members) {
      if (enemyIds.size > 0 && !enemyIds.has(memberId)) {
        out.push({
          level: 'error',
          message: `Troop "${troop.id}" references unknown enemy "${memberId}"`,
          source: `database/troops/${troop.id}`,
        });
      }
    }
  }

  if (classIds.size === 0 && db.actors.length > 0) {
    out.push({
      level: 'error',
      message: 'Actor database requires at least one class when actors exist',
      source: 'database/classes',
    });
  }

  return out;
}

function validateEquipmentAndStateDatabases(db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const weaponTypeIds = new Set(db.types.weaponTypes.map(entry => entry.id));
  const armorTypeIds = new Set(db.types.armorTypes.map(entry => entry.id));
  const equipmentSlotIds = new Set(db.types.equipmentSlots.map(entry => entry.id));
  const animationIds = new Set(db.animations.sets.map(set => set.id));

  for (const weapon of db.weapons) {
    const source = `database/weapons/${weapon.id}`;
    if (weaponTypeIds.size > 0 && !weaponTypeIds.has(weapon.weaponTypeId)) {
      out.push({
        level: 'error',
        message: `Weapon "${weapon.id}" references unknown weapon type "${weapon.weaponTypeId}"`,
        source,
      });
    }
    if (weapon.price !== undefined && (!Number.isFinite(weapon.price) || weapon.price < 0)) {
      out.push({
        level: 'error',
        message: `Weapon "${weapon.id}" price must be non-negative`,
        source,
      });
    }
    if (weapon.animationId && !animationIds.has(weapon.animationId)) {
      out.push({
        level: 'error',
        message: `Weapon "${weapon.id}" references unknown animation "${weapon.animationId}"`,
        source,
      });
    }
    out.push(...validateStatParams(`Weapon "${weapon.id}"`, source, weapon.params));
    out.push(...validateTraitList(`Weapon "${weapon.id}"`, source, weapon.traits));
  }

  for (const armor of db.armors) {
    const source = `database/armors/${armor.id}`;
    if (armorTypeIds.size > 0 && !armorTypeIds.has(armor.armorTypeId)) {
      out.push({
        level: 'error',
        message: `Armor "${armor.id}" references unknown armor type "${armor.armorTypeId}"`,
        source,
      });
    }
    if (equipmentSlotIds.size > 0 && !equipmentSlotIds.has(armor.slot)) {
      out.push({
        level: 'error',
        message: `Armor "${armor.id}" references unknown equipment slot "${armor.slot}"`,
        source,
      });
    }
    if (armor.price !== undefined && (!Number.isFinite(armor.price) || armor.price < 0)) {
      out.push({
        level: 'error',
        message: `Armor "${armor.id}" price must be non-negative`,
        source,
      });
    }
    out.push(...validateStatParams(`Armor "${armor.id}"`, source, armor.params));
    out.push(...validateTraitList(`Armor "${armor.id}"`, source, armor.traits));
  }

  for (const state of db.states) {
    const source = `database/states/${state.id}`;
    if (!Number.isFinite(state.priority) || state.priority < 0 || state.priority > 100) {
      out.push({
        level: 'error',
        message: `State "${state.id}" priority must be between 0 and 100`,
        source,
      });
    }
    if (state.restriction && !VALID_STATE_RESTRICTIONS.has(state.restriction)) {
      out.push({
        level: 'error',
        message: `State "${state.id}" has invalid restriction "${state.restriction}"`,
        source,
      });
    }
    out.push(...validateTraitList(`State "${state.id}"`, source, state.traits));
  }

  return out;
}

function validateTilesetDatabase(db: DatabaseEntries, assets?: AssetCatalogData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const seenTilesets = new Set<string>();
  const importedTilesetAssetIds = new Set(
    (assets?.assets ?? [])
      .filter(asset => asset.kind === 'tileset')
      .map(asset => asset.id),
  );

  for (const tileset of db.tilesets.tilesets) {
    if (!tileset.id || tileset.id.trim() === '') {
      out.push({
        level: 'error',
        message: 'Tileset entry is missing an id',
        source: 'database/tilesets',
      });
      continue;
    }
    if (seenTilesets.has(tileset.id)) {
      out.push({
        level: 'error',
        message: `Duplicate tileset id "${tileset.id}"`,
        source: 'database/tilesets',
      });
    }
    seenTilesets.add(tileset.id);

    if (!tileset.name || tileset.name.trim() === '') {
      out.push({
        level: 'error',
        message: `Tileset "${tileset.id}" is missing a name`,
        source: `database/tilesets/${tileset.id}`,
      });
    }
    if (!Number.isFinite(tileset.tileSize) || tileset.tileSize <= 0) {
      out.push({
        level: 'error',
        message: `Tileset "${tileset.id}" tileSize must be a positive finite number`,
        source: `database/tilesets/${tileset.id}`,
      });
    }

    const seenTiles = new Set<number>();
    for (const tile of tileset.tiles) {
      const source = `database/tilesets/${tileset.id}/tiles/${tile.id}`;
      if (!Number.isInteger(tile.id) || tile.id < 0) {
        out.push({
          level: 'error',
          message: `Tileset "${tileset.id}" has invalid tile id "${tile.id}"`,
          source,
        });
        continue;
      }
      if (seenTiles.has(tile.id)) {
        out.push({
          level: 'error',
          message: `Duplicate tile id "${tile.id}" in tileset "${tileset.id}"`,
          source: `database/tilesets/${tileset.id}`,
        });
      }
      seenTiles.add(tile.id);

      if (!tile.name || tile.name.trim() === '') {
        out.push({
          level: 'error',
          message: `Tile "${tile.id}" in tileset "${tileset.id}" is missing a name`,
          source,
        });
      }
      if (!TILE_ASSET_KEYS.has(tile.asset) && !importedTilesetAssetIds.has(tile.asset)) {
        out.push({
          level: 'error',
          message: `Tile "${tile.id}" in tileset "${tileset.id}" references unknown tile asset "${tile.asset}"`,
          source,
        });
      }
      if (!VALID_TILE_GROUPS.has(tile.group)) {
        out.push({
          level: 'error',
          message: `Tile "${tile.id}" in tileset "${tileset.id}" has invalid group "${tile.group}"`,
          source,
        });
      }
      if (!VALID_TILE_PASSABILITY.has(tile.passability)) {
        out.push({
          level: 'error',
          message: `Tile "${tile.id}" in tileset "${tileset.id}" has invalid passability "${tile.passability}"`,
          source,
        });
      }
      if (tile.priority !== undefined && !Number.isFinite(tile.priority)) {
        out.push({
          level: 'error',
          message: `Tile "${tile.id}" in tileset "${tileset.id}" priority must be finite`,
          source,
        });
      }
    }
  }

  return out;
}

function validateCrossDbRefs(db: DatabaseEntries, index: RefIndex): ValidationMessage[] {
  const out: ValidationMessage[] = [];

  for (const actor of db.actors) {
    if (actor.classId && !index.classIds.has(actor.classId)) {
      out.push({
        level: 'error',
        message: `Actor "${actor.id}" references unknown class "${actor.classId}"`,
        source: `database/actors/${actor.id}`,
      });
    }
    for (const skillId of actor.skills) {
      if (!index.skillIds.has(skillId)) {
        out.push({
          level: 'error',
          message: `Actor "${actor.id}" references unknown skill "${skillId}"`,
          source: `database/actors/${actor.id}`,
        });
      }
    }
    for (const slot of Object.keys(actor.equipment)) {
      const itemId = actor.equipment[slot as keyof typeof actor.equipment];
      if (itemId && !index.itemIds.has(itemId)) {
        out.push({
          level: 'error',
          message: `Actor "${actor.id}" equips unknown item "${itemId}" in slot "${slot}"`,
          source: `database/actors/${actor.id}`,
        });
      }
    }
  }

  for (const cls of db.classes) {
    for (const learn of cls.learnedSkills) {
      if (!index.skillIds.has(learn.skillId)) {
        out.push({
          level: 'error',
          message: `Class "${cls.id}" references unknown skill "${learn.skillId}"`,
          source: `database/classes/${cls.id}`,
        });
      }
    }
  }

  for (const enemy of db.enemies) {
    for (const drop of enemy.drops) {
      if (!index.itemIds.has(drop.itemId)) {
        out.push({
          level: 'error',
          message: `Enemy "${enemy.id}" drops unknown item "${drop.itemId}"`,
          source: `database/enemies/${enemy.id}`,
        });
      }
    }
  }

  for (const troop of db.troops) {
    for (const memberId of troop.members) {
      if (!index.enemyIds.has(memberId)) {
        out.push({
          level: 'error',
          message: `Troop "${troop.id}" references unknown enemy "${memberId}"`,
          source: `database/troops/${troop.id}`,
        });
      }
    }
  }

  for (const quest of db.quests) {
    for (const reward of quest.rewards.items) {
      if (!index.itemIds.has(reward.itemId)) {
        out.push({
          level: 'error',
          message: `Quest "${quest.id}" rewards unknown item "${reward.itemId}"`,
          source: `database/quests/${quest.id}`,
        });
      }
    }
  }

  for (const shop of db.shops) {
    for (const listing of shop.listings) {
      if (!index.itemIds.has(listing.itemId)) {
        out.push({
          level: 'error',
          message: `Shop "${shop.id}" lists unknown item "${listing.itemId}"`,
          source: `database/shops/${shop.id}`,
        });
      }
    }
  }

  // System.startingParty -> actorIds
  for (const id of db.system.startingParty) {
    if (!index.actorIds.has(id)) {
      out.push({
        level: 'error',
        message: `System startingParty references unknown actor "${id}"`,
        source: 'database/system',
      });
    }
  }

  return out;
}

function validateCommandsInMap(map: MapData, mapIds: string[], index: RefIndex): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    out.push(...validateCommandList(event.commands, mapIds, index, `${map.id}/${event.id}`, event.id, map.events, event));
    for (const page of event.pages ?? []) {
      out.push(...validateCommandList(page.commands, mapIds, index, `${map.id}/${event.id}/${page.id}`, event.id, map.events, event));
    }
  }
  return out;
}

function validateCommandsInCommonEvent(
  ce: CommonEventData,
  mapIds: string[],
  index: RefIndex,
): ValidationMessage[] {
  return validateCommandList(ce.commands, mapIds, index, `commonEvent/${ce.id}`, ce.id, [], undefined);
}

function validateCommandList(
  commands: EventCommand[],
  mapIds: string[],
  index: RefIndex,
  source: string,
  ownerLabel: string,
  mapEvents: GameEvent[],
  ownerEvent: GameEvent | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const cmd of commands) {
    if (!VALID_COMMAND_TYPES.has(cmd.type)) {
      out.push({
        level: 'error',
        message: `Event "${ownerLabel}" has unknown command type "${cmd.type}"`,
        source,
      });
      continue;
    }
    out.push(...validateSingleCommand(cmd, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));

    // Walk nested branches.
    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifSelfSwitch' || cmd.type === 'ifVariable') {
      out.push(...validateCommandList(cmd.then, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      out.push(...validateCommandList(cmd.else, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) {
        out.push(...validateCommandList(choice.commands, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) {
        out.push(...validateCommandList(cmd.victoryBranch, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
      if (cmd.defeatBranch) {
        out.push(...validateCommandList(cmd.defeatBranch, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
    }
  }
  return out;
}

function validateSingleCommand(
  cmd: EventCommand,
  mapIds: string[],
  index: RefIndex,
  source: string,
  ownerLabel: string,
  mapEvents: GameEvent[],
  ownerEvent: GameEvent | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const err = (msg: string) => {
    out.push({ level: 'error', message: `Event "${ownerLabel}" ${msg}`, source });
  };

  switch (cmd.type) {
    case 'addItem':
    case 'removeItem':
      if (!index.itemIds.has(cmd.itemId)) err(`${cmd.type} references unknown item "${cmd.itemId}"`);
      break;
    case 'transferMap':
    case 'setPlayerPosition':
      if (!mapIds.includes(cmd.mapId)) err(`${cmd.type} targets unknown map "${cmd.mapId}"`);
      break;
    case 'controlSwitch':
    case 'ifSwitch':
      if (!index.switchIds.has(cmd.switchId)) err(`${cmd.type} references unknown switch "${cmd.switchId}"`);
      break;
    case 'controlSelfSwitch':
    case 'ifSelfSwitch':
      if (!['A', 'B', 'C', 'D'].includes(cmd.switchId)) err(`${cmd.type} references invalid self switch "${cmd.switchId}"`);
      break;
    case 'controlVariable':
      if (!index.variableIds.has(cmd.variableId))
        err(`controlVariable references unknown variable "${cmd.variableId}"`);
      if (cmd.sourceVariableId && !index.variableIds.has(cmd.sourceVariableId))
        err(`controlVariable source references unknown variable "${cmd.sourceVariableId}"`);
      if (cmd.op === 'div' && !cmd.sourceVariableId && cmd.value === 0)
        err(`controlVariable divides by zero (literal 0)`);
      break;
    case 'ifVariable':
      if (!index.variableIds.has(cmd.variableId))
        err(`ifVariable references unknown variable "${cmd.variableId}"`);
      break;
    case 'callCommonEvent':
      if (!index.commonEventIds.has(cmd.commonEventId))
        err(`callCommonEvent references unknown common event "${cmd.commonEventId}"`);
      else if (source.startsWith('commonEvent/') && cmd.commonEventId === ownerLabel)
        err(`callCommonEvent cannot call its own common event "${cmd.commonEventId}"`);
      break;
    case 'startQuest':
    case 'completeQuest':
      if (!index.questIds.has(cmd.questId)) err(`${cmd.type} references unknown quest "${cmd.questId}"`);
      break;
    case 'updateQuestObjective': {
      if (!index.questIds.has(cmd.questId))
        err(`updateQuestObjective references unknown quest "${cmd.questId}"`);
      const objectives = index.questObjectives.get(cmd.questId);
      if (objectives && !objectives.has(cmd.objectiveId))
        err(
          `updateQuestObjective references unknown objective "${cmd.objectiveId}" in quest "${cmd.questId}"`,
        );
      break;
    }
    case 'openShop':
      if (!index.shopIds.has(cmd.shopId)) err(`openShop references unknown shop "${cmd.shopId}"`);
      break;
    case 'playSound':
      if (!index.audioIds.has(cmd.soundId)) err(`playSound references unknown audio id "${cmd.soundId}"`);
      break;
    case 'startBattle':
      if (!index.troopIds.has(cmd.troopId)) err(`startBattle references unknown troop "${cmd.troopId}"`);
      if (cmd.canEscape) err('startBattle canEscape is not supported by deterministic runtime battles');
      break;
    case 'changeActorHp':
      if (!index.actorIds.has(cmd.actorId)) err(`changeActorHp references unknown actor "${cmd.actorId}"`);
      break;
    case 'playAnimation': {
      const targetEvent =
        cmd.target === 'thisEvent'
          ? ownerEvent
          : cmd.target === 'event'
            ? mapEvents.find(e => e.id === cmd.eventId)
            : undefined;
      if (cmd.target === 'event' && !targetEvent) {
        err(`playAnimation targets unknown event "${cmd.eventId ?? ''}"`);
      }

      const setId =
        cmd.target === 'player'
          ? index.animationClips.has(index.playerAnimationSet) ? index.playerAnimationSet : ''
          : targetEvent?.animationSet ?? '';
      const clips = setId ? index.animationClips.get(setId) : undefined;
      const directionMatches =
        cmd.direction === 'current'
          ? [...(clips ?? new Set<string>())].some(key => key.startsWith(`${cmd.action}:`))
          : clips?.has(`${cmd.action}:${cmd.direction}`) || clips?.has(`${cmd.action}:any`);

      if (!clips || !directionMatches) {
        err(`playAnimation references unknown animation clip "${setId || '(missing-set)'}/${cmd.action}/${cmd.direction}"`);
      }
      if (!Number.isFinite(cmd.durationMs) || cmd.durationMs < 0) {
        err(`playAnimation durationMs must be a non-negative finite number`);
      }
      break;
    }
    case 'pluginCommand':
      validatePluginCommand(cmd, index, err);
      break;
    case 'setMovementRoute': {
      if (!VALID_MOVEMENT_ROUTE_TARGETS.includes(cmd.target)) {
        err(`setMovementRoute has invalid target "${cmd.target}"`);
      }
      if (cmd.target === 'event' && !mapEvents.some(event => event.id === cmd.eventId)) {
        err(`setMovementRoute targets unknown event "${cmd.eventId ?? ''}"`);
      }
      if (!Array.isArray(cmd.steps)) {
        err(`setMovementRoute steps must be an array`);
        break;
      }
      cmd.steps.forEach((step, index) => {
        if (!VALID_MOVEMENT_ROUTE_STEPS.has(step.type)) {
          err(`setMovementRoute step ${index + 1} has invalid step type "${step.type}"`);
        }
        if (step.type === 'wait' && (!Number.isFinite(step.ms) || (step.ms ?? 0) < 0)) {
          err(`setMovementRoute step ${index + 1} wait ms must be a non-negative finite number`);
        }
      });
      break;
    }
    case 'addGold':
    case 'removeGold':
      if (!Number.isFinite(cmd.amount) || cmd.amount < 0)
        err(`${cmd.type} amount must be a non-negative finite number`);
      break;
    case 'wait':
      if (!Number.isFinite(cmd.ms) || cmd.ms < 0) err(`wait ms must be a non-negative finite number`);
      break;
    default:
      break;
  }

  return out;
}

function validatePluginCommand(cmd: EventCommand, index: RefIndex, err: (msg: string) => void): void {
  if (cmd.type !== 'pluginCommand') return;

  if (!SAFE_PLUGIN_IDENTIFIER.test(cmd.pluginId)) {
    err(`pluginCommand pluginId "${cmd.pluginId}" is not a safe identifier`);
  }
  if (!SAFE_PLUGIN_COMMAND.test(cmd.command)) {
    err(`pluginCommand command "${cmd.command}" is not a safe identifier`);
  }

  const args = (cmd as { args?: unknown }).args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    err(`pluginCommand args must be an object of scalar values`);
    return;
  }

  for (const [key, value] of Object.entries(args)) {
    if (!SAFE_PLUGIN_ARG_KEY.test(key)) {
      err(`pluginCommand arg "${key}" is not a safe identifier`);
    }
    if (!isPluginScalarArg(value)) {
      err(`pluginCommand arg "${key}" must be a scalar`);
      continue;
    }
    if (typeof value === 'string' && CODE_LIKE_PLUGIN_TEXT.test(value)) {
      err(`pluginCommand arg "${key}" contains code-like text`);
    }
  }

  validateRegisteredPluginCommandArgs(cmd, args as Record<string, unknown>, index, err);
}

function isPluginScalarArg(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function validateRegisteredPluginCommandArgs(
  cmd: EventCommand,
  args: Record<string, unknown>,
  index: RefIndex,
  err: (msg: string) => void,
): void {
  if (cmd.type !== 'pluginCommand') return;
  const definition = findPluginCommandDefinition(cmd.pluginId, cmd.command);
  if (!definition) return;

  const commandKey = pluginCommandKey(cmd.pluginId, cmd.command);
  for (const arg of definition.args) {
    const value = args[arg.key];
    if (arg.required && isMissingRequiredPluginArg(arg, value)) {
      err(`pluginCommand ${commandKey} missing required arg "${arg.key}"`);
      continue;
    }
    if (value === undefined || value === null) continue;
    if (!matchesPluginArgKind(value, arg.kind)) {
      err(`pluginCommand ${commandKey} arg "${arg.key}" must be ${arg.kind}`);
      continue;
    }
    if (arg.reference === 'switch' && typeof value === 'string' && !index.switchIds.has(value)) {
      err(`pluginCommand ${commandKey} arg "${arg.key}" references unknown switch "${value}"`);
    }
    if (arg.reference === 'variable' && typeof value === 'string' && !index.variableIds.has(value)) {
      err(`pluginCommand ${commandKey} arg "${arg.key}" references unknown variable "${value}"`);
    }
  }
}

function isMissingRequiredPluginArg(arg: PluginCommandArgDefinition, value: unknown): boolean {
  return value === undefined || value === null || (arg.kind === 'string' && value === '');
}

function matchesPluginArgKind(value: unknown, kind: PluginCommandArgDefinition['kind']): boolean {
  if (kind === 'null') return value === null;
  if (kind === 'string') return typeof value === 'string';
  if (kind === 'boolean') return typeof value === 'boolean';
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  return false;
}

// ---- Backwards-compatible exports used by older callers / tests. ---------

export function validateItemReferencesInMap(map: MapData, itemIds: Set<string>): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    forEachEventCommandList(event, commands => walkAllCommands(commands, cmd => {
      if (cmd.type === 'addItem' && !itemIds.has(cmd.itemId)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" addItem references unknown item "${cmd.itemId}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    }));
  }
  return out;
}

export function validateTriggerAndCommandTypesInMap(map: MapData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    if (!VALID_TRIGGERS.includes(event.trigger)) {
      out.push({
        level: 'error',
        message: `Event "${event.id}" has invalid trigger "${event.trigger}"`,
        source: `${map.id}/${event.id}`,
      });
    }
    forEachEventCommandList(event, commands => walkAllCommands(commands, cmd => {
      if (!VALID_COMMAND_TYPES.has(cmd.type)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" has unknown command type "${cmd.type}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    }));
  }
  return out;
}

export function validateTransferTargetsInMap(map: MapData, mapIds: string[]): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    forEachEventCommandList(event, commands => walkAllCommands(commands, cmd => {
      if (cmd.type === 'transferMap' && !mapIds.includes(cmd.mapId)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" transfers to unknown map "${cmd.mapId}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    }));
  }
  return out;
}

function forEachEventCommandList(event: GameEvent, visit: (commands: EventCommand[]) => void): void {
  visit(event.commands);
  for (const page of event.pages ?? []) visit(page.commands);
}

function walkAllCommands(commands: EventCommand[], visit: (cmd: EventCommand) => void): void {
  for (const cmd of commands) {
    visit(cmd);
    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifSelfSwitch' || cmd.type === 'ifVariable') {
      walkAllCommands(cmd.then, visit);
      walkAllCommands(cmd.else, visit);
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) walkAllCommands(choice.commands, visit);
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) walkAllCommands(cmd.victoryBranch, visit);
      if (cmd.defeatBranch) walkAllCommands(cmd.defeatBranch, visit);
    }
  }
}

export function eventPositionInBounds(event: GameEvent, map: MapData): boolean {
  return event.x >= 0 && event.x < map.width && event.y >= 0 && event.y < map.height;
}
