import {
  createRuntimeConfig,
  ExplorationSimulation,
  parsePortableSave,
  serializePortableSave,
  type GameBundleV1,
  type RuntimeInputAction,
} from '../../runtime-core';
import { mountPhaserRuntime, type PhaserRuntimeHost, type SimulationPort } from '../../runtime-phaser';
import { AndroidLifecycleController, type AndroidLifecycleEffect, type AndroidLifecycleSignal } from './lifecycle';
import { ANDROID_APP_ASSET_PREFIX } from './offlineWrapper';
import { AndroidSaveBridgeCoordinator, type AndroidSaveCommand } from './saveBridge';
import { AndroidTouchController, DEFAULT_ANDROID_TOUCH_BINDINGS } from './touch';

export const ANDROID_GAME_BUNDLE_URL = `${ANDROID_APP_ASSET_PREFIX}data/game-bundle.v1.json` as const;
/**
 * GameBundle asset paths stay project-relative across editor, Windows and web.
 * Only the Android host adds its synthetic HTTPS mount prefix at render time.
 */
export const ANDROID_RUNTIME_ASSET_BASE_URL = ANDROID_APP_ASSET_PREFIX;
export const ANDROID_LIFECYCLE_EVENT = 'rpgcreator:android-lifecycle' as const;

interface AndroidNativeBridge {
  /** Synchronous, bounded JSON request/response bridge implemented by the native shell. */
  transact(requestJson: string): string;
}

declare global {
  interface Window {
    RPGCreatorAndroid?: AndroidNativeBridge;
  }
}

export interface AndroidGameBundleHostOptions {
  container: HTMLElement;
  controlsRoot?: ParentNode;
  bundleUrl?: string;
  fetcher?: typeof fetch;
  renderer?: 'auto' | 'webgl' | 'canvas';
  saveSlotId?: string;
}

export interface AndroidGameBundleHost {
  bundle: GameBundleV1;
  simulation: ExplorationSimulation;
  phaser: PhaserRuntimeHost;
  saveNow(): void;
  destroy(): void;
}

class SuspendableSimulation implements SimulationPort {
  suspended = false;
  constructor(readonly simulation: ExplorationSimulation) {}
  advance(deltaMs: number): void { if (!this.suspended) this.simulation.advance(deltaMs); }
  getRenderSnapshot() { return this.simulation.getRenderSnapshot(); }
  handleInput(action: RuntimeInputAction, phase: 'pressed' | 'released', timestampMs: number): void {
    if (!this.suspended || phase === 'released') this.simulation.handleInput(action, phase, timestampMs);
  }
  drainPresentationCues() { return this.simulation.drainPresentationCues(); }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAndroidGameBundle(value: unknown): GameBundleV1 {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('Android requires GameBundle schemaVersion 1.');
  const project = value.project;
  const maps = value.maps;
  if (!isRecord(project)) throw new Error('GameBundle.project must be an object.');
  if (!isRecord(maps)) throw new Error('GameBundle.maps must be an object.');
  if (!isRecord(value.items)) throw new Error('GameBundle.items must be an object.');
  if (!isRecord(value.databases)) throw new Error('GameBundle.databases must be an object.');
  const startMapId = project.startMapId;
  if (typeof startMapId !== 'string' || !startMapId || !(startMapId in maps)) {
    throw new Error('GameBundle start map is missing.');
  }
  return value as unknown as GameBundleV1;
}

export async function loadAndroidGameBundle(
  url: string = ANDROID_GAME_BUNDLE_URL,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<GameBundleV1> {
  if (typeof fetcher !== 'function') throw new Error('GameBundle loading requires fetch.');
  if (url !== ANDROID_GAME_BUNDLE_URL) {
    throw new Error(`Android GameBundle URL must be the packaged offline path ${ANDROID_GAME_BUNDLE_URL}.`);
  }
  const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw new Error(`GameBundle load failed with HTTP ${response.status}.`);
  return parseAndroidGameBundle(await response.json());
}

class SavePort {
  private readonly coordinator = new AndroidSaveBridgeCoordinator(`android-${Date.now()}`);
  private readonly fallbackKey: string;
  constructor(private readonly slotId: string) { this.fallbackKey = `rpgcreator.android.${slotId}`; }

  load() {
    const bridge = window.RPGCreatorAndroid;
    if (!bridge) {
      const raw = window.localStorage.getItem(this.fallbackKey);
      return raw ? parsePortableSave(raw) : undefined;
    }
    const result = this.transact({ operation: 'mirror.read', slotId: this.slotId });
    return result.save;
  }

  write(save: ReturnType<ExplorationSimulation['toPortableSave']>): void {
    const bridge = window.RPGCreatorAndroid;
    if (!bridge) {
      window.localStorage.setItem(this.fallbackKey, serializePortableSave(save));
      return;
    }
    const result = this.transact({ operation: 'mirror.write', slotId: this.slotId, save });
    if (result.response.status !== 'ok') throw new Error(result.response.message ?? 'Native save failed.');
  }

  private transact(command: AndroidSaveCommand) {
    const bridge = window.RPGCreatorAndroid;
    if (!bridge) throw new Error('Android native bridge is unavailable.');
    // Save bridge timestamps are portable JSON sequence markers and therefore
    // must be integers. `performance.now()` is normally fractional in WebView.
    const request = this.coordinator.begin(command, Math.floor(performance.now()));
    try {
      return this.coordinator.complete(JSON.parse(bridge.transact(JSON.stringify(request))));
    } catch (error) {
      this.coordinator.abandon();
      throw error;
    }
  }
}

function forwardTouch(
  controller: AndroidTouchController<RuntimeInputAction>,
  simulation: SuspendableSimulation,
  element: HTMLElement,
  event: PointerEvent,
): void {
  const phase = event.type === 'pointerdown' ? 'down'
    : event.type === 'pointermove' ? 'move'
      : event.type === 'pointercancel' ? 'cancel' : 'up';
  const hit = element.ownerDocument.elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-android-control]');
  const result = controller.handle({
    pointerId: event.pointerId,
    phase,
    controlId: phase === 'move' ? hit?.dataset.androidControl : element.dataset.androidControl,
    timestampMs: event.timeStamp,
  });
  if (result.preventDefault) event.preventDefault();
  if (result.capturePointer && !element.hasPointerCapture(event.pointerId)) element.setPointerCapture(event.pointerId);
  if (result.releasePointerCapture && element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  result.events.forEach(input => simulation.handleInput(input.action, input.phase, input.timestampMs));
}

function bindTouch(root: ParentNode, simulation: SuspendableSimulation) {
  const controller = new AndroidTouchController<RuntimeInputAction>(DEFAULT_ANDROID_TOUCH_BINDINGS);
  const dispose: Array<() => void> = [];
  root.querySelectorAll<HTMLElement>('[data-android-control]').forEach(element => {
    const listener = (event: PointerEvent) => forwardTouch(controller, simulation, element, event);
    (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const).forEach(type => {
      element.addEventListener(type, listener);
      dispose.push(() => element.removeEventListener(type, listener));
    });
  });
  return { controller, dispose: () => dispose.forEach(remove => remove()) };
}

function parseLifecycle(value: unknown): AndroidLifecycleSignal | undefined {
  if (!isRecord(value) || typeof value.timestampMs !== 'number' || !Number.isFinite(value.timestampMs)) return undefined;
  if (value.type === 'resume') return { type: 'resume', timestampMs: value.timestampMs };
  if (value.type === 'pause' || value.type === 'stop') return { type: value.type, timestampMs: value.timestampMs };
  if (value.type === 'destroy') return { type: 'destroy', timestampMs: value.timestampMs };
  if (value.type === 'trim-memory' &&
      (value.level === 'ui-hidden' || value.level === 'running-low' || value.level === 'running-critical' || value.level === 'complete')) {
    return { type: 'trim-memory', timestampMs: value.timestampMs, level: value.level };
  }
  return undefined;
}

export async function mountAndroidGameBundleHost(options: AndroidGameBundleHostOptions): Promise<AndroidGameBundleHost> {
  const bundle = await loadAndroidGameBundle(options.bundleUrl, options.fetcher);
  const simulation = new ExplorationSimulation({
    bundle,
    config: createRuntimeConfig({ save: { maxSlots: 3, autosaveEnabled: true } }),
  });
  const saves = new SavePort(options.saveSlotId ?? 'autosave');
  try { const save = saves.load(); if (save) simulation.loadPortableSave(save); }
  catch (error) { console.warn('Android save restore skipped.', error); }

  const suspendable = new SuspendableSimulation(simulation);
  const phaser = await mountPhaserRuntime({
    container: options.container,
    bundle,
    simulation: suspendable,
    renderer: options.renderer,
    autoResize: true,
    assetBaseUrl: ANDROID_RUNTIME_ASSET_BASE_URL,
  });
  const touch = bindTouch(options.controlsRoot ?? document, suspendable);
  const lifecycle = new AndroidLifecycleController();
  let destroyed = false;
  const saveNow = (): void => saves.write(simulation.toPortableSave());

  const applyEffect = (effect: AndroidLifecycleEffect): void => {
    if (effect.type === 'input.release-all') {
      touch.controller.releaseAll(effect.timestampMs)
        .forEach(input => suspendable.handleInput(input.action, input.phase, input.timestampMs));
    } else if (effect.type === 'save.flush') {
      try { saveNow(); } catch (error) { console.warn('Android save flush failed.', error); }
    } else if (effect.type === 'runtime.suspend') suspendable.suspended = true;
    else if (effect.type === 'runtime.resume') suspendable.suspended = false;
    else if (effect.type === 'runtime.destroy') destroy();
  };
  const onLifecycle = (event: Event): void => {
    const signal = parseLifecycle((event as CustomEvent<unknown>).detail);
    if (signal) lifecycle.dispatch(signal).effects.forEach(applyEffect);
  };
  window.addEventListener(ANDROID_LIFECYCLE_EVENT, onLifecycle);
  lifecycle.dispatch({ type: 'resume', timestampMs: performance.now() }).effects.forEach(applyEffect);

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener(ANDROID_LIFECYCLE_EVENT, onLifecycle);
    touch.controller.releaseAll(performance.now())
      .forEach(input => suspendable.handleInput(input.action, input.phase, input.timestampMs));
    touch.dispose();
    phaser.destroy();
  }

  return { bundle, simulation, phaser, saveNow, destroy };
}
