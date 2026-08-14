export type RuntimeInputAction =
  | 'move.up'
  | 'move.down'
  | 'move.left'
  | 'move.right'
  | 'interact'
  | 'cancel'
  | 'menu'
  | 'dash'
  | 'pause';

/** Maps host-specific input ids (for example `keyboard:ArrowUp`) to actions. */
export type InputBindingMap<Action extends string = RuntimeInputAction> = Readonly<
  Record<string, readonly Action[]>
>;

export interface SemanticInputEvent<Action extends string = RuntimeInputAction> {
  sequence: number;
  action: Action;
  phase: 'pressed' | 'released';
  timestampMs: number;
  sourceId: string;
}

/**
 * Converts physical/host input into semantic actions. It has no DOM, SDL,
 * renderer, or clock dependency; the host supplies source ids and timestamps.
 */
export class InputRouter<Action extends string = RuntimeInputAction> {
  private bindings: InputBindingMap<Action>;
  private readonly activeSources = new Set<string>();
  private readonly sourcesByAction = new Map<Action, Set<string>>();
  private events: SemanticInputEvent<Action>[] = [];
  private sequence = 0;

  constructor(bindings: InputBindingMap<Action> = {}) {
    this.bindings = bindings;
  }

  setBindings(bindings: InputBindingMap<Action>, timestampMs: number): void {
    this.reset(timestampMs);
    this.bindings = bindings;
  }

  press(sourceId: string, timestampMs: number): readonly SemanticInputEvent<Action>[] {
    if (this.activeSources.has(sourceId)) return [];
    this.activeSources.add(sourceId);

    const emitted: SemanticInputEvent<Action>[] = [];
    for (const action of this.bindings[sourceId] ?? []) {
      let sources = this.sourcesByAction.get(action);
      if (!sources) {
        sources = new Set<string>();
        this.sourcesByAction.set(action, sources);
      }
      const wasPressed = sources.size > 0;
      sources.add(sourceId);
      if (!wasPressed) emitted.push(this.emit(action, 'pressed', timestampMs, sourceId));
    }
    return emitted;
  }

  release(sourceId: string, timestampMs: number): readonly SemanticInputEvent<Action>[] {
    if (!this.activeSources.delete(sourceId)) return [];

    const emitted: SemanticInputEvent<Action>[] = [];
    for (const action of this.bindings[sourceId] ?? []) {
      const sources = this.sourcesByAction.get(action);
      if (!sources) continue;
      sources.delete(sourceId);
      if (sources.size === 0) {
        this.sourcesByAction.delete(action);
        emitted.push(this.emit(action, 'released', timestampMs, sourceId));
      }
    }
    return emitted;
  }

  isPressed(action: Action): boolean {
    return (this.sourcesByAction.get(action)?.size ?? 0) > 0;
  }

  getPressedActions(): readonly Action[] {
    return [...this.sourcesByAction.keys()];
  }

  drainEvents(): readonly SemanticInputEvent<Action>[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  reset(timestampMs: number): readonly SemanticInputEvent<Action>[] {
    const emitted: SemanticInputEvent<Action>[] = [];
    for (const [action, sources] of this.sourcesByAction) {
      const sourceId = sources.values().next().value ?? 'router:reset';
      emitted.push(this.emit(action, 'released', timestampMs, sourceId));
    }
    this.activeSources.clear();
    this.sourcesByAction.clear();
    return emitted;
  }

  private emit(
    action: Action,
    phase: SemanticInputEvent<Action>['phase'],
    timestampMs: number,
    sourceId: string,
  ): SemanticInputEvent<Action> {
    const event = { sequence: ++this.sequence, action, phase, timestampMs, sourceId };
    this.events.push(event);
    return event;
  }
}

