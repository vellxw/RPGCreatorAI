import type {
  VisualNovelChoice,
  VisualNovelCondition,
  VisualNovelContentV1,
  VisualNovelNode,
  VisualNovelValue,
  VisualNovelVariableEffect,
  VisualNovelVariables,
} from '../dialogue/contracts';
import type {
  ChoiceOption,
  EventCondition,
  VisualEventCommand,
  VisualEventProgramV1,
} from '../events/visualEventIr';
import { HORROR_BL_AUDIO_CUE_ASSET_IDS } from './horrorBlGameBundle';
import { assertValidHorrorBlVerticalSlice } from './horrorBlVerticalSlice';

type JsonRecord = Record<string, unknown>;

export interface HorrorBlRuntimeState {
  variables: Record<string, number>;
  flags: Record<string, boolean>;
}

export interface HorrorBlRuntimeCheckpoint {
  id: string;
  mapId: string;
  beatId: string;
}

/**
 * Renderer-neutral output shared by Scene/VN Studio and Event Graph. Programs
 * remain authoring IR; a runtime host can compile them with visualEventIr.
 */
export interface HorrorBlRuntimeAdaptation {
  schemaVersion: 1;
  chapterId: string;
  entryProgramId: string;
  initialState: HorrorBlRuntimeState;
  dialogue: VisualNovelContentV1;
  eventPrograms: Record<string, VisualEventProgramV1>;
  checkpoints: HorrorBlRuntimeCheckpoint[];
}

interface StateIndex {
  variableBounds: Map<string, { min: number; max: number }>;
  flagIds: Set<string>;
}

const record = (value: unknown): JsonRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};

const records = (value: unknown): JsonRecord[] =>
  Array.isArray(value) ? value.filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry)) as JsonRecord[] : [];

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

function buildStateIndex(source: JsonRecord): StateIndex {
  const state = record(source.state);
  const variableBounds = new Map<string, { min: number; max: number }>();
  records(state.variables).forEach(variable => {
    variableBounds.set(text(variable.id), {
      min: Number(variable.min),
      max: Number(variable.max),
    });
  });
  return {
    variableBounds,
    flagIds: new Set(records(state.flags).map(flag => text(flag.id))),
  };
}

function statePath(target: string, index: StateIndex): string {
  return index.flagIds.has(target) ? `flags.${target}` : `variables.${target}`;
}

function initialState(source: JsonRecord): HorrorBlRuntimeState {
  const state = record(source.state);
  return {
    variables: Object.fromEntries(records(state.variables).map(variable => [text(variable.id), Number(variable.initial)])),
    flags: Object.fromEntries(records(state.flags).map(flag => [text(flag.id), flag.initial === true])),
  };
}

function initialVisualNovelVariables(state: HorrorBlRuntimeState): VisualNovelVariables {
  return {
    ...Object.fromEntries(Object.entries(state.variables).map(([id, value]) => [`variables.${id}`, value])),
    ...Object.fromEntries(Object.entries(state.flags).map(([id, value]) => [`flags.${id}`, value])),
  };
}

function adaptEffect(effect: JsonRecord, index: StateIndex): VisualNovelVariableEffect {
  const target = text(effect.target);
  if (effect.op === 'setFlag') {
    return { operation: 'set', variable: statePath(target, index), value: effect.value === true };
  }
  const bounds = index.variableBounds.get(target);
  return {
    operation: 'add',
    variable: statePath(target, index),
    value: Number(effect.value),
    ...(bounds ? { clamp: { ...bounds } } : {}),
  };
}

function adaptCondition(condition: JsonRecord, index: StateIndex): VisualNovelCondition {
  const operators: Record<string, VisualNovelCondition['operator']> = {
    eq: 'equals',
    neq: 'notEquals',
    gt: 'greaterThan',
    gte: 'greaterThanOrEqual',
    lt: 'lessThan',
    lte: 'lessThanOrEqual',
  };
  return {
    variable: statePath(text(condition.target), index),
    operator: operators[text(condition.op)] ?? 'equals',
    value: condition.value as VisualNovelValue,
  };
}

function adaptEventCondition(condition: JsonRecord, index: StateIndex): EventCondition {
  const operator = text(condition.op) as Extract<EventCondition, { kind: 'state.compare' }>['operator'];
  return {
    kind: 'state.compare',
    path: statePath(text(condition.target), index),
    operator,
    value: condition.value as VisualNovelValue,
  };
}

function allEventConditions(conditions: JsonRecord[], index: StateIndex): EventCondition | undefined {
  const adapted = conditions.map(condition => adaptEventCondition(condition, index));
  if (adapted.length === 0) return undefined;
  if (adapted.length === 1) return adapted[0];
  return { kind: 'all', conditions: adapted };
}

function effectCommands(effects: unknown, index: StateIndex): VisualEventCommand[] {
  return records(effects).map(effect => {
    const target = text(effect.target);
    const path = statePath(target, index);
    if (effect.op === 'setFlag') {
      return { op: 'state.set', path, value: effect.value === true };
    }
    const bounds = index.variableBounds.get(target);
    return {
      op: 'state.add',
      path,
      value: Number(effect.value),
      ...(bounds ? { clamp: { ...bounds } } : {}),
    };
  });
}

function destinationProgramId(option: JsonRecord): string {
  if (typeof option.nextBeatId === 'string') return `beat.${option.nextBeatId}`;
  return `ending.${text(option.endingId)}`;
}

function sceneStart(programId: string): VisualEventCommand {
  return { op: 'scene.start', sceneId: programId, transition: 'fade' };
}

function audioCueNode(
  id: string,
  assetId: string,
  next: string,
  channel: 'bgm' | 'ambient' | 'sfx' = 'sfx',
  options: { volume?: number; loop?: boolean } = {},
): VisualNovelNode {
  return {
    id,
    type: 'audio',
    channel,
    action: 'play',
    assetId,
    ...(options.volume !== undefined ? { volume: options.volume } : {}),
    ...(options.loop !== undefined ? { loop: options.loop } : {}),
    next,
  };
}

function ambienceAssetId(mapId: string): string | undefined {
  return HORROR_BL_AUDIO_CUE_ASSET_IDS[`map.${mapId}`];
}

function beatCueAssets(beat: JsonRecord): Array<{ suffix: string; assetId: string; channel: 'ambient' | 'sfx'; loop?: boolean; volume?: number }> {
  const cues: Array<{ suffix: string; assetId: string; channel: 'ambient' | 'sfx'; loop?: boolean; volume?: number }> = [];
  const ambience = ambienceAssetId(text(beat.mapId));
  if (ambience) cues.push({ suffix: 'ambience', assetId: ambience, channel: 'ambient', loop: true, volume: 0.48 });
  // The entity is first named in the shortcut beat and fully revealed by the
  // chase. Both beats deliberately replay a short semantic stinger.
  if (text(beat.id) === 'shortcut_choice' || text(beat.id) === 'corridor_chase') {
    cues.push({ suffix: 'ninth-witness', assetId: HORROR_BL_AUDIO_CUE_ASSET_IDS['ninth-witness.stinger'], channel: 'sfx', volume: 0.82 });
  }
  return cues;
}

function buildVisualNovelContent(
  source: JsonRecord,
  runtimeState: HorrorBlRuntimeState,
  index: StateIndex,
): VisualNovelContentV1 {
  const beats = records(source.storyBeats);
  const endings = records(source.endings);
  const characters = new Map(records(source.characters).map(character => [text(character.id), character]));
  const puzzles = new Map(records(source.puzzles).map(puzzle => [text(puzzle.id), puzzle]));
  const chases = new Map(records(source.chases).map(chase => [text(chase.id), chase]));
  const entryByBeat = new Map<string, string>();

  beats.forEach(beat => {
    const id = text(beat.id);
    entryByBeat.set(id, `beat.${id}.audio.ambience`);
  });

  const endingNodeId = (id: string) => `ending.${id}`;
  const endingEntryNodeId = (id: string) => `ending.${id}.audio.ending`;
  const beatDestination = (beat: JsonRecord): string | undefined => {
    if (typeof beat.nextBeatId === 'string') return entryByBeat.get(beat.nextBeatId);
    const system = beat.type === 'puzzle'
      ? puzzles.get(text(beat.systemId))
      : beat.type === 'chase'
        ? chases.get(text(beat.systemId))
        : undefined;
    return typeof system?.successBeatId === 'string' ? entryByBeat.get(system.successBeatId) : undefined;
  };

  const nodes: VisualNovelNode[] = [];
  beats.forEach(beat => {
    const beatId = text(beat.id);
    const next = beatDestination(beat);
    const firstSuffix = beat.type === 'dialogue' ? 'line.0' : beat.type === 'choice' ? 'choice' : 'system';
    const presentationEntryId = `beat.${beatId}.${firstSuffix}`;
    const cueNodes = beatCueAssets(beat);
    let cueNext = presentationEntryId;
    for (let index = cueNodes.length - 1; index >= 0; index -= 1) {
      const cue = cueNodes[index];
      nodes.push(audioCueNode(
        `beat.${beatId}.audio.${cue.suffix}`,
        cue.assetId,
        cueNext,
        cue.channel,
        { loop: cue.loop, volume: cue.volume },
      ));
      cueNext = `beat.${beatId}.audio.${cue.suffix}`;
    }
    if (beat.type === 'dialogue') {
      const lines = records(beat.lines);
      lines.forEach((line, lineIndex) => {
        const character = characters.get(text(line.speakerId));
        const nextNode = lineIndex + 1 < lines.length ? `beat.${beatId}.line.${lineIndex + 1}` : next;
        const confirmNodeId = nextNode ? `beat.${beatId}.line.${lineIndex}.audio.confirm` : undefined;
        nodes.push({
          id: `beat.${beatId}.line.${lineIndex}`,
          type: 'dialogue',
          speaker: text(character?.name, text(line.speakerId)),
          text: text(line.text),
          ...(typeof character?.portraitSlot === 'string'
            ? { portrait: { assetId: character.portraitSlot, position: line.speakerId === source.playerCharacterId ? 'left' : 'right' } }
            : {}),
          ...(confirmNodeId ? { next: confirmNodeId } : {}),
        });
        if (nextNode && confirmNodeId) {
          nodes.push(audioCueNode(
            confirmNodeId,
            HORROR_BL_AUDIO_CUE_ASSET_IDS['ui.confirm'],
            nextNode,
            'sfx',
            { volume: 0.55 },
          ));
        }
      });
      return;
    }
    if (beat.type === 'choice') {
      const choices: VisualNovelChoice[] = records(beat.options).map(option => {
        const optionId = text(option.id);
        const nextNode = typeof option.nextBeatId === 'string'
          ? entryByBeat.get(option.nextBeatId) ?? `beat.${option.nextBeatId}.system`
          : endingEntryNodeId(text(option.endingId));
        const confirmNodeId = `beat.${beatId}.choice.${optionId}.audio.confirm`;
        nodes.push(audioCueNode(
          confirmNodeId,
          HORROR_BL_AUDIO_CUE_ASSET_IDS['ui.confirm'],
          nextNode,
          'sfx',
          { volume: 0.55 },
        ));
        return {
          id: optionId,
          text: text(option.text),
          next: confirmNodeId,
          ...(Array.isArray(option.conditions)
            ? { conditions: records(option.conditions).map(condition => adaptCondition(condition, index)) }
            : {}),
          ...(Array.isArray(option.effects)
            ? { effects: records(option.effects).map(effect => adaptEffect(effect, index)) }
            : {}),
        };
      });
      nodes.push({ id: `beat.${beatId}.choice`, type: 'choice', prompt: text(beat.prompt), choices });
      return;
    }

    const system = beat.type === 'puzzle'
      ? puzzles.get(text(beat.systemId))
      : beat.type === 'chase'
        ? chases.get(text(beat.systemId))
        : undefined;
    const objective = text(beat.objective, text(system?.objective, text(system?.prompt, text(beat.summary))));
    const confirmNodeId = next ? `beat.${beatId}.system.audio.confirm` : undefined;
    nodes.push({
      id: `beat.${beatId}.system`,
      type: 'dialogue',
      speaker: beat.type === 'exploration' ? 'Objetivo' : beat.type === 'puzzle' ? 'Puzzle' : 'Persecución',
      text: objective,
      ...(confirmNodeId ? { next: confirmNodeId } : {}),
    });
    if (next && confirmNodeId) {
      nodes.push(audioCueNode(
        confirmNodeId,
        HORROR_BL_AUDIO_CUE_ASSET_IDS['ui.confirm'],
        next,
        'sfx',
        { volume: 0.55 },
      ));
    }
  });

  endings.forEach(ending => {
    const id = text(ending.id);
    nodes.push(audioCueNode(
      endingEntryNodeId(id),
      HORROR_BL_AUDIO_CUE_ASSET_IDS['ending.memory-release'],
      endingNodeId(id),
      'bgm',
      { volume: 0.7 },
    ));
    nodes.push({
      id: endingNodeId(id),
      type: 'ending',
      endingId: text(ending.id),
      title: text(ending.title),
      kind: ending.kind === 'hopeful' ? 'good' : ending.kind === 'bittersweet' ? 'neutral' : 'bad',
    });
  });

  const chapterId = text(source.id);
  return {
    schemaVersion: 1,
    scenes: {
      [chapterId]: {
        id: chapterId,
        title: text(source.title),
        entryNodeId: entryByBeat.get(text(source.entryBeatId)) ?? '',
        initialVariables: initialVisualNovelVariables(runtimeState),
        nodes,
      },
    },
  };
}

function buildBeatProgram(beat: JsonRecord, source: JsonRecord, index: StateIndex): VisualEventProgramV1 {
  const id = text(beat.id);
  const commands: VisualEventCommand[] = [];
  const characters = new Map(records(source.characters).map(character => [text(character.id), character]));

  if (beat.type === 'dialogue') {
    records(beat.lines).forEach(line => {
      const character = characters.get(text(line.speakerId));
      commands.push({
        op: 'dialogue',
        speaker: text(character?.name, text(line.speakerId)),
        text: text(line.text),
        ...(typeof character?.portraitSlot === 'string' ? { portraitAssetId: character.portraitSlot } : {}),
      });
    });
    if (typeof beat.nextBeatId === 'string') commands.push(sceneStart(`beat.${beat.nextBeatId}`));
  } else if (beat.type === 'choice') {
    const options: ChoiceOption[] = records(beat.options).map(option => ({
      id: text(option.id),
      label: text(option.text),
      ...(records(option.conditions).length > 0
        ? { condition: allEventConditions(records(option.conditions), index) }
        : {}),
      commands: [...effectCommands(option.effects, index), sceneStart(destinationProgramId(option))],
    }));
    commands.push({ op: 'choice', prompt: text(beat.prompt), options });
  } else if (beat.type === 'exploration') {
    commands.push({ op: 'dialogue', speaker: 'Objetivo', text: text(beat.objective, text(beat.summary)) });
    if (typeof beat.nextBeatId === 'string') commands.push(sceneStart(`beat.${beat.nextBeatId}`));
  } else {
    commands.push(sceneStart(`system.${text(beat.systemId)}`));
  }
  return { schemaVersion: 1, id: `beat.${id}`, commands };
}

function buildPuzzleProgram(puzzle: JsonRecord, index: StateIndex): VisualEventProgramV1 {
  const id = text(puzzle.id);
  const options: ChoiceOption[] = [
    {
      id: 'correct_sequence',
      label: records(puzzle.sequence).length > 0
        ? records(puzzle.sequence).map(step => text(step)).join(' → ')
        : (Array.isArray(puzzle.sequence) ? puzzle.sequence.map(step => String(step)).join(' → ') : 'Resolver secuencia'),
      commands: [
        ...effectCommands(puzzle.successEffects, index),
        sceneStart(`beat.${text(puzzle.successBeatId)}`),
      ],
    },
    {
      id: 'wrong_sequence',
      label: 'Probar una secuencia distinta',
      commands: [
        ...effectCommands(puzzle.wrongAttemptEffects, index),
        sceneStart(`system.${id}`),
      ],
    },
  ];
  const bypass = record(puzzle.assistedBypass);
  if (bypass.enabled === true) {
    options.push({
      id: 'emergency_bypass',
      label: 'Usar el bypass de emergencia',
      commands: [
        ...effectCommands(bypass.effects, index),
        sceneStart(`beat.${text(puzzle.successBeatId)}`),
      ],
    });
  }
  return {
    schemaVersion: 1,
    id: `system.${id}`,
    commands: [{ op: 'choice', prompt: text(puzzle.prompt), options }],
  };
}

function buildChaseProgram(chase: JsonRecord, source: JsonRecord, index: StateIndex): VisualEventProgramV1 {
  const id = text(chase.id);
  const checkpoint = records(source.checkpoints).find(candidate => candidate.id === chase.checkpointId);
  return {
    schemaVersion: 1,
    id: `system.${id}`,
    commands: [{
      op: 'choice',
      prompt: text(chase.objective),
      options: [
        {
          id: 'reach_exit',
          label: 'Alcanzar la compuerta',
          commands: [...effectCommands(chase.successEffects, index), sceneStart(`beat.${text(chase.successBeatId)}`)],
        },
        {
          id: 'take_hit',
          label: 'Recibir un impacto y seguir',
          commands: [...effectCommands(chase.hitEffects, index), sceneStart(`system.${id}`)],
        },
        {
          id: 'restart_checkpoint',
          label: 'Reintentar desde el checkpoint',
          commands: [sceneStart(`beat.${text(checkpoint?.beatId, text(chase.successBeatId))}`)],
        },
      ],
    }],
  };
}

function buildEvidenceProgram(evidence: JsonRecord, index: StateIndex): VisualEventProgramV1 {
  const id = text(evidence.id);
  return {
    schemaVersion: 1,
    id: `evidence.${id}`,
    commands: [
      { op: 'dialogue', speaker: text(evidence.title, 'Evidencia'), text: text(evidence.revelation) },
      ...effectCommands(evidence.effects, index),
    ],
  };
}

function buildEndingProgram(ending: JsonRecord): VisualEventProgramV1 {
  return {
    schemaVersion: 1,
    id: `ending.${text(ending.id)}`,
    commands: [
      { op: 'dialogue', speaker: text(ending.title), text: text(ending.resolution) },
      { op: 'dialogue', speaker: 'Capítulo II', text: text(ending.chapterTwoHook) },
    ],
  };
}

/** Convert canonical chapter data to the existing VN and visual-event v1 contracts. */
export function adaptHorrorBlVerticalSliceToRuntime(input: unknown): HorrorBlRuntimeAdaptation {
  assertValidHorrorBlVerticalSlice(input);
  const source = input;
  const index = buildStateIndex(source);
  const state = initialState(source);
  const programs = [
    ...records(source.storyBeats).map(beat => buildBeatProgram(beat, source, index)),
    ...records(source.puzzles).map(puzzle => buildPuzzleProgram(puzzle, index)),
    ...records(source.chases).map(chase => buildChaseProgram(chase, source, index)),
    ...records(source.evidence).map(evidence => buildEvidenceProgram(evidence, index)),
    ...records(source.endings).map(buildEndingProgram),
  ];

  return {
    schemaVersion: 1,
    chapterId: text(source.id),
    entryProgramId: `beat.${text(source.entryBeatId)}`,
    initialState: state,
    dialogue: buildVisualNovelContent(source, state, index),
    eventPrograms: Object.fromEntries(programs.map(program => [program.id, program])),
    checkpoints: records(source.checkpoints).map(checkpoint => ({
      id: text(checkpoint.id),
      mapId: text(checkpoint.mapId),
      beatId: text(checkpoint.beatId),
    })),
  };
}
