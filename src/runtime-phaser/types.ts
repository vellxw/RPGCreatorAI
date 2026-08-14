import type { RuntimeInputAction, RuntimePresentationCue } from '../runtime-core';

export type PhaserRendererPreference = 'auto' | 'webgl' | 'canvas';

export interface RuntimeAssetManifestEntry {
  runtimeKey: string;
  kind: 'image' | 'spritesheet' | 'tileset' | 'audio' | 'generated';
  sourcePath?: string;
  runtimePath: string;
  width?: number;
  height?: number;
  frameWidth?: number;
  frameHeight?: number;
  frames?: number;
  durationMs?: number;
}

export interface RuntimeAssetManifest {
  schemaVersion: number;
  assets: RuntimeAssetManifestEntry[];
}

export interface RenderSpriteSnapshot {
  id: string;
  assetKey: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  frame?: number;
  originX?: number;
  originY?: number;
  depth?: number;
  visible?: boolean;
  flipX?: boolean;
  alpha?: number;
}

export interface RuntimeRenderSnapshot {
  backgroundColor?: string;
  world: { width: number; height: number };
  camera?: {
    mode: 'fixed-room' | 'follow-player';
    followEntityId?: string;
    zoom?: number;
  };
  sprites: readonly RenderSpriteSnapshot[];
  dialogue?: {
    eventId: string;
    speaker?: string;
    text: string;
    portraitAssetId?: string;
    kind?: 'dialogue' | 'choice' | 'ending';
    choices?: Array<{ id: string; text: string; selected: boolean }>;
    endingId?: string;
  };
}

/** The simulation remains the sole owner of rules and saveable state. */
export interface SimulationPort {
  advance(deltaMs: number): void;
  getRenderSnapshot(): RuntimeRenderSnapshot;
  handleInput(action: RuntimeInputAction, phase: 'pressed' | 'released', timestampMs: number): void;
  /** Optional one-shot presentation work; renderer snapshots stay idempotent. */
  drainPresentationCues?(): readonly RuntimePresentationCue[];
}

export interface PhaserRuntimeOptions {
  parent: string | HTMLElement;
  width: number;
  height: number;
  simulation: SimulationPort;
  assetManifest: RuntimeAssetManifest | unknown;
  /**
   * Same-origin base used to resolve project-relative catalog paths. `./`
   * keeps assets beside the current document, including Android appassets.
   */
  assetBaseUrl?: string;
  renderer?: PhaserRendererPreference;
  maxFrameDeltaMs?: number;
  backgroundColor?: string;
  /** Receives immutable renderer snapshots for DOM dialogue/HUD surfaces. */
  onSnapshot?: (snapshot: RuntimeRenderSnapshot) => void;
  phaser?: PhaserNamespace;
}

export interface PhaserGame {
  destroy(removeCanvas?: boolean, noReturn?: boolean): void;
  scale?: {
    resize(width: number, height: number): void;
    refresh?(): void;
  };
}

export interface PhaserDisplayObject {
  setPosition(x: number, y: number): this;
  setDisplaySize?(width: number, height: number): this;
  setDepth(depth: number): this;
  setVisible(visible: boolean): this;
  setFlipX?(flipX: boolean): this;
  setAlpha(alpha: number): this;
  setOrigin?(x: number, y: number): this;
  setScrollFactor?(x: number, y?: number): this;
  setFrame?(frame: number): this;
  destroy(): void;
}

export interface PhaserSceneLike {
  load: {
    image(key: string, url: string): void;
    spritesheet(key: string, url: string, config: { frameWidth: number; frameHeight: number }): void;
    audio(key: string, urls: string | string[]): void;
  };
  scene: { start(key: string): void };
  add: {
    image(x: number, y: number, texture: string, frame?: number): PhaserDisplayObject;
    rectangle(x: number, y: number, width: number, height: number, color: number): PhaserDisplayObject;
  };
  textures?: { exists(key: string): boolean };
  cache?: { audio?: { exists(key: string): boolean } };
  sound?: {
    add(key: string, config?: { volume?: number; loop?: boolean }): PhaserSoundLike;
  };
  tweens?: {
    add(config: {
      targets: PhaserSoundLike;
      volume: number;
      duration: number;
      onComplete?: () => void;
    }): unknown;
  };
  cameras: {
    main: {
      setBackgroundColor(color: string): void;
      setBounds(x: number, y: number, width: number, height: number): void;
      setZoom(zoom: number): void;
      startFollow(target: PhaserDisplayObject, roundPixels?: boolean): void;
      stopFollow(): void;
      width?: number;
      height?: number;
      fadeIn?(duration?: number, red?: number, green?: number, blue?: number): void;
      flash?(duration?: number, red?: number, green?: number, blue?: number): void;
    };
  };
  input: {
    keyboard?: {
      on(event: string, callback: (event: KeyboardEvent) => void): void;
      off(event: string, callback: (event: KeyboardEvent) => void): void;
    };
  };
  events: { once(event: string, callback: () => void): void };
}

export interface PhaserSoundLike {
  volume?: number;
  play(config?: { volume?: number; loop?: boolean }): boolean | void;
  stop(): void;
  setVolume?(volume: number): this;
  destroy?(): void;
}

export interface PhaserNamespace {
  AUTO: number;
  CANVAS: number;
  WEBGL: number;
  Scene: new (config: string | { key: string }) => PhaserSceneLike;
  Game: new (config: Record<string, unknown>) => PhaserGame;
  Scale?: { FIT?: number; CENTER_BOTH?: number };
}
