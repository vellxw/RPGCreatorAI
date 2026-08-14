import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateVisualNovelAction,
  startVisualNovelScene,
  validateVisualNovelContent,
  type VisualNovelEvaluationResult,
} from '../../dialogue/evaluator';
import { compileVisualEventProgram } from '../../events/visualEventIr';
import { adaptHorrorBlVerticalSliceToRuntime } from '../horrorBlRuntimeAdapter';

const contentPath = resolve(process.cwd(), 'templates/horror-bl/data/content/vertical-slice.json');

function canonicalContent(): unknown {
  return JSON.parse(readFileSync(contentPath, 'utf8'));
}

describe('horror/BL runtime adapter', () => {
  it('adapts all authored state, beats, systems and endings to v1 runtime contracts', () => {
    const adaptation = adaptHorrorBlVerticalSliceToRuntime(canonicalContent());
    expect(adaptation.entryProgramId).toBe('beat.arrival_message');
    expect(adaptation.initialState).toMatchObject({
      variables: { bond: 1, lucidity: 70, evidence: 0 },
      flags: { archive_open: false, promised_truth: false },
    });
    expect(validateVisualNovelContent(adaptation.dialogue)).toEqual([]);
    expect(Object.keys(adaptation.eventPrograms)).toEqual(expect.arrayContaining([
      'beat.arrival_message',
      'beat.final_choice',
      'system.archive_power_sequence',
      'system.service_corridor_escape',
      'evidence.intake_recording',
      'ending.the_kept_promise',
      'ending.the_ninth_witness',
    ]));
    expect(adaptation.checkpoints).toHaveLength(2);

    Object.values(adaptation.eventPrograms).forEach(program => {
      expect(compileVisualEventProgram(program).ok, program.id).toBe(true);
    });
  });

  it('preserves the hopeful route conditions and reaches its authored ending', () => {
    const adaptation = adaptHorrorBlVerticalSliceToRuntime(canonicalContent());
    const sceneId = adaptation.chapterId;
    const preferredChoices: Record<string, string> = {
      'beat.lobby_photo_choice.choice': 'show_photo',
      'beat.shortcut_choice.choice': 'refuse_shortcut',
      'beat.post_chase_confession.choice': 'tell_truth',
      'beat.final_choice.choice': 'keep_promise_together',
    };
    let result: VisualNovelEvaluationResult = startVisualNovelScene(adaptation.dialogue, sceneId);

    for (let step = 0; step < 32 && result.ok && result.presentation.type !== 'ending'; step += 1) {
      if (result.presentation.type === 'dialogue') {
        result = evaluateVisualNovelAction(adaptation.dialogue, result.state, { type: 'advance' });
      } else if (result.presentation.type === 'choice') {
        const choiceId = preferredChoices[result.state.currentNodeId];
        expect(result.presentation.choices.map(choice => choice.id)).toContain(choiceId);
        result = evaluateVisualNovelAction(adaptation.dialogue, result.state, { type: 'choose', choiceId });
      }
    }

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.presentation).toMatchObject({ type: 'ending', node: { endingId: 'the_kept_promise' } });
    expect(result.state.variables).toMatchObject({
      'variables.bond': 3,
      'variables.evidence': 2,
      'variables.lucidity': 75,
      'flags.promised_truth': true,
    });
  });

  it('compiles additive/clamped effects and guarded final options without flattening them', () => {
    const adaptation = adaptHorrorBlVerticalSliceToRuntime(canonicalContent());
    const puzzle = compileVisualEventProgram(adaptation.eventPrograms['system.archive_power_sequence']);
    expect(puzzle.ok).toBe(true);
    if (puzzle.ok) {
      expect(puzzle.program.instructions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          opcode: 'STATE_ADD',
          path: 'variables.evidence',
          value: 1,
          clamp: { min: 0, max: 5 },
        }),
        expect.objectContaining({ opcode: 'STATE_SET', path: 'flags.archive_open', value: true }),
      ]));
    }

    const finale = compileVisualEventProgram(adaptation.eventPrograms['beat.final_choice']);
    expect(finale.ok).toBe(true);
    if (finale.ok) {
      const choice = finale.program.instructions.find(instruction => instruction.opcode === 'CHOICE');
      expect(choice).toMatchObject({
        options: [
          {
            id: 'keep_promise_together',
            condition: {
              kind: 'all',
              conditions: [
                { path: 'variables.bond', operator: 'gte', value: 3 },
                { path: 'variables.evidence', operator: 'gte', value: 2 },
                { path: 'flags.promised_truth', operator: 'eq', value: true },
              ],
            },
          },
          { id: 'seal_ninth_witness' },
        ],
      });
    }
  });

  it('emits only canonical asset ids for the chapter audio cues', () => {
    const adaptation = adaptHorrorBlVerticalSliceToRuntime(canonicalContent());
    const scene = adaptation.dialogue.scenes[adaptation.chapterId];
    const audioNodes = scene.nodes.filter(node => node.type === 'audio');

    expect(audioNodes.map(node => node.assetId)).toEqual(expect.arrayContaining([
      'audio.ambience.facility-lobby',
      'audio.ambience.archive-sublevel',
      'audio.ambience.service-corridor',
      'audio.stinger.ninth-witness',
      'audio.ui.confirm',
      'audio.ending.memory-release',
    ]));
    expect(audioNodes.some(node => (node.assetId ?? '').includes('/'))).toBe(false);
    expect(scene.entryNodeId).toBe('beat.arrival_message.audio.ambience');
  });
});
