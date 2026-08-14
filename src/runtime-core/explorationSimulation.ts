import type {
  AnimationClipData,
  AnimationSetData,
  Direction,
  EventCommand,
  GameEvent,
  MapData,
  MapLayer,
} from '../types/project';
import {
  evaluateVisualNovelAction,
  resumeVisualNovelScene,
  startVisualNovelScene,
  type VisualNovelEvaluationResult,
  type VisualNovelPresentation,
  type VisualNovelRuntimeCue,
  type VisualNovelRuntimeState,
  type VisualNovelVariables,
} from '../dialogue';
import type { GameBundleV1, RuntimeConfigV1 } from './contracts';
import { createRuntimeConfig } from './contracts';
import type { RuntimeInputAction } from './inputRouter';
import type { RuntimePresentationCue } from './presentationCues';
import { createPortableSave, type PortableSaveV2 } from './saveSchema';

export interface ExplorationRenderSprite {
  id: string;
  assetKey: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** Zero-based frame inside the compiled horizontal strip. */
  frame?: number;
  /** Normalized Phaser origin derived from the authored pixel-space anchor. */
  originX?: number;
  originY?: number;
  depth?: number;
  visible?: boolean;
  alpha?: number;
}

export interface ExplorationDialogue {
  eventId: string;
  speaker?: string;
  text: string;
  portraitAssetId?: string;
  kind?: 'dialogue' | 'choice' | 'ending';
  choices?: Array<{ id: string; text: string; selected: boolean }>;
  endingId?: string;
}

export interface ExplorationRenderSnapshot {
  backgroundColor?: string;
  world: { width: number; height: number };
  camera: { mode: 'fixed-room' | 'follow-player'; followEntityId: string; zoom: number };
  sprites: readonly ExplorationRenderSprite[];
  dialogue?: ExplorationDialogue;
}

export interface ExplorationSimulationOptions {
  bundle: GameBundleV1;
  config?: RuntimeConfigV1;
  playerAssetKey?: string;
  backgroundColor?: string;
  /** Milliseconds between grid steps while a movement action is held. */
  movementIntervalMs?: number;
  /** Opt-in VN scene. Omitted by default so authored exploration gates remain in control. */
  initialVisualNovelSceneId?: string;
}

export type BeginVisualNovelResult =
  | { ok: true; sceneId: string }
  | { ok: false; sceneId: string; error: string };

export interface ExplorationVisualNovelSession {
  state: VisualNovelRuntimeState;
  presentation: VisualNovelPresentation;
  selectedChoiceIndex: number;
}

export interface ExplorationSimulationState {
  mapId: string;
  player: { x: number; y: number; direction: Direction };
  flags: Record<string, boolean>;
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  inventory: Record<string, number>;
  gold: number;
  dialogue?: ExplorationDialogue;
}

const MOVEMENT_ACTIONS: Readonly<Record<RuntimeInputAction, Direction | undefined>> = {
  'move.up': 'up',
  'move.down': 'down',
  'move.left': 'left',
  'move.right': 'right',
  interact: undefined,
  cancel: undefined,
  menu: undefined,
  dash: undefined,
  pause: undefined,
};

const DIRECTION_DELTAS: Readonly<Record<Direction, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapLayer(map: MapData, predicate: (layer: MapLayer) => boolean): MapLayer | undefined {
  return map.layers.find(predicate);
}

function eventAt(map: MapData, x: number, y: number): GameEvent | undefined {
  return map.events.find(event => event.x === x && event.y === y);
}

function isBlocked(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  const collision = mapLayer(
    map,
    layer => layer.type === 'collision' || layer.role === 'collision' || layer.name === 'collision',
  );
  const tile = collision?.tiles[y * map.width + x];
  return tile === 9 || eventAt(map, x, y)?.solid === true;
}

/** Deterministic runtime fallback for stale starts and per-map entry points. */
export function findNearestTraversableMapTile(
  map: MapData,
  preferred: { x: number; y: number },
): { x: number; y: number } | undefined {
  if (map.width <= 0 || map.height <= 0) return undefined;
  const origin = {
    x: Math.max(0, Math.min(map.width - 1, Math.trunc(preferred.x))),
    y: Math.max(0, Math.min(map.height - 1, Math.trunc(preferred.y))),
  };
  const maxDistance = map.width + map.height - 2;
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (Math.abs(x - origin.x) + Math.abs(y - origin.y) !== distance) continue;
        if (!isBlocked(map, x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

/** Selects the canonical compiled strip clip for one semantic animation state. */
export function resolveBundleAnimationClip(
  bundle: GameBundleV1,
  animationSetId: string | undefined,
  action: string,
  direction: Direction,
): AnimationClipData | undefined {
  if (!animationSetId) return undefined;
  const set = bundle.databases.animations?.sets?.find(candidate => candidate.id === animationSetId);
  if (!set) return undefined;
  return set.clips.find(candidate => candidate.action === action && candidate.direction === direction)
    ?? set.clips.find(candidate => candidate.action === action && candidate.direction === 'any')
    ?? set.clips.find(candidate => candidate.action === 'idle' && candidate.direction === direction)
    ?? set.clips.find(candidate => candidate.action === 'idle' && candidate.direction === 'any')
    // Preserve the requested facing before falling back to another directional
    // strip; a wrong-facing walk is more visually damaging than an idle pose.
    ?? set.clips.find(candidate => candidate.direction === direction)
    ?? set.clips.find(candidate => candidate.action === action)
    ?? set.clips[0];
}

/** Resolves an animation-set reference to the stable catalog asset used by Phaser. */
export function resolveBundleAnimationAsset(
  bundle: GameBundleV1,
  animationSetId: string | undefined,
  action: string,
  direction: Direction,
): string | undefined {
  return resolveBundleAnimationClip(bundle, animationSetId, action, direction)?.asset;
}

function initialState(bundle: GameBundleV1, config: RuntimeConfigV1): ExplorationSimulationState {
  const start = config.startOverride ?? bundle.project.startPosition;
  const mapId = config.startOverride?.mapId ?? bundle.project.startMapId;
  const map = bundle.maps[mapId];
  if (!map) throw new Error(`Runtime start map "${mapId}" was not found in the GameBundle.`);
  const spawn = findNearestTraversableMapTile(map, start);
  if (!spawn) throw new Error(`Runtime start map "${mapId}" has no traversable spawn tile.`);
  return {
    mapId,
    player: { ...spawn, direction: start.direction ?? 'down' },
    flags: {},
    switches: {},
    variables: {},
    inventory: {},
    gold: 0,
  };
}

/**
 * Small deterministic exploration system used by the browser runtime. It is
 * intentionally renderer-neutral: Phaser, Canvas, tests, or a future native
 * host can all consume the same snapshots and input actions.
 */
export class ExplorationSimulation {
  private readonly bundle: GameBundleV1;
  private readonly config: RuntimeConfigV1;
  private readonly explicitPlayerAssetKey?: string;
  private readonly backgroundColor: string;
  private readonly movementIntervalMs: number;
  private readonly heldActions = new Set<RuntimeInputAction>();
  private state: ExplorationSimulationState;
  private movementElapsedMs = 0;
  private animationElapsedMs = 0;
  /** One-shot renderer state; gameplay remains owned by the exploration rules. */
  private playerInteractionActive = false;
  private visualNovelSession?: ExplorationVisualNovelSession;
  private visualNovelError?: string;
  private readonly presentationCues: RuntimePresentationCue[] = [];

  constructor(options: ExplorationSimulationOptions) {
    this.bundle = options.bundle;
    this.config = options.config ?? createRuntimeConfig();
    this.explicitPlayerAssetKey = options.playerAssetKey;
    this.backgroundColor = options.backgroundColor ?? '#11151d';
    this.movementIntervalMs = Math.max(1, options.movementIntervalMs ?? 120);
    this.state = initialState(this.bundle, this.config);
    if (options.initialVisualNovelSceneId) {
      this.beginVisualNovelScene(options.initialVisualNovelSceneId);
    } else {
      this.queueMapAmbience();
    }
  }

  advance(deltaMs: number): void {
    const safeDelta = Number.isFinite(deltaMs)
      ? Math.max(0, Math.min(deltaMs, this.config.maxFrameDeltaMs))
      : 0;
    this.advancePlayerAnimation(safeDelta);
    if (this.visualNovelSession) {
      this.movementElapsedMs = 0;
      return;
    }
    this.movementElapsedMs += safeDelta;
    while (this.movementElapsedMs >= this.movementIntervalMs) {
      this.movementElapsedMs -= this.movementIntervalMs;
      const direction = this.activeMovementDirection();
      if (!direction) break;
      this.move(direction);
    }
  }

  handleInput(action: RuntimeInputAction, phase: 'pressed' | 'released', _timestampMs: number): void {
    if (this.visualNovelSession) {
      if (phase === 'pressed') this.handleVisualNovelInput(action);
      return;
    }
    const previousAnimation = this.playerAnimationStateKey();
    if (phase === 'pressed') {
      this.heldActions.add(action);
      const direction = MOVEMENT_ACTIONS[action];
      if (direction) this.state.player.direction = direction;
      const restartedInteraction = action === 'interact' && this.beginPlayerInteraction();
      if (action === 'interact') this.interact();
      if (action === 'cancel') this.state.dialogue = undefined;
      this.resetPlayerAnimationIfChanged(previousAnimation, restartedInteraction);
      return;
    }
    this.heldActions.delete(action);
    this.resetPlayerAnimationIfChanged(previousAnimation);
  }

  getRenderSnapshot(): ExplorationRenderSnapshot {
    const map = this.currentMap();
    const tileSize = map.tileSize;
    const sprites: ExplorationRenderSprite[] = [];
    const backgroundAssetKey = map.parallax?.image ?? map.battleback;
    if (backgroundAssetKey && this.hasCatalogAsset(backgroundAssetKey)) {
      const backgroundSize = this.backgroundDisplaySize(
        backgroundAssetKey,
        map.width * tileSize,
        map.height * tileSize,
      );
      sprites.push({
        id: `background:${map.id}`,
        assetKey: backgroundAssetKey,
        x: map.width * tileSize * 0.5,
        y: map.height * tileSize * 0.5,
        width: backgroundSize.width,
        height: backgroundSize.height,
        depth: -1_000,
      });
    }
    const playerAnimationSetId = this.bundle.databases.system.playerAnimationSet;
    const playerAnimationSet = this.animationSet(playerAnimationSetId);
    const playerAction = this.playerAnimationAction();
    const playerClip = this.explicitPlayerAssetKey
      ? undefined
      : resolveBundleAnimationClip(
          this.bundle,
          playerAnimationSetId,
          playerAction,
          this.state.player.direction,
        );
    const playerAssetKey = this.explicitPlayerAssetKey
      ?? playerClip?.asset
      ?? playerAnimationSetId
      ?? 'player.adventurer';
    const playerSize = this.entityDisplaySize(
      playerAssetKey,
      tileSize,
      playerAnimationSet,
      playerClip,
    );
    const playerOrigin = this.clipOrigin(playerClip);
    sprites.push({
      id: 'player',
      assetKey: playerAssetKey,
      x: (this.state.player.x + 0.5) * tileSize,
      y: (this.state.player.y + 1) * tileSize,
      width: playerSize.width,
      height: playerSize.height,
      ...(playerClip ? { frame: this.clipFrame(playerClip) } : {}),
      originX: playerOrigin.x,
      originY: playerOrigin.y,
      depth: this.state.player.y,
    });
    for (const event of map.events) {
      const eventAnimationSet = this.animationSet(event.animationSet);
      const eventClip = resolveBundleAnimationClip(
        this.bundle,
        event.animationSet,
        'idle',
        'down',
      );
      const assetKey = eventClip?.asset ?? event.sprite ?? event.animationSet;
      if (!assetKey) continue;
      const eventSize = this.entityDisplaySize(
        assetKey,
        tileSize,
        eventAnimationSet,
        eventClip,
        event.displayHeightTiles,
      );
      const eventOrigin = this.clipOrigin(eventClip);
      sprites.push({
        id: `event:${event.id}`,
        assetKey,
        x: (event.x + 0.5) * tileSize,
        y: (event.y + 1) * tileSize,
        width: eventSize.width,
        height: eventSize.height,
        ...(eventClip ? { frame: this.clipFrame(eventClip) } : {}),
        originX: eventOrigin.x,
        originY: eventOrigin.y,
        depth: event.y,
      });
    }
    const dialogue = this.visualNovelDialogue() ?? this.state.dialogue;
    return {
      backgroundColor: this.backgroundColor,
      world: { width: map.width * tileSize, height: map.height * tileSize },
      camera: { mode: 'follow-player', followEntityId: 'player', zoom: 1 },
      sprites,
      ...(dialogue ? { dialogue: clone(dialogue) } : {}),
    };
  }

  getState(): ExplorationSimulationState {
    return clone(this.state);
  }

  /** Starts one authored VN scene without coupling it to Phaser or DOM state. */
  beginVisualNovelScene(sceneId: string, nodeId?: string): BeginVisualNovelResult {
    this.presentationCues.length = 0;
    const content = this.bundle.dialogue;
    if (!content) {
      const error = 'GameBundle does not contain visual novel content.';
      this.visualNovelError = error;
      return { ok: false, sceneId, error };
    }
    const result = startVisualNovelScene(content, sceneId, this.visualNovelVariables(), nodeId);
    if (!this.acceptVisualNovelResult(result)) {
      return { ok: false, sceneId, error: this.visualNovelError ?? 'Visual novel scene could not start.' };
    }
    this.state.dialogue = undefined;
    this.heldActions.clear();
    this.movementElapsedMs = 0;
    return { ok: true, sceneId };
  }

  /** Direct choice API for touch/accessible UIs; keyboard users use up/down + interact. */
  chooseVisualNovelChoice(choiceId: string): boolean {
    const session = this.visualNovelSession;
    const content = this.bundle.dialogue;
    if (!session || !content || session.presentation.type !== 'choice'
      || !session.presentation.choices.some(choice => choice.id === choiceId)) return false;
    return this.acceptVisualNovelResult(evaluateVisualNovelAction(
      content,
      session.state,
      { type: 'choose', choiceId },
    ));
  }

  /** Advances dialogue, confirms the selected choice, or dismisses a reached ending. */
  advanceVisualNovel(): boolean {
    const session = this.visualNovelSession;
    const content = this.bundle.dialogue;
    if (!session || !content) return false;
    if (session.presentation.type === 'ending') {
      this.closeVisualNovel();
      return true;
    }
    if (session.presentation.type === 'choice') {
      const choice = session.presentation.choices[session.selectedChoiceIndex];
      return choice ? this.chooseVisualNovelChoice(choice.id) : false;
    }
    return this.acceptVisualNovelResult(evaluateVisualNovelAction(
      content,
      session.state,
      { type: 'advance' },
    ));
  }

  closeVisualNovel(playCancelCue = false): void {
    this.visualNovelSession = undefined;
    this.visualNovelError = undefined;
    this.presentationCues.length = 0;
    if (playCancelCue) this.queueSemanticAudio('ui.cancel', 'sfx', { volume: 0.5 });
    this.presentationCues.push({ type: 'transition', style: 'cut', clearBackground: true });
    this.heldActions.clear();
    this.movementElapsedMs = 0;
  }

  getVisualNovelSession(): ExplorationVisualNovelSession | undefined {
    return this.visualNovelSession ? clone(this.visualNovelSession) : undefined;
  }

  getVisualNovelError(): string | undefined {
    return this.visualNovelError;
  }

  /** Drains one-shot view work; snapshots and saves remain renderer-neutral. */
  drainPresentationCues(): RuntimePresentationCue[] {
    const cues = clone(this.presentationCues);
    this.presentationCues.length = 0;
    return cues;
  }

  toPortableSave(): PortableSaveV2 {
    return createPortableSave(
      { currentMapId: this.state.mapId, player: this.state.player },
      {
        flags: this.state.flags,
        switches: this.state.switches,
        variables: this.state.variables,
        inventory: this.state.inventory,
        gold: this.state.gold,
        visualNovel: this.visualNovelSession ? {
          schemaVersion: 1,
          state: clone(this.visualNovelSession.state),
          selectedChoiceIndex: this.visualNovelSession.selectedChoiceIndex,
        } : undefined,
      },
    );
  }

  loadPortableSave(save: PortableSaveV2): void {
    if (!this.bundle.maps[save.currentMapId]) {
      throw new Error(`Save references unknown map "${save.currentMapId}".`);
    }
    this.state = {
      mapId: save.currentMapId,
      player: clone(save.player),
      flags: clone(save.flags),
      switches: clone(save.switches),
      variables: clone(save.variables),
      inventory: clone(save.inventory),
      gold: save.gold,
    };
    this.heldActions.clear();
    this.visualNovelSession = undefined;
    this.visualNovelError = undefined;
    this.presentationCues.length = 0;
    this.movementElapsedMs = 0;
    this.animationElapsedMs = 0;
    this.playerInteractionActive = false;
    if (save.visualNovel) {
      if (!this.bundle.dialogue) {
        this.visualNovelError = 'Save contains visual novel state, but the GameBundle has no visual novel content.';
      } else {
        const resumed = resumeVisualNovelScene(this.bundle.dialogue, save.visualNovel.state);
        this.acceptVisualNovelResult(resumed, save.visualNovel.selectedChoiceIndex, false);
      }
    }
    this.queueMapAmbience();
  }

  private currentMap(): MapData {
    const map = this.bundle.maps[this.state.mapId];
    if (!map) throw new Error(`Runtime map "${this.state.mapId}" is missing from the GameBundle.`);
    return map;
  }

  private activeMovementDirection(): Direction | undefined {
    // The last branch is deterministic and matches the common RPG input
    // priority when two keys are held simultaneously.
    if (this.heldActions.has('move.up')) return 'up';
    if (this.heldActions.has('move.down')) return 'down';
    if (this.heldActions.has('move.left')) return 'left';
    if (this.heldActions.has('move.right')) return 'right';
    return undefined;
  }

  private playerAnimationAction(): 'idle' | 'walk' | 'interact' {
    if (this.playerInteractionActive) return 'interact';
    return this.activeMovementDirection() ? 'walk' : 'idle';
  }

  private playerAnimationStateKey(): string {
    return `${this.playerAnimationAction()}.${this.state.player.direction}`;
  }

  private resetPlayerAnimationIfChanged(previousState: string, force = false): void {
    if (force || previousState !== this.playerAnimationStateKey()) {
      this.animationElapsedMs = 0;
    }
  }

  /** Starts the authored one-shot only when the selected fallback is truly an interact clip. */
  private beginPlayerInteraction(): boolean {
    if (this.explicitPlayerAssetKey) {
      this.playerInteractionActive = false;
      return false;
    }
    const clip = resolveBundleAnimationClip(
      this.bundle,
      this.bundle.databases.system.playerAnimationSet,
      'interact',
      this.state.player.direction,
    );
    if (clip?.action !== 'interact') {
      this.playerInteractionActive = false;
      return false;
    }
    this.playerInteractionActive = true;
    return true;
  }

  private advancePlayerAnimation(deltaMs: number): void {
    this.animationElapsedMs += deltaMs;
    if (!this.playerInteractionActive) return;
    const clip = resolveBundleAnimationClip(
      this.bundle,
      this.bundle.databases.system.playerAnimationSet,
      'interact',
      this.state.player.direction,
    );
    if (clip?.action !== 'interact') {
      this.playerInteractionActive = false;
      this.animationElapsedMs = 0;
      return;
    }
    const frameCount = Number.isSafeInteger(clip.frameCount) && clip.frameCount > 0
      ? clip.frameCount
      : 1;
    const fps = Number.isFinite(clip.fps) && clip.fps > 0 ? clip.fps : 1;
    if (this.animationElapsedMs >= frameCount * 1_000 / fps) {
      this.playerInteractionActive = false;
      this.animationElapsedMs = 0;
    }
  }

  private hasCatalogAsset(assetId: string): boolean {
    return this.bundle.assets?.assets.some(asset => asset.id === assetId) ?? false;
  }

  private animationSet(animationSetId: string | undefined): AnimationSetData | undefined {
    if (!animationSetId) return undefined;
    return this.bundle.databases.animations?.sets?.find(set => set.id === animationSetId);
  }

  private clipFrame(clip: AnimationClipData): number {
    const frameCount = Number.isSafeInteger(clip.frameCount) && clip.frameCount > 0
      ? clip.frameCount
      : 1;
    const fps = Number.isFinite(clip.fps) && clip.fps > 0 ? clip.fps : 1;
    const elapsedFrame = Math.floor(this.animationElapsedMs * fps / 1_000);
    return clip.loop
      ? elapsedFrame % frameCount
      : Math.min(frameCount - 1, elapsedFrame);
  }

  private clipOrigin(clip: AnimationClipData | undefined): { x: number; y: number } {
    if (!clip) return { x: 0.5, y: 1 };
    const width = Number.isFinite(clip.frameSize.width) && clip.frameSize.width > 0
      ? clip.frameSize.width
      : 1;
    const height = Number.isFinite(clip.frameSize.height) && clip.frameSize.height > 0
      ? clip.frameSize.height
      : 1;
    const anchorX = Number.isFinite(clip.anchor.x) ? clip.anchor.x : width / 2;
    const anchorY = Number.isFinite(clip.anchor.y) ? clip.anchor.y : height;
    return {
      x: Math.max(0, Math.min(1, anchorX / width)),
      y: Math.max(0, Math.min(1, anchorY / height)),
    };
  }

  private entityDisplaySize(
    assetKey: string,
    tileSize: number,
    animationSet?: AnimationSetData,
    clip?: AnimationClipData,
    explicitHeightTiles?: number,
  ): { width: number; height: number } {
    const configuredHeightTiles = explicitHeightTiles
      ?? animationSet?.display?.heightTiles
      ?? this.bundle.databases.system.defaultCharacterHeightTiles
      ?? 1;
    const heightTiles = Number.isFinite(configuredHeightTiles) && configuredHeightTiles > 0
      ? configuredHeightTiles
      : 1;
    const height = tileSize * heightTiles;
    const configuredWidthTiles = animationSet?.display?.widthTiles;
    if (configuredWidthTiles !== undefined
      && Number.isFinite(configuredWidthTiles)
      && configuredWidthTiles > 0) {
      return { width: tileSize * configuredWidthTiles, height };
    }

    const catalogAsset = this.bundle.assets?.assets.find(asset => asset.id === assetKey);
    const sourceWidth = clip?.frameSize.width ?? catalogAsset?.frameWidth ?? catalogAsset?.width;
    const sourceHeight = clip?.frameSize.height ?? catalogAsset?.frameHeight ?? catalogAsset?.height;
    const aspectRatio = sourceWidth !== undefined && sourceHeight !== undefined
      && Number.isFinite(sourceWidth) && Number.isFinite(sourceHeight)
      && sourceWidth > 0 && sourceHeight > 0
      ? sourceWidth / sourceHeight
      : 1;
    return { width: height * aspectRatio, height };
  }

  private backgroundDisplaySize(
    assetKey: string,
    worldWidth: number,
    worldHeight: number,
  ): { width: number; height: number } {
    const asset = this.bundle.assets?.assets.find(candidate => candidate.id === assetKey);
    const sourceWidth = asset?.width;
    const sourceHeight = asset?.height;
    if (sourceWidth === undefined || sourceHeight === undefined
      || !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight)
      || sourceWidth <= 0 || sourceHeight <= 0) {
      return { width: worldWidth, height: worldHeight };
    }
    const sourceRatio = sourceWidth / sourceHeight;
    const worldRatio = worldWidth / worldHeight;
    return sourceRatio >= worldRatio
      ? { width: worldHeight * sourceRatio, height: worldHeight }
      : { width: worldWidth, height: worldWidth / sourceRatio };
  }

  private handleVisualNovelInput(action: RuntimeInputAction): void {
    const session = this.visualNovelSession;
    if (!session) return;
    if (action === 'cancel') {
      this.closeVisualNovel(true);
      return;
    }
    if (session.presentation.type === 'choice') {
      const count = session.presentation.choices.length;
      if (count === 0) return;
      if (action === 'move.up' || action === 'move.left') {
        session.selectedChoiceIndex = (session.selectedChoiceIndex - 1 + count) % count;
      } else if (action === 'move.down' || action === 'move.right') {
        session.selectedChoiceIndex = (session.selectedChoiceIndex + 1) % count;
      } else if (action === 'interact') {
        this.advanceVisualNovel();
      }
      return;
    }
    if (action === 'interact') this.advanceVisualNovel();
  }

  private acceptVisualNovelResult(
    result: VisualNovelEvaluationResult,
    selectedChoiceIndex = 0,
    enqueueCues = true,
  ): boolean {
    if (!result.ok) {
      this.visualNovelError = result.error;
      return false;
    }
    this.visualNovelError = undefined;
    this.syncVisualNovelVariables(result.state.variables);
    if (enqueueCues) this.enqueueVisualNovelCues(result.cues);
    const choiceCount = result.presentation.type === 'choice'
      ? result.presentation.choices.length
      : 0;
    this.visualNovelSession = {
      state: clone(result.state),
      presentation: clone(result.presentation),
      selectedChoiceIndex: choiceCount > 0
        ? Math.max(0, Math.min(choiceCount - 1, Math.trunc(selectedChoiceIndex)))
        : 0,
    };
    return true;
  }

  private enqueueVisualNovelCues(cues: readonly VisualNovelRuntimeCue[]): void {
    for (const cue of cues) {
      if (cue.type === 'audio') {
        this.presentationCues.push({
          type: 'audio',
          channel: cue.node.channel,
          action: cue.node.action,
          ...(cue.node.assetId ? { assetId: cue.node.assetId } : {}),
          ...(cue.node.volume !== undefined ? { volume: cue.node.volume } : {}),
          ...(cue.node.loop !== undefined ? { loop: cue.node.loop } : {}),
          ...(cue.node.fadeMs !== undefined ? { fadeMs: cue.node.fadeMs } : {}),
        });
      } else if (cue.type === 'transition') {
        this.presentationCues.push({
          type: 'transition',
          style: cue.node.style,
          ...(cue.node.durationMs !== undefined ? { durationMs: cue.node.durationMs } : {}),
          ...(cue.node.backgroundAssetId ? { backgroundAssetId: cue.node.backgroundAssetId } : {}),
        });
      }
    }
  }

  private visualNovelVariables(): VisualNovelVariables {
    const variables: VisualNovelVariables = {};
    for (const [id, value] of Object.entries(this.state.variables)) {
      variables[id] = value;
      variables[`variables.${id}`] = value;
    }
    for (const [id, value] of Object.entries(this.state.flags)) {
      variables[`flags.${id}`] = value;
    }
    for (const [id, value] of Object.entries(this.state.switches)) {
      variables[id] = value;
      variables[`switches.${id}`] = value;
    }
    return variables;
  }

  private syncVisualNovelVariables(variables: VisualNovelVariables): void {
    const variableIds = new Set(this.bundle.databases.variables.map(variable => variable.id));
    const switchIds = new Set(this.bundle.databases.switches.map(entry => entry.id));
    for (const [path, value] of Object.entries(variables)) {
      if (path.startsWith('variables.') && typeof value === 'number' && Number.isFinite(value)) {
        this.state.variables[path.slice('variables.'.length)] = value;
      } else if (path.startsWith('flags.') && typeof value === 'boolean') {
        this.state.flags[path.slice('flags.'.length)] = value;
      } else if (path.startsWith('switches.') && typeof value === 'boolean') {
        this.state.switches[path.slice('switches.'.length)] = value;
      } else if (variableIds.has(path) && typeof value === 'number' && Number.isFinite(value)) {
        this.state.variables[path] = value;
      } else if (switchIds.has(path) && typeof value === 'boolean') {
        this.state.switches[path] = value;
      }
    }
  }

  private visualNovelDialogue(): ExplorationDialogue | undefined {
    const session = this.visualNovelSession;
    if (!session) return undefined;
    const presentation = session.presentation;
    if (presentation.type === 'dialogue') {
      const portraitAssetId = presentation.node.portrait?.assetId;
      return {
        eventId: `vn:${session.state.sceneId}:${presentation.node.id}`,
        kind: 'dialogue',
        speaker: presentation.node.speaker,
        text: presentation.node.text,
        ...(portraitAssetId && this.hasCatalogAsset(portraitAssetId) ? { portraitAssetId } : {}),
      };
    }
    if (presentation.type === 'choice') {
      return {
        eventId: `vn:${session.state.sceneId}:${session.state.currentNodeId}`,
        kind: 'choice',
        text: presentation.prompt ?? 'Elegí una opción.',
        choices: presentation.choices.map((choice, index) => ({
          ...choice,
          selected: index === session.selectedChoiceIndex,
        })),
      };
    }
    return {
      eventId: `vn:${session.state.sceneId}:${presentation.node.id}`,
      kind: 'ending',
      speaker: presentation.node.title ?? 'Final',
      text: presentation.node.title ?? presentation.node.endingId,
      endingId: presentation.node.endingId,
    };
  }

  private move(direction: Direction): void {
    const delta = DIRECTION_DELTAS[direction];
    this.state.player.direction = direction;
    const nextX = this.state.player.x + delta.x;
    const nextY = this.state.player.y + delta.y;
    if (isBlocked(this.currentMap(), nextX, nextY)) return;
    this.state.player.x = nextX;
    this.state.player.y = nextY;
    this.queueSemanticAudio('footstep.concrete', 'sfx', { volume: 0.32 });
  }

  private interact(): void {
    const map = this.currentMap();
    const delta = DIRECTION_DELTAS[this.state.player.direction];
    const target = eventAt(map, this.state.player.x + delta.x, this.state.player.y + delta.y);
    if (!target) return;
    this.executeCommands(target, target.commands);
  }

  private executeCommands(event: GameEvent, commands: readonly EventCommand[]): void {
    for (const command of commands) {
      switch (command.type) {
        case 'showText': {
          const portraitAssetId = this.dialoguePortrait(event, command.speaker);
          this.state.dialogue = {
            eventId: event.id,
            speaker: command.speaker,
            text: command.text,
            ...(portraitAssetId ? { portraitAssetId } : {}),
          };
          break;
        }
        case 'setFlag':
          this.state.flags[command.flag] = command.value;
          break;
        case 'controlSwitch':
          this.state.switches[command.switchId] = command.value;
          break;
        case 'controlVariable': {
          const current = this.state.variables[command.variableId] ?? 0;
          const source = command.sourceVariableId
            ? this.state.variables[command.sourceVariableId] ?? 0
            : command.value;
          const value = command.sourceVariableId ? source : command.value;
          switch (command.op) {
            case 'set': this.state.variables[command.variableId] = value; break;
            case 'add': this.state.variables[command.variableId] = current + value; break;
            case 'sub': this.state.variables[command.variableId] = current - value; break;
            case 'mul': this.state.variables[command.variableId] = current * value; break;
            case 'div': this.state.variables[command.variableId] = value === 0 ? current : current / value; break;
            case 'mod': this.state.variables[command.variableId] = value === 0 ? current : current % value; break;
          }
          break;
        }
        case 'addItem':
          this.state.inventory[command.itemId] = (this.state.inventory[command.itemId] ?? 0) + command.amount;
          break;
        case 'removeItem':
          this.state.inventory[command.itemId] = Math.max(0, (this.state.inventory[command.itemId] ?? 0) - command.amount);
          break;
        case 'addGold':
          this.state.gold += command.amount;
          break;
        case 'removeGold':
          this.state.gold = Math.max(0, this.state.gold - command.amount);
          break;
        case 'transferMap': {
          const map = this.bundle.maps[command.mapId];
          if (!map) break;
          const spawn = findNearestTraversableMapTile(map, { x: command.x, y: command.y });
          if (!spawn) break;
          this.state.mapId = command.mapId;
          this.state.player = { ...spawn, direction: command.direction };
          this.state.dialogue = undefined;
          this.playerInteractionActive = false;
          this.animationElapsedMs = 0;
          this.queueMapAmbience();
          break;
        }
        case 'pluginCommand': {
          if (command.pluginId !== 'vn' || command.command !== 'start') break;
          const sceneId = typeof command.args.sceneId === 'string'
            ? command.args.sceneId.trim()
            : '';
          const authoredNodeId = typeof command.args.nodeId === 'string'
            ? command.args.nodeId.trim()
            : '';
          this.beginVisualNovelScene(sceneId, authoredNodeId || undefined);
          // A VN scene is modal. Commands authored after vn.start must wait for
          // a later event instead of silently mutating exploration underneath it.
          return;
        }
        default:
          // Commands that need a scene, audio bus, or a native adapter remain
          // valid data but are intentionally no-ops in this first simulation.
          break;
      }
    }
  }

  private dialoguePortrait(event: GameEvent, speaker: string | undefined): string | undefined {
    const speakerKey = speaker?.trim().toLocaleLowerCase('es');
    const actorPortrait = speakerKey
      ? this.bundle.databases.actors.find(actor => {
          const actorId = actor.id.toLocaleLowerCase('es');
          const actorName = actor.name.trim().toLocaleLowerCase('es');
          const firstName = actorName.split(/\s+/)[0];
          return actorId === speakerKey || actorName === speakerKey || firstName === speakerKey;
        })?.portraitAssetId
      : undefined;
    const assetId = event.portraitAssetId ?? actorPortrait;
    return assetId && this.hasCatalogAsset(assetId) ? assetId : undefined;
  }

  private queueMapAmbience(): void {
    this.queueSemanticAudio(`map.${this.state.mapId}`, 'ambient', { loop: true, volume: 0.48 });
  }

  /**
   * Semantic cue mappings are asset ids, not the legacy path-based audio
   * registry. This keeps every renderer on the preloaded Asset Catalog key.
   */
  private queueSemanticAudio(
    semanticId: string,
    channel: Extract<RuntimePresentationCue, { type: 'audio' }>['channel'],
    options: { loop?: boolean; volume?: number } = {},
  ): void {
    const assetId = this.bundle.databases.system.audioAssetIds?.[semanticId];
    if (!assetId || !this.hasCatalogAsset(assetId)) return;
    this.presentationCues.push({
      type: 'audio',
      channel,
      action: 'play',
      assetId,
      ...(options.loop !== undefined ? { loop: options.loop } : {}),
      ...(options.volume !== undefined ? { volume: options.volume } : {}),
    });
  }
}
