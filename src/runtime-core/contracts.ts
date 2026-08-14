import type {
  AssetCatalogData,
  DatabaseEntries,
  Direction,
  ItemDatabase,
  MapData,
  ProjectData,
} from '../types/project';
import type { InputBindingMap } from './inputRouter';
import type { PluginPermissionGrant } from './plugins';
import type { VisualNovelContentV1 } from '../dialogue/contracts';

export const GAME_BUNDLE_SCHEMA_VERSION = 1 as const;
export const RUNTIME_CONFIG_SCHEMA_VERSION = 1 as const;

/** Renderer-neutral, self-contained payload consumed by a runtime host. */
export interface GameBundleV1 {
  schemaVersion: typeof GAME_BUNDLE_SCHEMA_VERSION;
  project: ProjectData;
  maps: Record<string, MapData>;
  items: ItemDatabase;
  databases: DatabaseEntries;
  assets?: AssetCatalogData;
  /** Optional renderer-neutral visual novel scenes. */
  dialogue?: VisualNovelContentV1;
}

export type GameBundle = GameBundleV1;

export interface RuntimeStartOverride {
  mapId: string;
  x: number;
  y: number;
  direction?: Direction;
}

export interface RuntimeConfigV1 {
  schemaVersion: typeof RUNTIME_CONFIG_SCHEMA_VERSION;
  /** Fixed simulation frequency. Rendering may run at a different rate. */
  tickRateHz: number;
  maxFrameDeltaMs: number;
  inputBindings: InputBindingMap;
  save: {
    maxSlots: number;
    autosaveEnabled: boolean;
  };
  pluginGrants: readonly PluginPermissionGrant[];
  startOverride?: RuntimeStartOverride;
}

export type RuntimeConfig = RuntimeConfigV1;

export function createRuntimeConfig(
  overrides: Partial<Omit<RuntimeConfigV1, 'schemaVersion'>> = {},
): RuntimeConfigV1 {
  return {
    schemaVersion: RUNTIME_CONFIG_SCHEMA_VERSION,
    tickRateHz: overrides.tickRateHz ?? 60,
    maxFrameDeltaMs: overrides.maxFrameDeltaMs ?? 250,
    inputBindings: overrides.inputBindings ?? {},
    save: overrides.save ?? { maxSlots: 3, autosaveEnabled: false },
    pluginGrants: overrides.pluginGrants ?? [],
    startOverride: overrides.startOverride,
  };
}
