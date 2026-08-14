import { describe, expect, it } from 'vitest';
import type { VisualNovelContentV1 } from '../contracts';
import {
  evaluateVisualNovelAction,
  resumeVisualNovelScene,
  startVisualNovelScene,
  validateVisualNovelContent,
} from '../evaluator';

function fixture(): VisualNovelContentV1 {
  return {
    schemaVersion: 1,
    scenes: {
      reunion: {
        id: 'reunion',
        entryNodeId: 'set_lucidity',
        initialVariables: { bond: 1 },
        nodes: [
          { id: 'set_lucidity', type: 'variable', effect: { operation: 'set', variable: 'lucidity', value: 40 }, next: 'fade_in' },
          { id: 'fade_in', type: 'transition', style: 'fade', durationMs: 400, backgroundAssetId: 'bg.archive', next: 'music' },
          { id: 'music', type: 'audio', channel: 'bgm', action: 'play', assetId: 'bgm.promise', volume: 0.7, loop: true, next: 'line' },
          {
            id: 'line',
            type: 'dialogue',
            speaker: 'Damián',
            text: '¿Todavía te acordás de mí?',
            portrait: { assetId: 'portrait.damian', expression: 'wounded', position: 'left' },
            voiceAssetId: 'voice.damian.001',
            next: 'answer',
          },
          {
            id: 'answer',
            type: 'choice',
            prompt: 'Elegí con cuidado.',
            choices: [
              {
                id: 'remember',
                text: 'Nunca te olvidé.',
                next: 'ending_together',
                conditions: [{ variable: 'lucidity', operator: 'greaterThanOrEqual', value: 30 }],
                effects: [{ operation: 'add', variable: 'bond', value: 2 }],
              },
              {
                id: 'deny',
                text: 'No sé quién sos.',
                next: 'ending_alone',
                conditions: [{ variable: 'lucidity', operator: 'lessThan', value: 30 }],
              },
            ],
          },
          { id: 'ending_together', type: 'ending', endingId: 'promise_kept', title: 'La promesa', kind: 'good' },
          { id: 'ending_alone', type: 'ending', endingId: 'forgotten', kind: 'bad' },
        ],
      },
    },
  };
}

describe('visual novel evaluator', () => {
  it('resolves non-blocking variables, transitions and audio before presenting dialogue', () => {
    const result = startVisualNovelScene(fixture(), 'reunion');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toMatchObject({
      type: 'dialogue',
      node: { speaker: 'Damián', portrait: { assetId: 'portrait.damian' } },
    });
    expect(result.state.variables).toEqual({ bond: 1, lucidity: 40 });
    expect(result.cues.map(cue => cue.type)).toEqual(['variable', 'transition', 'audio']);
  });

  it('filters choices, applies effects and reaches an ending without mutating prior state', () => {
    const started = startVisualNovelScene(fixture(), 'reunion');
    if (!started.ok) throw new Error(started.error);
    const previous = started.state;
    const choices = evaluateVisualNovelAction(fixture(), previous, { type: 'advance' });
    expect(choices.ok && choices.presentation).toEqual({
      type: 'choice',
      prompt: 'Elegí con cuidado.',
      choices: [{ id: 'remember', text: 'Nunca te olvidé.' }],
    });
    if (!choices.ok) return;
    const ended = evaluateVisualNovelAction(fixture(), choices.state, { type: 'choose', choiceId: 'remember' });
    expect(ended.ok && ended.presentation).toMatchObject({ type: 'ending', node: { endingId: 'promise_kept' } });
    expect(ended.state.variables.bond).toBe(3);
    expect(ended.state.selectedChoiceIds).toEqual(['remember']);
    expect(previous.variables.bond).toBe(1);
  });

  it('rejects unavailable choices and malformed graph references', () => {
    const started = startVisualNovelScene(fixture(), 'reunion');
    if (!started.ok) throw new Error(started.error);
    const choices = evaluateVisualNovelAction(fixture(), started.state, { type: 'advance' });
    if (!choices.ok) throw new Error(choices.error);
    const denied = evaluateVisualNovelAction(fixture(), choices.state, { type: 'choose', choiceId: 'deny' });
    expect(denied).toMatchObject({ ok: false, error: 'Choice "deny" is not available.' });

    const invalid = fixture();
    invalid.scenes.reunion.nodes[0] = { ...invalid.scenes.reunion.nodes[0], next: 'missing' } as typeof invalid.scenes.reunion.nodes[number];
    expect(validateVisualNovelContent(invalid)).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'Unknown next node "missing".' }),
    ]));
  });

  it('supports bounded additive effects without changing legacy v1 effects', () => {
    const content = fixture();
    const scene = content.scenes.reunion;
    const choice = scene.nodes.find(node => node.type === 'choice');
    if (!choice || choice.type !== 'choice') throw new Error('Expected choice fixture.');
    choice.choices[0].effects = [{
      operation: 'add',
      variable: 'bond',
      value: 20,
      clamp: { min: 0, max: 4 },
    }];

    const started = startVisualNovelScene(content, 'reunion');
    if (!started.ok) throw new Error(started.error);
    const choices = evaluateVisualNovelAction(content, started.state, { type: 'advance' });
    if (!choices.ok) throw new Error(choices.error);
    const ended = evaluateVisualNovelAction(content, choices.state, { type: 'choose', choiceId: 'remember' });
    expect(ended.state.variables.bond).toBe(4);

    choice.choices[0].effects = [{ operation: 'add', variable: 'bond', value: 2 }];
    expect(validateVisualNovelContent(content)).toEqual([]);
  });

  it('starts at an authored node and resumes a blocking node without replaying cues', () => {
    const direct = startVisualNovelScene(fixture(), 'reunion', {}, 'ending_alone');
    expect(direct.ok && direct.presentation).toMatchObject({
      type: 'ending',
      node: { endingId: 'forgotten' },
    });

    const started = startVisualNovelScene(fixture(), 'reunion');
    if (!started.ok) throw new Error(started.error);
    const choices = evaluateVisualNovelAction(fixture(), started.state, { type: 'advance' });
    if (!choices.ok) throw new Error(choices.error);
    const resumed = resumeVisualNovelScene(fixture(), choices.state);

    expect(resumed.ok && resumed.presentation).toEqual(choices.presentation);
    expect(resumed.cues).toEqual([]);
    expect(resumed.state.visitedNodeIds).toEqual(choices.state.visitedNodeIds);
  });
});
