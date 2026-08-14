import {
  InputRouter,
  type InputBindingMap,
  type RuntimeInputAction,
  type SemanticInputEvent,
} from '../../runtime-core/inputRouter';

export type AndroidTouchPhase = 'down' | 'move' | 'up' | 'cancel';

export interface AndroidTouchContact {
  pointerId: number;
  phase: AndroidTouchPhase;
  /** Omit when a move leaves every virtual control. */
  controlId?: string;
  timestampMs: number;
}

export interface AndroidTouchDispatch<Action extends string = RuntimeInputAction> {
  handled: boolean;
  preventDefault: boolean;
  capturePointer: boolean;
  releasePointerCapture: boolean;
  events: readonly SemanticInputEvent<Action>[];
}

export type AndroidTouchBindings<Action extends string = RuntimeInputAction> = Readonly<
  Record<string, readonly Action[]>
>;

export const DEFAULT_ANDROID_TOUCH_BINDINGS: AndroidTouchBindings = {
  'dpad-up': ['move.up'],
  'dpad-down': ['move.down'],
  'dpad-left': ['move.left'],
  'dpad-right': ['move.right'],
  primary: ['interact'],
  secondary: ['cancel'],
  menu: ['menu'],
  dash: ['dash'],
};

/**
 * Converts pointer contacts into the same semantic events used by keyboard
 * and gamepad input. Multiple fingers may hold one control without producing
 * duplicate presses, and every cancellation path has a deterministic release.
 */
export class AndroidTouchController<Action extends string = RuntimeInputAction> {
  private readonly router: InputRouter<Action>;
  private readonly bindings: AndroidTouchBindings<Action>;
  private readonly controlByPointer = new Map<number, string>();
  private readonly pointersByControl = new Map<string, Set<number>>();

  constructor(bindings: AndroidTouchBindings<Action>) {
    this.bindings = bindings;
    this.router = new InputRouter<Action>(toInputBindings(bindings));
  }

  handle(contact: AndroidTouchContact): AndroidTouchDispatch<Action> {
    assertContact(contact);

    switch (contact.phase) {
      case 'down':
        return this.onDown(contact);
      case 'move':
        return this.onMove(contact);
      case 'up':
      case 'cancel':
        return this.onEnd(contact);
    }
  }

  releaseAll(timestampMs: number): readonly SemanticInputEvent<Action>[] {
    assertTimestamp(timestampMs);
    this.controlByPointer.clear();
    this.pointersByControl.clear();
    this.router.reset(timestampMs);
    return this.router.drainEvents();
  }

  getActivePointerCount(): number {
    return this.controlByPointer.size;
  }

  private onDown(contact: AndroidTouchContact): AndroidTouchDispatch<Action> {
    const controlId = normalizeControl(contact.controlId);
    if (!controlId || !this.bindings[controlId] || this.controlByPointer.has(contact.pointerId)) {
      return dispatch(false, false, false, this.router.drainEvents());
    }

    this.attach(contact.pointerId, controlId, contact.timestampMs);
    return dispatch(true, true, false, this.router.drainEvents());
  }

  private onMove(contact: AndroidTouchContact): AndroidTouchDispatch<Action> {
    const previous = this.controlByPointer.get(contact.pointerId);
    if (!previous) return dispatch(false, false, false, this.router.drainEvents());

    const candidate = normalizeControl(contact.controlId);
    const next = candidate && this.bindings[candidate] ? candidate : undefined;
    if (next === previous) return dispatch(true, false, false, this.router.drainEvents());

    // Attach before detaching so two controls bound to the same action do not
    // emit a spurious release/press pair while a finger slides between them.
    if (next) this.attach(contact.pointerId, next, contact.timestampMs);
    this.detach(contact.pointerId, previous, contact.timestampMs, next);

    return dispatch(true, false, !next, this.router.drainEvents());
  }

  private onEnd(contact: AndroidTouchContact): AndroidTouchDispatch<Action> {
    const controlId = this.controlByPointer.get(contact.pointerId);
    if (!controlId) return dispatch(false, false, false, this.router.drainEvents());

    this.detach(contact.pointerId, controlId, contact.timestampMs);
    return dispatch(true, false, true, this.router.drainEvents());
  }

  private attach(pointerId: number, controlId: string, timestampMs: number): void {
    const previous = this.controlByPointer.get(pointerId);
    if (previous === controlId) return;

    let pointers = this.pointersByControl.get(controlId);
    if (!pointers) {
      pointers = new Set<number>();
      this.pointersByControl.set(controlId, pointers);
    }
    const firstPointer = pointers.size === 0;
    pointers.add(pointerId);
    this.controlByPointer.set(pointerId, controlId);
    if (firstPointer) this.router.press(sourceId(controlId), timestampMs);
  }

  private detach(
    pointerId: number,
    controlId: string,
    timestampMs: number,
    replacement?: string,
  ): void {
    const pointers = this.pointersByControl.get(controlId);
    pointers?.delete(pointerId);
    if (pointers?.size === 0) {
      this.pointersByControl.delete(controlId);
      this.router.release(sourceId(controlId), timestampMs);
    }

    if (replacement) this.controlByPointer.set(pointerId, replacement);
    else this.controlByPointer.delete(pointerId);
  }
}

function dispatch<Action extends string>(
  handled: boolean,
  capturePointer: boolean,
  releasePointerCapture: boolean,
  events: readonly SemanticInputEvent<Action>[],
): AndroidTouchDispatch<Action> {
  return {
    handled,
    preventDefault: handled,
    capturePointer,
    releasePointerCapture,
    events,
  };
}

function toInputBindings<Action extends string>(
  bindings: AndroidTouchBindings<Action>,
): InputBindingMap<Action> {
  return Object.fromEntries(
    Object.entries(bindings).map(([controlId, actions]) => [sourceId(controlId), actions]),
  );
}

function sourceId(controlId: string): string {
  return `touch:${controlId}`;
}

function normalizeControl(controlId: string | undefined): string | undefined {
  const normalized = controlId?.trim();
  return normalized || undefined;
}

function assertContact(contact: AndroidTouchContact): void {
  if (!Number.isSafeInteger(contact.pointerId) || contact.pointerId < 0) {
    throw new Error('Android touch pointerId must be a non-negative safe integer.');
  }
  assertTimestamp(contact.timestampMs);
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error('Android touch timestampMs must be a non-negative finite number.');
  }
}
