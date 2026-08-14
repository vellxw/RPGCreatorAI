/**
 * Canonical, renderer-neutral IR emitted by the visual event editor.
 *
 * The IR is data only. It deliberately has no script/eval escape hatch, which
 * makes it safe to validate, diff and compile before a project reaches the
 * runtime.
 */
export type EventScalar = string | number | boolean | null;

export type StateComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export type EventCondition =
  | {
      kind: 'state.compare';
      path: string;
      operator: StateComparisonOperator;
      value: EventScalar;
    }
  | { kind: 'all'; conditions: EventCondition[] }
  | { kind: 'any'; conditions: EventCondition[] }
  | { kind: 'not'; condition: EventCondition };

export interface StateSetEventCommand {
  op: 'state.set';
  path: string;
  value: EventScalar;
}

/** Additive state update used by authored counters and relationship meters. */
export interface StateAddEventCommand {
  op: 'state.add';
  path: string;
  value: number;
  /** Optional authored bounds. This is an additive v1 extension. */
  clamp?: { min: number; max: number };
}

export interface DialogueEventCommand {
  op: 'dialogue';
  text: string;
  speaker?: string;
  portraitAssetId?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** Optional availability condition; omitted by legacy v1 programs. */
  condition?: EventCondition;
  commands: VisualEventCommand[];
}

export interface ChoiceEventCommand {
  op: 'choice';
  prompt?: string;
  options: ChoiceOption[];
}

export interface ConditionalEventCommand {
  op: 'conditional';
  condition: EventCondition;
  then: VisualEventCommand[];
  else?: VisualEventCommand[];
}

export interface SceneStartEventCommand {
  op: 'scene.start';
  sceneId: string;
  transition?: 'none' | 'fade' | 'crossfade';
}

export type VisualEventCommand =
  | StateSetEventCommand
  | StateAddEventCommand
  | DialogueEventCommand
  | ChoiceEventCommand
  | ConditionalEventCommand
  | SceneStartEventCommand;

export interface VisualEventProgramV1 {
  schemaVersion: 1;
  id: string;
  commands: VisualEventCommand[];
}

export type CompiledEventInstruction =
  | { opcode: 'STATE_SET'; path: string; value: EventScalar }
  | { opcode: 'STATE_ADD'; path: string; value: number; clamp?: { min: number; max: number } }
  | { opcode: 'DIALOGUE'; text: string; speaker?: string; portraitAssetId?: string }
  | {
      opcode: 'CHOICE';
      prompt?: string;
      options: Array<{ id: string; label: string; target: number; condition?: EventCondition }>;
    }
  | { opcode: 'JUMP_IF_FALSE'; condition: EventCondition; target: number }
  | { opcode: 'JUMP'; target: number }
  | { opcode: 'SCENE_START'; sceneId: string; transition: 'none' | 'fade' | 'crossfade' }
  | { opcode: 'END' };

export interface CompiledVisualEventProgramV1 {
  schemaVersion: 1;
  sourceId: string;
  instructions: CompiledEventInstruction[];
}

export interface EventIrDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}

export type EventIrCompileResult =
  | { ok: true; program: CompiledVisualEventProgramV1; diagnostics: EventIrDiagnostic[] }
  | { ok: false; diagnostics: EventIrDiagnostic[] };

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/;
const STATE_SEGMENT = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const FORBIDDEN_STATE_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_NESTING_DEPTH = 64;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is EventScalar {
  return value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}

function isSafeStatePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 256) return false;
  const segments = value.split('.');
  return segments.every(segment => STATE_SEGMENT.test(segment) && !FORBIDDEN_STATE_SEGMENTS.has(segment));
}

function pushError(
  diagnostics: EventIrDiagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ severity: 'error', code, path, message });
}

function validateCondition(
  value: unknown,
  path: string,
  diagnostics: EventIrDiagnostic[],
  depth: number,
): value is EventCondition {
  if (depth > MAX_NESTING_DEPTH) {
    pushError(diagnostics, 'nesting.limit', path, `Condition nesting exceeds ${MAX_NESTING_DEPTH}.`);
    return false;
  }
  if (!isRecord(value)) {
    pushError(diagnostics, 'condition.type', path, 'Condition must be an object.');
    return false;
  }
  switch (value.kind) {
    case 'state.compare': {
      let valid = true;
      if (!isSafeStatePath(value.path)) {
        pushError(diagnostics, 'state.path', `${path}.path`, 'State path is invalid or unsafe.');
        valid = false;
      }
      if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(String(value.operator))) {
        pushError(diagnostics, 'condition.operator', `${path}.operator`, 'Comparison operator is invalid.');
        valid = false;
      }
      if (!isScalar(value.value)) {
        pushError(diagnostics, 'condition.value', `${path}.value`, 'Comparison value must be a finite scalar.');
        valid = false;
      }
      return valid;
    }
    case 'all':
    case 'any': {
      if (!Array.isArray(value.conditions) || value.conditions.length === 0) {
        pushError(diagnostics, 'condition.children', `${path}.conditions`, 'Logical condition requires at least one child.');
        return false;
      }
      let valid = true;
      value.conditions.forEach((condition, index) => {
        if (!validateCondition(condition, `${path}.conditions[${index}]`, diagnostics, depth + 1)) valid = false;
      });
      return valid;
    }
    case 'not':
      return validateCondition(value.condition, `${path}.condition`, diagnostics, depth + 1);
    default:
      pushError(diagnostics, 'condition.kind', `${path}.kind`, 'Condition kind is not supported.');
      return false;
  }
}

function validateCommands(
  value: unknown,
  path: string,
  diagnostics: EventIrDiagnostic[],
  depth: number,
): value is VisualEventCommand[] {
  if (depth > MAX_NESTING_DEPTH) {
    pushError(diagnostics, 'nesting.limit', path, `Command nesting exceeds ${MAX_NESTING_DEPTH}.`);
    return false;
  }
  if (!Array.isArray(value)) {
    pushError(diagnostics, 'commands.type', path, 'Commands must be an array.');
    return false;
  }
  let valid = true;
  value.forEach((command, index) => {
    const commandPath = `${path}[${index}]`;
    if (!isRecord(command)) {
      pushError(diagnostics, 'command.type', commandPath, 'Command must be an object.');
      valid = false;
      return;
    }
    switch (command.op) {
      case 'state.set':
        if (!isSafeStatePath(command.path)) {
          pushError(diagnostics, 'state.path', `${commandPath}.path`, 'State path is invalid or unsafe.');
          valid = false;
        }
        if (!isScalar(command.value)) {
          pushError(diagnostics, 'state.value', `${commandPath}.value`, 'State value must be a finite scalar.');
          valid = false;
        }
        break;
      case 'state.add':
        if (!isSafeStatePath(command.path)) {
          pushError(diagnostics, 'state.path', `${commandPath}.path`, 'State path is invalid or unsafe.');
          valid = false;
        }
        if (typeof command.value !== 'number' || !Number.isFinite(command.value)) {
          pushError(diagnostics, 'state.value', `${commandPath}.value`, 'State delta must be a finite number.');
          valid = false;
        }
        if (command.clamp !== undefined) {
          if (!isRecord(command.clamp)
            || typeof command.clamp.min !== 'number'
            || !Number.isFinite(command.clamp.min)
            || typeof command.clamp.max !== 'number'
            || !Number.isFinite(command.clamp.max)
            || command.clamp.min > command.clamp.max) {
            pushError(diagnostics, 'state.clamp', `${commandPath}.clamp`, 'State clamp requires finite min <= max.');
            valid = false;
          }
        }
        break;
      case 'dialogue':
        if (typeof command.text !== 'string' || command.text.trim().length === 0) {
          pushError(diagnostics, 'dialogue.text', `${commandPath}.text`, 'Dialogue text cannot be empty.');
          valid = false;
        }
        if (command.speaker !== undefined && typeof command.speaker !== 'string') {
          pushError(diagnostics, 'dialogue.speaker', `${commandPath}.speaker`, 'Speaker must be text.');
          valid = false;
        }
        if (command.portraitAssetId !== undefined && !isIdentifier(command.portraitAssetId)) {
          pushError(diagnostics, 'dialogue.portrait', `${commandPath}.portraitAssetId`, 'Portrait asset id is invalid.');
          valid = false;
        }
        break;
      case 'choice': {
        if (command.prompt !== undefined && typeof command.prompt !== 'string') {
          pushError(diagnostics, 'choice.prompt', `${commandPath}.prompt`, 'Choice prompt must be text.');
          valid = false;
        }
        if (!Array.isArray(command.options) || command.options.length < 2) {
          pushError(diagnostics, 'choice.options', `${commandPath}.options`, 'Choice requires at least two options.');
          valid = false;
          break;
        }
        const optionIds = new Set<string>();
        command.options.forEach((option, optionIndex) => {
          const optionPath = `${commandPath}.options[${optionIndex}]`;
          if (!isRecord(option) || !isIdentifier(option.id)) {
            pushError(diagnostics, 'choice.option.id', `${optionPath}.id`, 'Choice option id is invalid.');
            valid = false;
            return;
          }
          if (optionIds.has(option.id as string)) {
            pushError(diagnostics, 'choice.option.duplicate', `${optionPath}.id`, 'Choice option ids must be unique.');
            valid = false;
          }
          optionIds.add(option.id as string);
          if (typeof option.label !== 'string' || option.label.trim().length === 0) {
            pushError(diagnostics, 'choice.option.label', `${optionPath}.label`, 'Choice option label cannot be empty.');
            valid = false;
          }
          if (option.condition !== undefined
            && !validateCondition(option.condition, `${optionPath}.condition`, diagnostics, depth + 1)) {
            valid = false;
          }
          if (!validateCommands(option.commands, `${optionPath}.commands`, diagnostics, depth + 1)) valid = false;
        });
        break;
      }
      case 'conditional':
        if (!validateCondition(command.condition, `${commandPath}.condition`, diagnostics, depth + 1)) valid = false;
        if (!validateCommands(command.then, `${commandPath}.then`, diagnostics, depth + 1)) valid = false;
        if (command.else !== undefined
          && !validateCommands(command.else, `${commandPath}.else`, diagnostics, depth + 1)) valid = false;
        break;
      case 'scene.start':
        if (!isIdentifier(command.sceneId)) {
          pushError(diagnostics, 'scene.id', `${commandPath}.sceneId`, 'Scene id is invalid.');
          valid = false;
        }
        if (command.transition !== undefined
          && !['none', 'fade', 'crossfade'].includes(String(command.transition))) {
          pushError(diagnostics, 'scene.transition', `${commandPath}.transition`, 'Scene transition is invalid.');
          valid = false;
        }
        break;
      default:
        pushError(diagnostics, 'command.op', `${commandPath}.op`, 'Command operation is not supported.');
        valid = false;
    }
  });
  return valid;
}

export function validateVisualEventProgram(input: unknown): EventIrDiagnostic[] {
  const diagnostics: EventIrDiagnostic[] = [];
  if (!isRecord(input)) {
    pushError(diagnostics, 'program.type', '$', 'Visual event program must be an object.');
    return diagnostics;
  }
  if (input.schemaVersion !== 1) {
    pushError(diagnostics, 'program.version', '$.schemaVersion', 'Only visual event schema version 1 is supported.');
  }
  if (!isIdentifier(input.id)) {
    pushError(diagnostics, 'program.id', '$.id', 'Program id is invalid.');
  }
  validateCommands(input.commands, '$.commands', diagnostics, 0);
  return diagnostics;
}

function copyCondition(condition: EventCondition): EventCondition {
  switch (condition.kind) {
    case 'state.compare': return { ...condition };
    case 'not': return { kind: 'not', condition: copyCondition(condition.condition) };
    case 'all': return { kind: 'all', conditions: condition.conditions.map(copyCondition) };
    case 'any': return { kind: 'any', conditions: condition.conditions.map(copyCondition) };
  }
}

function emitCommands(commands: readonly VisualEventCommand[], output: CompiledEventInstruction[]): void {
  for (const command of commands) {
    switch (command.op) {
      case 'state.set':
        output.push({ opcode: 'STATE_SET', path: command.path, value: command.value });
        break;
      case 'state.add':
        output.push({
          opcode: 'STATE_ADD',
          path: command.path,
          value: command.value,
          ...(command.clamp === undefined ? {} : { clamp: { ...command.clamp } }),
        });
        break;
      case 'dialogue':
        output.push({
          opcode: 'DIALOGUE',
          text: command.text,
          ...(command.speaker === undefined ? {} : { speaker: command.speaker }),
          ...(command.portraitAssetId === undefined ? {} : { portraitAssetId: command.portraitAssetId }),
        });
        break;
      case 'scene.start':
        output.push({ opcode: 'SCENE_START', sceneId: command.sceneId, transition: command.transition ?? 'fade' });
        break;
      case 'conditional': {
        const conditionalIndex = output.length;
        output.push({ opcode: 'JUMP_IF_FALSE', condition: copyCondition(command.condition), target: -1 });
        emitCommands(command.then, output);
        const elseCommands = command.else ?? [];
        if (elseCommands.length === 0) {
          (output[conditionalIndex] as Extract<CompiledEventInstruction, { opcode: 'JUMP_IF_FALSE' }>).target = output.length;
          break;
        }
        const endJumpIndex = output.length;
        output.push({ opcode: 'JUMP', target: -1 });
        (output[conditionalIndex] as Extract<CompiledEventInstruction, { opcode: 'JUMP_IF_FALSE' }>).target = output.length;
        emitCommands(elseCommands, output);
        (output[endJumpIndex] as Extract<CompiledEventInstruction, { opcode: 'JUMP' }>).target = output.length;
        break;
      }
      case 'choice': {
        const choiceIndex = output.length;
        output.push({ opcode: 'CHOICE', ...(command.prompt === undefined ? {} : { prompt: command.prompt }), options: [] });
        const endJumps: number[] = [];
        const compiledOptions: Array<{ id: string; label: string; target: number; condition?: EventCondition }> = [];
        command.options.forEach(option => {
          compiledOptions.push({
            id: option.id,
            label: option.label,
            target: output.length,
            ...(option.condition === undefined ? {} : { condition: copyCondition(option.condition) }),
          });
          emitCommands(option.commands, output);
          endJumps.push(output.length);
          output.push({ opcode: 'JUMP', target: -1 });
        });
        const endTarget = output.length;
        endJumps.forEach(index => {
          (output[index] as Extract<CompiledEventInstruction, { opcode: 'JUMP' }>).target = endTarget;
        });
        (output[choiceIndex] as Extract<CompiledEventInstruction, { opcode: 'CHOICE' }>).options = compiledOptions;
        break;
      }
    }
  }
}

/** Validates and compiles visual data into deterministic runtime bytecode. */
export function compileVisualEventProgram(input: unknown): EventIrCompileResult {
  const diagnostics = validateVisualEventProgram(input);
  if (diagnostics.some(diagnostic => diagnostic.severity === 'error')) return { ok: false, diagnostics };
  const source = input as VisualEventProgramV1;
  const instructions: CompiledEventInstruction[] = [];
  emitCommands(source.commands, instructions);
  instructions.push({ opcode: 'END' });
  return {
    ok: true,
    diagnostics,
    program: { schemaVersion: 1, sourceId: source.id, instructions },
  };
}

/** Pure evaluator for conditional instructions; it never resolves arbitrary code. */
export function evaluateEventCondition(
  condition: EventCondition,
  readState: (path: string) => EventScalar | undefined,
): boolean {
  switch (condition.kind) {
    case 'all': return condition.conditions.every(child => evaluateEventCondition(child, readState));
    case 'any': return condition.conditions.some(child => evaluateEventCondition(child, readState));
    case 'not': return !evaluateEventCondition(condition.condition, readState);
    case 'state.compare': {
      const actual = readState(condition.path);
      switch (condition.operator) {
        case 'eq': return actual === condition.value;
        case 'neq': return actual !== condition.value;
        case 'gt': return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
        case 'gte': return typeof actual === 'number' && typeof condition.value === 'number' && actual >= condition.value;
        case 'lt': return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value;
        case 'lte': return typeof actual === 'number' && typeof condition.value === 'number' && actual <= condition.value;
      }
    }
  }
}
