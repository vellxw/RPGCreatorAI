import type { RuntimeInputAction, RuntimePresentationCue } from '../runtime-core';
import type { RuntimeRenderSnapshot, SimulationPort } from './types';

/** Single renderer/simulation boundary used by Phaser scenes. */
export class PhaserRendererBridge {
  constructor(
    private readonly simulation: SimulationPort,
    private readonly maxFrameDeltaMs = 250,
  ) {}

  advance(deltaMs: number): RuntimeRenderSnapshot {
    const boundedDelta = Math.max(0, Math.min(deltaMs, this.maxFrameDeltaMs));
    this.simulation.advance(boundedDelta);
    return this.simulation.getRenderSnapshot();
  }

  snapshot(): RuntimeRenderSnapshot {
    return this.simulation.getRenderSnapshot();
  }

  input(action: RuntimeInputAction, phase: 'pressed' | 'released', timestampMs: number): void {
    this.simulation.handleInput(action, phase, timestampMs);
  }

  drainPresentationCues(): readonly RuntimePresentationCue[] {
    return this.simulation.drainPresentationCues?.() ?? [];
  }
}
