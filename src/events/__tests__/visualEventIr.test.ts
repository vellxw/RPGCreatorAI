import { describe, expect, it } from 'vitest';
import {
  compileVisualEventProgram,
  evaluateEventCondition,
  validateVisualEventProgram,
  type VisualEventProgramV1,
} from '../visualEventIr';

const program: VisualEventProgramV1 = {
  schemaVersion: 1,
  id: 'archive.intro',
  commands: [
    { op: 'dialogue', speaker: 'Damián', text: 'No mires atrás.' },
    {
      op: 'conditional',
      condition: { kind: 'state.compare', path: 'flags.archive_open', operator: 'eq', value: true },
      then: [{ op: 'scene.start', sceneId: 'archive.open', transition: 'crossfade' }],
      else: [
        {
          op: 'choice',
          prompt: '¿Qué vas a hacer?',
          options: [
            { id: 'enter', label: 'Entrar', commands: [{ op: 'state.set', path: 'flags.entered', value: true }] },
            { id: 'leave', label: 'Volver', commands: [{ op: 'scene.start', sceneId: 'hallway' }] },
          ],
        },
      ],
    },
  ],
};

describe('visual event IR', () => {
  it('validates and compiles nested commands into deterministic jumps', () => {
    expect(validateVisualEventProgram(program)).toEqual([]);
    const first = compileVisualEventProgram(program);
    const second = compileVisualEventProgram(program);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    expect(first.program.instructions).toEqual([
      { opcode: 'DIALOGUE', speaker: 'Damián', text: 'No mires atrás.' },
      {
        opcode: 'JUMP_IF_FALSE',
        condition: { kind: 'state.compare', path: 'flags.archive_open', operator: 'eq', value: true },
        target: 4,
      },
      { opcode: 'SCENE_START', sceneId: 'archive.open', transition: 'crossfade' },
      { opcode: 'JUMP', target: 9 },
      {
        opcode: 'CHOICE',
        prompt: '¿Qué vas a hacer?',
        options: [
          { id: 'enter', label: 'Entrar', target: 5 },
          { id: 'leave', label: 'Volver', target: 7 },
        ],
      },
      { opcode: 'STATE_SET', path: 'flags.entered', value: true },
      { opcode: 'JUMP', target: 9 },
      { opcode: 'SCENE_START', sceneId: 'hallway', transition: 'fade' },
      { opcode: 'JUMP', target: 9 },
      { opcode: 'END' },
    ]);
  });

  it('rejects unknown operations, unsafe paths and malformed choices', () => {
    const diagnostics = validateVisualEventProgram({
      schemaVersion: 1,
      id: 'unsafe',
      commands: [
        { op: 'state.set', path: '__proto__.admin', value: true },
        { op: 'choice', options: [{ id: 'only', label: 'Only', commands: [] }] },
        { op: 'javascript.eval', code: 'process.exit()' },
      ],
    });
    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual([
      'state.path',
      'choice.options',
      'command.op',
    ]);
    expect(compileVisualEventProgram({ schemaVersion: 1, id: 'bad', commands: [{ op: 'eval' }] }).ok).toBe(false);
  });

  it('evaluates only the declared condition tree', () => {
    const condition = {
      kind: 'all' as const,
      conditions: [
        { kind: 'state.compare' as const, path: 'variables.lucidity', operator: 'gte' as const, value: 30 },
        { kind: 'not' as const, condition: { kind: 'state.compare' as const, path: 'flags.dead', operator: 'eq' as const, value: true } },
      ],
    };
    const state: Record<string, number | boolean> = { 'variables.lucidity': 42, 'flags.dead': false };
    expect(evaluateEventCondition(condition, path => state[path])).toBe(true);
  });

  it('keeps additive bounds and choice guards in compiled v1 programs', () => {
    const result = compileVisualEventProgram({
      schemaVersion: 1,
      id: 'relationship.choice',
      commands: [{
        op: 'choice',
        options: [
          {
            id: 'trust',
            label: 'Confiar',
            condition: { kind: 'state.compare', path: 'variables.bond', operator: 'gte', value: 2 },
            commands: [{ op: 'state.add', path: 'variables.bond', value: 1, clamp: { min: 0, max: 4 } }],
          },
          { id: 'leave', label: 'Irse', commands: [] },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const choice = result.program.instructions[0];
    expect(choice.opcode).toBe('CHOICE');
    if (choice.opcode !== 'CHOICE') return;
    expect(choice.options[0]).toMatchObject({
      id: 'trust',
      condition: { kind: 'state.compare', path: 'variables.bond', operator: 'gte', value: 2 },
    });
    expect(result.program.instructions).toEqual(expect.arrayContaining([
      { opcode: 'STATE_ADD', path: 'variables.bond', value: 1, clamp: { min: 0, max: 4 } },
    ]));
  });
});
