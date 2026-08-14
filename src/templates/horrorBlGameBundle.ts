import { mergeDatabases } from '../adapters/defaultDatabases';
import type { FullProjectState } from '../adapters/types';
import type { VisualNovelContentV1 } from '../dialogue/contracts';
import {
  compileGameBundleV1,
  type GameBundleCompileOptions,
  type GameBundleCompileResult,
} from '../runtime-core/gameBundleCompiler';
import type {
  AnimationSetData,
  AssetCatalogData,
  Direction,
  EventCommand,
  GameEvent,
  MapData,
  MapLayer,
} from '../types/project';
import { assertValidHorrorBlVerticalSlice } from './horrorBlVerticalSlice';

export const HORROR_BL_MATERIALIZATION_SCHEMA_VERSION = 1 as const;

/**
 * Template-owned audio routing. Legacy engine cue ids remain available, but
 * every route resolves to the chapter's deterministic procedural WAVs rather
 * than generic town/chest fixture media.
 */
export const HORROR_BL_AUDIO_REGISTRY: Record<string, string> = {
  confirm: 'assets/audio/horror-bl/ui-confirm.wav',
  cancel: 'assets/audio/horror-bl/ui-cancel.wav',
  chest: 'assets/audio/horror-bl/ui-confirm.wav',
  chest_open: 'assets/audio/horror-bl/ui-confirm.wav',
  battle: 'assets/audio/horror-bl/ninth-witness-stinger.wav',
  town_bgm: 'assets/audio/horror-bl/ambience-facility-lobby.wav',
  town_theme: 'assets/audio/horror-bl/ambience-facility-lobby.wav',
  ambience_facility_lobby: 'assets/audio/horror-bl/ambience-facility-lobby.wav',
  ambience_archive_sublevel: 'assets/audio/horror-bl/ambience-archive-sublevel.wav',
  ambience_service_corridor: 'assets/audio/horror-bl/ambience-service-corridor.wav',
  ninth_witness_stinger: 'assets/audio/horror-bl/ninth-witness-stinger.wav',
  footstep_concrete: 'assets/audio/horror-bl/footstep-concrete.wav',
  ending_memory_release: 'assets/audio/horror-bl/ending-memory-release.wav',
};

/**
 * Presentation code uses these asset ids, never the legacy path registry
 * above. Keeping the two layers separate lets old projects retain their audio
 * path registry while Phaser and Android resolve preloaded manifest keys.
 */
export const HORROR_BL_AUDIO_CUE_ASSET_IDS: Record<string, string> = {
  'map.facility_lobby': 'audio.ambience.facility-lobby',
  'map.archive_sublevel': 'audio.ambience.archive-sublevel',
  'map.service_corridor': 'audio.ambience.service-corridor',
  'ninth-witness.stinger': 'audio.stinger.ninth-witness',
  'ui.confirm': 'audio.ui.confirm',
  'ui.cancel': 'audio.ui.cancel',
  'footstep.concrete': 'audio.footstep.concrete',
  'ending.memory-release': 'audio.ending.memory-release',
};

interface BlueprintEffect {
  op: 'add' | 'setFlag';
  target: string;
  value: number | boolean;
}

interface BlueprintChoiceOption {
  id: string;
  text: string;
  effects: BlueprintEffect[];
  nextBeatId?: string;
  endingId?: string;
}

interface BlueprintStoryBeat {
  id: string;
  type: 'dialogue' | 'choice' | 'exploration' | 'puzzle' | 'chase';
  mapId: string;
  summary: string;
  prompt?: string;
  objective?: string;
  options?: BlueprintChoiceOption[];
}

interface BlueprintInteraction {
  id: string;
  kind: 'evidence' | 'choice' | 'transfer' | 'puzzle' | 'chase';
  evidenceId?: string;
  beatId?: string;
  targetMapId?: string;
  systemId?: string;
}

interface BlueprintConnection {
  toMapId: string;
  exitId: string;
  entryId: string;
  lockedByFlag?: string;
}

interface BlueprintMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  mood: string;
  backgroundSlot: string;
  interactions: BlueprintInteraction[];
  connections: BlueprintConnection[];
}

interface BlueprintEvidence {
  id: string;
  title: string;
  revelation: string;
  effects: BlueprintEffect[];
}

interface BlueprintPuzzle {
  id: string;
  prompt: string;
  sequence: string[];
  successEffects: BlueprintEffect[];
  assistedBypass?: { enabled: boolean; effects: BlueprintEffect[] };
}

interface BlueprintChase {
  id: string;
  threatId: string;
  objective: string;
  successEffects: BlueprintEffect[];
}

interface BlueprintThreat {
  id: string;
  assetSlot?: string;
}

interface BlueprintEnding {
  id: string;
  title: string;
  resolution: string;
}

interface HorrorBlBlueprintV1 {
  schemaVersion: 1;
  id: string;
  title: string;
  startMapId: string;
  state: {
    variables: Array<{ id: string; label: string; initial: number }>;
    flags: Array<{ id: string; initial: boolean }>;
  };
  characters: Array<{ id: string; name: string; portraitSlot?: string }>;
  threats: BlueprintThreat[];
  maps: BlueprintMap[];
  evidence: BlueprintEvidence[];
  puzzles: BlueprintPuzzle[];
  chases: BlueprintChase[];
  storyBeats: BlueprintStoryBeat[];
  endings: BlueprintEnding[];
}

export interface HorrorBlGameBundleMaterializationOptions {
  /** Approved local runtime assets. Editor-only metadata is stripped by the compiler. */
  assets?: AssetCatalogData;
  /** Optional VN payload produced by the separate narrative adapter. */
  dialogue?: VisualNovelContentV1;
  /** Explicit allowlist; defaults to every runtime-compatible supplied asset. */
  assetAllowlist?: readonly string[];
  allowedAssetRoots?: readonly string[];
}

export interface HorrorBlMaterializationReportV1 {
  schemaVersion: typeof HORROR_BL_MATERIALIZATION_SCHEMA_VERSION;
  blueprintId: string;
  bundleSchemaVersion: 1;
  mapIds: string[];
  start: { mapId: string; x: number; y: number; direction: Direction };
  assetAllowlist: string[];
  dialogueIncluded: boolean;
  offlineOnly: true;
  externalReferencesAllowed: false;
}

export type HorrorBlGameBundleMaterializationResult =
  | {
      ok: true;
      state: FullProjectState;
      bundle: Extract<GameBundleCompileResult, { ok: true }>['bundle'];
      warnings: Extract<GameBundleCompileResult, { ok: true }>['warnings'];
      report: HorrorBlMaterializationReportV1;
    }
  | {
      ok: false;
      stage: 'blueprint' | 'compiler';
      errors: Array<{ code: string; path: string; message: string }>;
      warnings: Array<{ code: string; path: string; message: string }>;
    };

type MaterializationContext = {
  evidence: Map<string, BlueprintEvidence>;
  puzzles: Map<string, BlueprintPuzzle>;
  chases: Map<string, BlueprintChase>;
  threats: Map<string, BlueprintThreat>;
  beats: Map<string, BlueprintStoryBeat>;
  endings: Map<string, BlueprintEnding>;
  mapStarts: Map<string, { x: number; y: number }>;
  approvedAssetIds: Set<string>;
};

const DEFAULT_ASSET_CATALOG: AssetCatalogData = { schemaVersion: 1, assets: [] };

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function animationSetsFromAssets(assets: AssetCatalogData): AnimationSetData[] {
  const sets = new Map<string, AnimationSetData>();
  for (const asset of assets.assets) {
    const sheet = asset.generated?.spriteSheet;
    const setId = sheet?.animationSetId;
    if (asset.runtimeCompatible !== true || asset.kind !== 'spritesheet' || !sheet || !setId) continue;
    const set: AnimationSetData = sets.get(setId) ?? { id: setId, clips: [] };
    set.clips.push({
      action: sheet.action,
      direction: sheet.direction,
      asset: asset.id,
      frameSize: { width: sheet.frameWidth, height: sheet.frameHeight },
      frameCount: sheet.frameCount,
      fps: sheet.fps ?? 8,
      loop: sheet.action !== 'interact',
      anchor: sheet.anchor ?? { x: sheet.frameWidth / 2, y: sheet.frameHeight },
    });
    sets.set(setId, set);
  }
  return [...sets.values()].map(set => ({
    ...set,
    clips: [...set.clips].sort((left, right) =>
      `${left.action}.${left.direction}.${left.asset}`.localeCompare(
        `${right.action}.${right.direction}.${right.asset}`,
      )),
  })).sort((left, right) => left.id.localeCompare(right.id));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapStart(map: Pick<BlueprintMap, 'width' | 'height'>): { x: number; y: number } {
  return {
    x: clamp(2, 1, map.width - 2),
    y: clamp(Math.floor(map.height / 2), 1, map.height - 2),
  };
}

function roomLayers(map: BlueprintMap, mapIndex: number): MapLayer[] {
  const tileCount = map.width * map.height;
  const groundTile = mapIndex + 1;
  const ground = new Array<number>(tileCount).fill(groundTile);
  const decoration = new Array<number>(tileCount).fill(0);
  const foreground = new Array<number>(tileCount).fill(0);
  const collision = new Array<number>(tileCount).fill(0);
  const region = new Array<number>(tileCount).fill(0);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) {
        collision[index] = 9;
        foreground[index] = 10 + mapIndex;
      }
    }
  }

  return [
    { name: 'ground', type: 'visual', role: 'ground', visible: true, locked: false, tiles: ground },
    { name: 'decoration', type: 'visual', role: 'decoration', visible: true, locked: false, tiles: decoration },
    { name: 'foreground', type: 'visual', role: 'foreground', visible: true, locked: false, tiles: foreground },
    { name: 'collision', type: 'collision', role: 'collision', visible: false, locked: false, tiles: collision },
    { name: 'region', type: 'region', role: 'region', visible: false, locked: false, tiles: region },
  ];
}

function effectCommands(effects: readonly BlueprintEffect[] | undefined): EventCommand[] {
  return (effects ?? []).flatMap((effect): EventCommand[] => {
    if (effect.op === 'setFlag' && typeof effect.value === 'boolean') {
      return [{ type: 'setFlag', flag: effect.target, value: effect.value }];
    }
    if (effect.op === 'add' && typeof effect.value === 'number') {
      return [{ type: 'controlVariable', variableId: effect.target, op: 'add', value: effect.value }];
    }
    return [];
  });
}

function transferCommands(
  connection: BlueprintConnection | undefined,
  targetMapId: string,
  context: MaterializationContext,
): EventCommand[] {
  const target = context.mapStarts.get(targetMapId) ?? { x: 1, y: 1 };
  const transfer: EventCommand = {
    type: 'transferMap',
    mapId: targetMapId,
    x: target.x,
    y: target.y,
    direction: 'right',
  };
  if (!connection?.lockedByFlag) return [transfer];
  return [{
    type: 'ifFlag',
    flag: connection.lockedByFlag,
    equals: true,
    then: [transfer],
    else: [{ type: 'showText', text: 'La puerta estéril no responde. La consola del archivo sigue sin energía.' }],
  }];
}

function choiceCommands(beat: BlueprintStoryBeat | undefined, context: MaterializationContext): EventCommand[] {
  if (!beat?.options?.length) {
    return [{ type: 'showText', text: beat?.summary ?? 'La memoria no responde todavía.' }];
  }
  return [{
    type: 'showChoices',
    prompt: beat.prompt ?? beat.summary,
    choices: beat.options.map(option => {
      const destination = option.endingId
        ? context.endings.get(option.endingId)?.resolution
        : option.nextBeatId
          ? context.beats.get(option.nextBeatId)?.summary
          : undefined;
      return {
        label: option.text,
        commands: [
          ...effectCommands(option.effects),
          ...(destination ? [{ type: 'showText' as const, text: destination }] : []),
        ],
      };
    }),
  }];
}

function interactionCommands(
  map: BlueprintMap,
  interaction: BlueprintInteraction,
  context: MaterializationContext,
): EventCommand[] {
  switch (interaction.kind) {
    case 'evidence': {
      const evidence = interaction.evidenceId ? context.evidence.get(interaction.evidenceId) : undefined;
      return evidence
        ? [
            { type: 'showText', speaker: evidence.title, text: evidence.revelation },
            ...effectCommands(evidence.effects),
          ]
        : [{ type: 'showText', text: 'El registro está dañado.' }];
    }
    case 'choice':
      return choiceCommands(interaction.beatId ? context.beats.get(interaction.beatId) : undefined, context);
    case 'puzzle': {
      const puzzle = interaction.systemId ? context.puzzles.get(interaction.systemId) : undefined;
      if (!puzzle) return [{ type: 'showText', text: 'La consola está fuera de servicio.' }];
      const choices = [{
        label: puzzle.sequence.join(' → '),
        commands: [
          ...effectCommands(puzzle.successEffects),
          { type: 'showText' as const, text: 'La energía vuelve sin alimentar el banco de recuerdos.' },
        ],
      }];
      if (puzzle.assistedBypass?.enabled) {
        choices.push({
          label: 'Usar el puente de emergencia',
          commands: [
            ...effectCommands(puzzle.assistedBypass.effects),
            { type: 'showText' as const, text: 'El puente abre la puerta, pero una memoria ajena ocupa el lugar de la tuya.' },
          ],
        });
      }
      return [{ type: 'showChoices', prompt: puzzle.prompt, choices }];
    }
    case 'chase': {
      const chase = interaction.systemId ? context.chases.get(interaction.systemId) : undefined;
      return chase
        ? [
            { type: 'showText', speaker: 'El Noveno Testigo', text: chase.objective },
            ...effectCommands(chase.successEffects),
          ]
        : [{ type: 'showText', text: 'Algo se mueve detrás del vidrio.' }];
    }
    case 'transfer': {
      const targetMapId = interaction.targetMapId ?? '';
      const connection = map.connections.find(entry => entry.exitId === interaction.id && entry.toMapId === targetMapId);
      return transferCommands(connection, targetMapId, context);
    }
  }
}

function eventPosition(map: BlueprintMap, index: number): { x: number; y: number } {
  const usableWidth = Math.max(1, map.width - 5);
  const x = 3 + ((index * 4) % usableWidth);
  const row = Math.floor((index * 4) / usableWidth);
  return {
    x: clamp(x, 1, map.width - 2),
    y: clamp(2 + row * 3, 1, map.height - 2),
  };
}

function materializeMap(
  map: BlueprintMap,
  mapIndex: number,
  context: MaterializationContext,
): MapData {
  const interactions = [...map.interactions];
  for (const connection of map.connections) {
    if (!interactions.some(interaction => interaction.id === connection.exitId)) {
      interactions.push({
        id: connection.exitId,
        kind: 'transfer',
        targetMapId: connection.toMapId,
      });
    }
  }

  const events: GameEvent[] = interactions.map((interaction, index) => {
    const position = eventPosition(map, index);
    const isTransfer = interaction.kind === 'transfer';
    const chase = interaction.kind === 'chase' && interaction.systemId
      ? context.chases.get(interaction.systemId)
      : undefined;
    const threatAsset = chase
      ? context.threats.get(chase.threatId)?.assetSlot
      : undefined;
    return {
      id: interaction.id,
      type: isTransfer ? 'transfer' : interaction.kind === 'chase' ? 'trigger' : 'object',
      x: position.x,
      y: position.y,
      solid: !isTransfer && interaction.kind !== 'chase',
      trigger: isTransfer || interaction.kind === 'chase' ? 'touch' : 'interact',
      ...(threatAsset && context.approvedAssetIds.has(threatAsset)
        ? { sprite: threatAsset }
        : {}),
      commands: interactionCommands(map, interaction, context),
    };
  });

  return {
    schemaVersion: 1,
    id: map.id,
    name: map.name,
    displayName: map.name,
    tilesetId: 'horror-bl-procedural',
    scrollType: 'none',
    battleback: '',
    encounterSteps: 0,
    encounters: [],
    parallax: context.approvedAssetIds.has(map.backgroundSlot)
      ? { image: map.backgroundSlot }
      : {},
    width: map.width,
    height: map.height,
    tileSize: map.tileSize,
    layers: roomLayers(map, mapIndex),
    events,
  };
}

function blueprintIssues(value: unknown): Array<{ code: string; path: string; message: string }> {
  try {
    assertValidHorrorBlVerticalSlice(value);
    return [];
  } catch (error) {
    return [{
      code: 'blueprint.invalid',
      path: '$',
      message: error instanceof Error ? error.message : String(error),
    }];
  }
}

/**
 * Deterministically materializes the design-time vertical slice into editor
 * state. It performs no I/O, provider calls, clock reads, or input mutation.
 */
export function materializeHorrorBlProjectState(
  value: unknown,
  options: HorrorBlGameBundleMaterializationOptions = {},
): FullProjectState {
  assertValidHorrorBlVerticalSlice(value);
  const blueprint = value as unknown as HorrorBlBlueprintV1;
  const assets = cloneJson(options.assets ?? DEFAULT_ASSET_CATALOG);
  const mapStarts = new Map(blueprint.maps.map(map => [map.id, mapStart(map)]));
  const context: MaterializationContext = {
    evidence: new Map(blueprint.evidence.map(entry => [entry.id, entry])),
    puzzles: new Map(blueprint.puzzles.map(entry => [entry.id, entry])),
    chases: new Map(blueprint.chases.map(entry => [entry.id, entry])),
    threats: new Map(blueprint.threats.map(entry => [entry.id, entry])),
    beats: new Map(blueprint.storyBeats.map(entry => [entry.id, entry])),
    endings: new Map(blueprint.endings.map(entry => [entry.id, entry])),
    mapStarts,
    // Catalog candidates may already have local bytes, but only explicitly
    // runtime-compatible entries have crossed the review/release gate.
    approvedAssetIds: new Set(
      assets.assets
        .filter(asset => asset.runtimeCompatible === true)
        .map(asset => asset.id),
    ),
  };
  const maps = Object.fromEntries(
    blueprint.maps.map((map, index) => [map.id, materializeMap(map, index, context)]),
  );
  const start = mapStarts.get(blueprint.startMapId) ?? { x: 1, y: 1 };
  const databases = mergeDatabases(undefined);
  databases.animations.sets = animationSetsFromAssets(assets);
  databases.variables = blueprint.state.variables.map(variable => ({
    id: variable.id,
    name: variable.label,
    initial: variable.initial,
  }));
  databases.switches = blueprint.state.flags.map(flag => ({
    id: flag.id,
    name: flag.id,
    initial: flag.initial,
  }));
  databases.classes = [{
    id: 'survivor',
    name: 'Sobreviviente',
    growth: {
      maxHp: 100, maxMp: 0, attack: 10, defense: 10,
      magicAttack: 0, magicDefense: 10, agility: 12, luck: 5,
    },
    usableEquipment: [],
    learnedSkills: [],
  }];
  const approvedAssetIds = context.approvedAssetIds;
  databases.actors = blueprint.characters.map(character => ({
    id: character.id,
    name: character.name,
    classId: 'survivor',
    ...(character.portraitSlot && approvedAssetIds.has(character.portraitSlot)
      ? { portraitAssetId: character.portraitSlot }
      : {}),
    level: 1,
    hp: 100,
    mp: 0,
    baseStats: {
      maxHp: 100, maxMp: 0, attack: 10, defense: 10,
      magicAttack: 0, magicDefense: 10, agility: 12, luck: 5,
    },
    equipment: {},
    skills: [],
  }));
  databases.system.startingParty = [blueprint.characters[0]?.id ?? 'damian'];
  databases.system.startingGold = 0;
  databases.system.defaultBgm = 'ambience_facility_lobby';
  databases.system.audio = { ...HORROR_BL_AUDIO_REGISTRY };
  databases.system.audioAssetIds = { ...HORROR_BL_AUDIO_CUE_ASSET_IDS };
  const playerId = blueprint.characters[0]?.id;
  const playerAnimationSet = assets.assets.find(asset =>
    asset.runtimeCompatible === true
      && asset.kind === 'spritesheet'
      && asset.generated?.ownerId === playerId
      && asset.generated.spriteSheet?.animationSetId,
  )?.generated?.spriteSheet?.animationSetId;
  if (playerAnimationSet) databases.system.playerAnimationSet = playerAnimationSet;

  return {
    templateId: 'horror-bl',
    project: {
      schemaVersion: 1,
      title: blueprint.title,
      startMapId: blueprint.startMapId,
      startPosition: { ...start, direction: 'right' },
      maps: blueprint.maps.map((map, index) => ({
        id: map.id,
        path: `data/maps/${map.id}.json`,
        parentId: null,
        order: index,
        expanded: index === 0,
      })),
      database: {
        items: 'data/database/items.json',
        actors: 'data/database/actors.json',
        classes: 'data/database/classes.json',
        system: 'data/database/system.json',
        switches: 'data/database/switches.json',
        variables: 'data/database/variables.json',
      },
      assetCatalog: 'data/assets/assets-manifest.json',
      visualProfile: {
        aspectRatio: '16:9',
        baseResolution: { width: 960, height: 540 },
        tileSize: 48,
        cameraMode: 'fixed-room',
        mapPresentation: 'full-scene',
        zoom: 1,
        integerScale: true,
      },
    },
    maps,
    items: { items: [] },
    databases,
    assets,
    ...(options.dialogue ? { dialogue: cloneJson(options.dialogue) } : {}),
  };
}

/** Compiles the materialized state through the canonical GameBundle v1 compiler. */
export function materializeHorrorBlGameBundle(
  value: unknown,
  options: HorrorBlGameBundleMaterializationOptions = {},
): HorrorBlGameBundleMaterializationResult {
  const validationErrors = blueprintIssues(value);
  if (validationErrors.length > 0) {
    return { ok: false, stage: 'blueprint', errors: validationErrors, warnings: [] };
  }

  const state = materializeHorrorBlProjectState(value, options);
  const compileOptions: GameBundleCompileOptions = {
    ...(options.assetAllowlist ? { assetAllowlist: options.assetAllowlist } : {}),
    ...(options.allowedAssetRoots ? { allowedAssetRoots: options.allowedAssetRoots } : {}),
  };
  const compiled = compileGameBundleV1(state, compileOptions);
  if (!compiled.ok) {
    return {
      ok: false,
      stage: 'compiler',
      errors: compiled.errors,
      warnings: compiled.warnings,
    };
  }

  const blueprint = value as unknown as HorrorBlBlueprintV1;
  const assetAllowlist = options.assetAllowlist
    ? [...options.assetAllowlist]
    : (state.assets?.assets ?? [])
        .filter(asset => asset.runtimeCompatible === true)
        .map(asset => asset.id);
  return {
    ok: true,
    state,
    bundle: compiled.bundle,
    warnings: compiled.warnings,
    report: {
      schemaVersion: HORROR_BL_MATERIALIZATION_SCHEMA_VERSION,
      blueprintId: blueprint.id,
      bundleSchemaVersion: 1,
      mapIds: blueprint.maps.map(map => map.id),
      start: {
        mapId: compiled.bundle.project.startMapId,
        ...compiled.bundle.project.startPosition,
      },
      assetAllowlist,
      dialogueIncluded: Boolean(compiled.bundle.dialogue),
      offlineOnly: true,
      externalReferencesAllowed: false,
    },
  };
}
