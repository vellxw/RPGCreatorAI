// In-memory adapter seeded from the bundled JSON. The "save" methods update
// the in-memory snapshot so the rest of the editor sees consistent data, and
// can produce a downloadable export. It never claims to write to disk.

import type {
  AdapterCapabilities,
  FullProjectState,
  ProjectDataAdapter,
  SaveResult,
} from './types';
import type {
  ActorData,
  ClassData,
  CommonEventData,
  EnemyData,
  ItemDatabase,
  MapData,
  ProjectData,
  QuestData,
  ShopData,
  SkillData,
  WeaponData,
  ArmorData,
  StateData,
  TypesDatabaseData,
  TermsDatabaseData,
  SwitchData,
  SystemData,
  TroopData,
  VariableData,
  AnimationDatabaseData,
  TilesetDatabaseData,
} from '../types/project';
import { buildExportBundle, parseImportBundle, safeStringify } from './jsonUtils';
import { mergeDatabases } from './defaultDatabases';

import projectJson from '../../data/project.json';
import townJson from '../../data/maps/town.json';
import houseJson from '../../data/maps/house.json';
import itemsJson from '../../data/database/items.json';
import actorsJson from '../../data/database/actors.json';
import classesJson from '../../data/database/classes.json';
import skillsJson from '../../data/database/skills.json';
import weaponsJson from '../../data/database/weapons.json';
import armorsJson from '../../data/database/armors.json';
import statesJson from '../../data/database/states.json';
import typesJson from '../../data/database/types.json';
import termsJson from '../../data/database/terms.json';
import enemiesJson from '../../data/database/enemies.json';
import troopsJson from '../../data/database/troops.json';
import questsJson from '../../data/database/quests.json';
import shopsJson from '../../data/database/shops.json';
import systemJson from '../../data/database/system.json';
import switchesJson from '../../data/database/switches.json';
import variablesJson from '../../data/database/variables.json';
import commonEventsJson from '../../data/database/commonEvents.json';
import animationsJson from '../../data/database/animations.json';
import tilesetsJson from '../../data/database/tilesets.json';

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

interface SchemaWrapper<T> {
  schemaVersion?: number;
  [key: string]: unknown | T[];
}

function unwrapList<T>(json: SchemaWrapper<T>, key: string): T[] {
  const value = (json as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function seedFromBundle(): FullProjectState {
  return {
    project: deepClone(projectJson) as ProjectData,
    maps: {
      town: deepClone(townJson) as unknown as MapData,
      house: deepClone(houseJson) as unknown as MapData,
    },
    items: {
      items: unwrapList<ItemDatabase['items'][number]>(
        deepClone(itemsJson) as SchemaWrapper<ItemDatabase['items'][number]>,
        'items',
      ),
    },
    databases: mergeDatabases({
      actors: unwrapList<ActorData>(deepClone(actorsJson) as SchemaWrapper<ActorData>, 'actors'),
      classes: unwrapList<ClassData>(deepClone(classesJson) as SchemaWrapper<ClassData>, 'classes'),
      skills: unwrapList<SkillData>(deepClone(skillsJson) as SchemaWrapper<SkillData>, 'skills'),
      weapons: unwrapList<WeaponData>(deepClone(weaponsJson) as SchemaWrapper<WeaponData>, 'weapons'),
      armors: unwrapList<ArmorData>(deepClone(armorsJson) as SchemaWrapper<ArmorData>, 'armors'),
      states: unwrapList<StateData>(deepClone(statesJson) as SchemaWrapper<StateData>, 'states'),
      types: extractTypes(deepClone(typesJson) as Record<string, unknown>),
      terms: extractTerms(deepClone(termsJson) as Record<string, unknown>),
      enemies: unwrapList<EnemyData>(deepClone(enemiesJson) as SchemaWrapper<EnemyData>, 'enemies'),
      troops: unwrapList<TroopData>(deepClone(troopsJson) as SchemaWrapper<TroopData>, 'troops'),
      quests: unwrapList<QuestData>(deepClone(questsJson) as SchemaWrapper<QuestData>, 'quests'),
      shops: unwrapList<ShopData>(deepClone(shopsJson) as SchemaWrapper<ShopData>, 'shops'),
      switches: unwrapList<SwitchData>(deepClone(switchesJson) as SchemaWrapper<SwitchData>, 'switches'),
      variables: unwrapList<VariableData>(
        deepClone(variablesJson) as SchemaWrapper<VariableData>,
        'variables',
      ),
      commonEvents: unwrapList<CommonEventData>(
        deepClone(commonEventsJson) as SchemaWrapper<CommonEventData>,
        'commonEvents',
      ),
      animations: extractAnimations(deepClone(animationsJson) as Record<string, unknown>),
      tilesets: extractTilesets(deepClone(tilesetsJson) as Record<string, unknown>),
      system: extractSystem(deepClone(systemJson) as Record<string, unknown>),
    }),
  };
}

function extractSystem(json: Record<string, unknown>): SystemData {
  const audio =
    json.audio && typeof json.audio === 'object'
      ? Object.fromEntries(
          Object.entries(json.audio as Record<string, unknown>).filter(
            ([, value]) => typeof value === 'string',
          ) as Array<[string, string]>,
        )
      : undefined;
  return {
    startingParty: Array.isArray(json.startingParty) ? (json.startingParty as string[]) : [],
    startingGold: typeof json.startingGold === 'number' ? (json.startingGold as number) : 0,
    defaultBgm: typeof json.defaultBgm === 'string' ? (json.defaultBgm as string) : undefined,
    audio,
    windowTint: typeof json.windowTint === 'string' ? (json.windowTint as string) : undefined,
    battleBackground:
      typeof json.battleBackground === 'string' ? (json.battleBackground as string) : undefined,
    playerAnimationSet:
      typeof json.playerAnimationSet === 'string' ? (json.playerAnimationSet as string) : undefined,
    playerMovementSpeed:
      typeof json.playerMovementSpeed === 'string'
        ? (json.playerMovementSpeed as SystemData['playerMovementSpeed'])
        : 'double',
    defaultCharacterHeightTiles:
      typeof json.defaultCharacterHeightTiles === 'number'
        ? (json.defaultCharacterHeightTiles as number)
        : 1.5,
  };
}

function extractAnimations(json: Record<string, unknown>): AnimationDatabaseData {
  return {
    sets: Array.isArray(json.sets) ? (json.sets as AnimationDatabaseData['sets']) : [],
  };
}

function extractTilesets(json: Record<string, unknown>): TilesetDatabaseData {
  return {
    tilesets: Array.isArray(json.tilesets) ? (json.tilesets as TilesetDatabaseData['tilesets']) : [],
  };
}

function extractTypes(json: Record<string, unknown>): TypesDatabaseData {
  return {
    weaponTypes: Array.isArray(json.weaponTypes) ? (json.weaponTypes as TypesDatabaseData['weaponTypes']) : [],
    armorTypes: Array.isArray(json.armorTypes) ? (json.armorTypes as TypesDatabaseData['armorTypes']) : [],
    skillTypes: Array.isArray(json.skillTypes) ? (json.skillTypes as TypesDatabaseData['skillTypes']) : [],
    elements: Array.isArray(json.elements) ? (json.elements as TypesDatabaseData['elements']) : [],
    equipmentSlots: Array.isArray(json.equipmentSlots)
      ? (json.equipmentSlots as TypesDatabaseData['equipmentSlots'])
      : [],
    itemCategories: Array.isArray(json.itemCategories)
      ? (json.itemCategories as TypesDatabaseData['itemCategories'])
      : [],
  };
}

function extractTerms(json: Record<string, unknown>): TermsDatabaseData {
  return {
    currencyUnit: typeof json.currencyUnit === 'string' ? json.currencyUnit : 'G',
    stats: (json.stats ?? {}) as TermsDatabaseData['stats'],
    menu: (json.menu ?? {}) as TermsDatabaseData['menu'],
    commands: (json.commands ?? {}) as TermsDatabaseData['commands'],
    battle: (json.battle ?? {}) as TermsDatabaseData['battle'],
    saveLoad: (json.saveLoad ?? {}) as TermsDatabaseData['saveLoad'],
  };
}

export class BrowserMemoryAdapter implements ProjectDataAdapter {
  private snapshot: FullProjectState;

  constructor(initial?: FullProjectState) {
    this.snapshot = initial ? deepClone(initial) : seedFromBundle();
  }

  getCapabilities(): AdapterCapabilities {
    return {
      canReadFiles: false,
      canWriteFiles: false,
      canCreateBackups: false,
      adapterName: 'BrowserMemoryAdapter',
    };
  }

  async loadProject(): Promise<FullProjectState> {
    return deepClone(this.snapshot);
  }

  async saveProject(data: ProjectData): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.project = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveMap(mapId: string, data: MapData): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.maps[mapId] = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveItems(data: ItemDatabase): Promise<SaveResult> {
    try {
      safeStringify(data);
      this.snapshot.items = deepClone(data);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async saveAll(state: FullProjectState): Promise<SaveResult> {
    try {
      // Validate serialization for every shard before committing any of them.
      safeStringify(state.project);
      for (const [, m] of Object.entries(state.maps)) safeStringify(m);
      safeStringify(state.items);
      safeStringify(state.databases);

      this.snapshot = deepClone(state);
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  async exportAll(state: FullProjectState): Promise<Blob> {
    const bundle = buildExportBundle(state);
    const json = safeStringify(bundle);
    return new Blob([json], { type: 'application/json' });
  }

  async importAll(input: string | Blob): Promise<FullProjectState> {
    const text = typeof input === 'string' ? input : await input.text();
    const parsed = parseImportBundle(text);
    this.snapshot = deepClone(parsed);
    return deepClone(parsed);
  }
}
