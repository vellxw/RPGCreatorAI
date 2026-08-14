export const HORROR_BL_VERTICAL_SLICE_SCHEMA_VERSION = 1 as const;

export interface HorrorBlTemplateIssue {
  code: string;
  path: string;
  message: string;
}

type JsonRecord = Record<string, unknown>;

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const REQUIRED_VARIABLES = ['bond', 'lucidity', 'evidence'] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function idOf(value: JsonRecord): string | undefined {
  return typeof value.id === 'string' && SAFE_ID.test(value.id) ? value.id : undefined;
}

function idsOf(values: JsonRecord[]): Set<string> {
  return new Set(values.map(idOf).filter((id): id is string => Boolean(id)));
}

function duplicateIds(values: JsonRecord[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach(value => {
    const id = idOf(value);
    if (!id) return;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  });
  return [...duplicates];
}

/**
 * Validates both the shape and the cross-file semantics needed to compile the
 * horror/BL starter slice. It deliberately owns no rendering or save state.
 */
export function validateHorrorBlVerticalSlice(value: unknown): HorrorBlTemplateIssue[] {
  const issues: HorrorBlTemplateIssue[] = [];
  const issue = (code: string, path: string, message: string) => issues.push({ code, path, message });

  if (!isRecord(value)) {
    issue('document.type', '$', 'Expected an object.');
    return issues;
  }
  if (value.schemaVersion !== HORROR_BL_VERTICAL_SLICE_SCHEMA_VERSION) {
    issue('document.version', '$.schemaVersion', 'Only schemaVersion 1 is supported.');
  }
  if (value.audience !== 'adults-only') {
    issue('document.audience', '$.audience', 'The template must be explicitly adults-only.');
  }

  const state = isRecord(value.state) ? value.state : {};
  const variables = records(state.variables);
  const flags = records(state.flags);
  const characters = records(value.characters);
  const threats = records(value.threats);
  const maps = records(value.maps);
  const checkpoints = records(value.checkpoints);
  const evidence = records(value.evidence);
  const puzzles = records(value.puzzles);
  const chases = records(value.chases);
  const beats = records(value.storyBeats);
  const endings = records(value.endings);

  const collections: Array<[string, JsonRecord[]]> = [
    ['variables', variables], ['flags', flags], ['characters', characters], ['threats', threats],
    ['maps', maps], ['checkpoints', checkpoints], ['evidence', evidence], ['puzzles', puzzles],
    ['chases', chases], ['storyBeats', beats], ['endings', endings],
  ];
  collections.forEach(([name, entries]) => {
    if (!Array.isArray(value[name]) && !(name === 'variables' || name === 'flags')) {
      issue('collection.type', `$.${name}`, 'Expected an array.');
    }
    entries.forEach((entry, index) => {
      if (!idOf(entry)) issue('id.invalid', `$.${name}[${index}].id`, 'Expected a portable stable id.');
    });
    duplicateIds(entries).forEach(id => issue('id.duplicate', `$.${name}`, `Duplicate id "${id}".`));
  });

  const variableIds = idsOf(variables);
  REQUIRED_VARIABLES.forEach(id => {
    if (!variableIds.has(id)) issue('state.variable-missing', '$.state.variables', `Missing canonical variable "${id}".`);
  });
  if (variables.length !== REQUIRED_VARIABLES.length) {
    issue('state.variable-count', '$.state.variables', 'Expected exactly bond, lucidity, and evidence.');
  }
  variables.forEach((variable, index) => {
    const min = variable.min;
    const max = variable.max;
    const initial = variable.initial;
    if (typeof min !== 'number' || typeof max !== 'number' || typeof initial !== 'number'
      || !Number.isInteger(min) || !Number.isInteger(max) || !Number.isInteger(initial)
      || min > initial || initial > max) {
      issue('state.range', `$.state.variables[${index}]`, 'Expected integer min <= initial <= max.');
    }
  });

  const flagIds = idsOf(flags);
  flags.forEach((flag, index) => {
    if (typeof flag.initial !== 'boolean') issue('state.flag', `$.state.flags[${index}].initial`, 'Expected a boolean.');
  });

  if (characters.length < 2) issue('character.count', '$.characters', 'At least two adult characters are required.');
  characters.forEach((character, index) => {
    if (!Number.isInteger(character.age) || Number(character.age) < 18 || character.adultConfirmed !== true) {
      issue('character.not-adult', `$.characters[${index}]`, 'Every human romance character must be confirmed age 18 or older.');
    }
  });
  const characterIds = idsOf(characters);
  if (typeof value.playerCharacterId !== 'string' || !characterIds.has(value.playerCharacterId)) {
    issue('character.player-reference', '$.playerCharacterId', 'Player character does not exist.');
  }
  if (!characters.some(character => character.role === 'love-interest')) {
    issue('character.love-interest', '$.characters', 'An adult love-interest character is required.');
  }

  const mapIds = idsOf(maps);
  const checkpointIds = idsOf(checkpoints);
  const evidenceIds = idsOf(evidence);
  const puzzleIds = idsOf(puzzles);
  const chaseIds = idsOf(chases);
  const threatIds = idsOf(threats);
  const beatIds = idsOf(beats);
  const endingIds = idsOf(endings);
  if (maps.length < 3) issue('map.count', '$.maps', 'A complete slice requires at least three maps.');
  if (typeof value.startMapId !== 'string' || !mapIds.has(value.startMapId)) issue('map.start-reference', '$.startMapId', 'Start map does not exist.');
  if (typeof value.entryBeatId !== 'string' || !beatIds.has(value.entryBeatId)) issue('beat.entry-reference', '$.entryBeatId', 'Entry beat does not exist.');

  const knownTargets = new Set([...variableIds, ...flagIds]);
  const validateEffects = (effects: unknown, path: string) => {
    if (!Array.isArray(effects)) {
      issue('effect.collection', path, 'Expected an effects array.');
      return;
    }
    records(effects).forEach((effect, index) => {
      if ((effect.op !== 'add' && effect.op !== 'setFlag') || typeof effect.target !== 'string' || !knownTargets.has(effect.target)) {
        issue('effect.target', `${path}[${index}]`, 'Effect references an unknown state target or operation.');
      } else if (effect.op === 'add' && (!variableIds.has(effect.target) || !Number.isInteger(effect.value))) {
        issue('effect.numeric', `${path}[${index}]`, 'add requires an integer and a numeric variable.');
      } else if (effect.op === 'setFlag' && (!flagIds.has(effect.target) || typeof effect.value !== 'boolean')) {
        issue('effect.flag', `${path}[${index}]`, 'setFlag requires a boolean and a declared flag.');
      }
    });
  };
  const validateConditions = (conditions: unknown, path: string) => {
    if (!Array.isArray(conditions)) return;
    records(conditions).forEach((condition, index) => {
      if (typeof condition.target !== 'string' || !knownTargets.has(condition.target)
        || !['gte', 'lte', 'eq'].includes(String(condition.op))) {
        issue('condition.invalid', `${path}[${index}]`, 'Condition references unknown state or operator.');
      }
    });
  };

  threats.forEach((threat, index) => validateEffects([threat.contactEffect], `$.threats[${index}].contactEffect`));
  maps.forEach((map, mapIndex) => {
    if (!Number.isInteger(map.width) || Number(map.width) <= 0 || !Number.isInteger(map.height) || Number(map.height) <= 0) {
      issue('map.dimensions', `$.maps[${mapIndex}]`, 'Map dimensions must be positive integers.');
    }
    records(map.connections).forEach((connection, index) => {
      if (typeof connection.toMapId !== 'string' || !mapIds.has(connection.toMapId)) issue('map.connection', `$.maps[${mapIndex}].connections[${index}]`, 'Connection target does not exist.');
      if (typeof connection.lockedByFlag === 'string' && !flagIds.has(connection.lockedByFlag)) issue('map.lock', `$.maps[${mapIndex}].connections[${index}].lockedByFlag`, 'Lock flag does not exist.');
    });
    records(map.interactions).forEach((interaction, index) => {
      const path = `$.maps[${mapIndex}].interactions[${index}]`;
      if (interaction.kind === 'evidence' && !evidenceIds.has(String(interaction.evidenceId))) issue('interaction.evidence', path, 'Evidence reference does not exist.');
      if (interaction.kind === 'choice' && !beatIds.has(String(interaction.beatId))) issue('interaction.beat', path, 'Choice beat does not exist.');
      if (interaction.kind === 'puzzle' && !puzzleIds.has(String(interaction.systemId))) issue('interaction.puzzle', path, 'Puzzle does not exist.');
      if (interaction.kind === 'chase' && !chaseIds.has(String(interaction.systemId))) issue('interaction.chase', path, 'Chase does not exist.');
      if (interaction.kind === 'transfer' && !mapIds.has(String(interaction.targetMapId))) issue('interaction.transfer', path, 'Transfer map does not exist.');
    });
  });

  checkpoints.forEach((checkpoint, index) => {
    if (!mapIds.has(String(checkpoint.mapId)) || !beatIds.has(String(checkpoint.beatId))) issue('checkpoint.reference', `$.checkpoints[${index}]`, 'Checkpoint references unknown map or beat.');
  });
  evidence.forEach((entry, index) => {
    if (!mapIds.has(String(entry.mapId))) issue('evidence.map', `$.evidence[${index}].mapId`, 'Evidence map does not exist.');
    validateEffects(entry.effects, `$.evidence[${index}].effects`);
  });
  puzzles.forEach((puzzle, index) => {
    if (!mapIds.has(String(puzzle.mapId)) || !beatIds.has(String(puzzle.successBeatId))) issue('puzzle.reference', `$.puzzles[${index}]`, 'Puzzle references unknown map or success beat.');
    if (!Array.isArray(puzzle.sequence) || puzzle.sequence.length < 2 || new Set(puzzle.sequence).size !== puzzle.sequence.length) issue('puzzle.sequence', `$.puzzles[${index}].sequence`, 'Puzzle sequence must contain unique steps.');
    records(puzzle.clueEvidenceIds).forEach(() => undefined);
    (Array.isArray(puzzle.clueEvidenceIds) ? puzzle.clueEvidenceIds : []).forEach((id, clueIndex) => {
      if (typeof id !== 'string' || !evidenceIds.has(id)) issue('puzzle.clue', `$.puzzles[${index}].clueEvidenceIds[${clueIndex}]`, 'Puzzle clue evidence does not exist.');
    });
    validateEffects(puzzle.wrongAttemptEffects, `$.puzzles[${index}].wrongAttemptEffects`);
    validateEffects(puzzle.successEffects, `$.puzzles[${index}].successEffects`);
    if (isRecord(puzzle.assistedBypass)) validateEffects(puzzle.assistedBypass.effects, `$.puzzles[${index}].assistedBypass.effects`);
  });
  chases.forEach((chase, index) => {
    if (!mapIds.has(String(chase.mapId)) || !threatIds.has(String(chase.threatId))
      || !checkpointIds.has(String(chase.checkpointId)) || !beatIds.has(String(chase.successBeatId))) {
      issue('chase.reference', `$.chases[${index}]`, 'Chase references unknown map, threat, checkpoint, or success beat.');
    }
    validateEffects(chase.hitEffects, `$.chases[${index}].hitEffects`);
    validateEffects(chase.successEffects, `$.chases[${index}].successEffects`);
  });

  const choiceBeats = beats.filter(beat => beat.type === 'choice');
  if (choiceBeats.length < 4) issue('choice.count', '$.storyBeats', 'The slice requires at least four meaningful choices.');
  beats.forEach((beat, index) => {
    if (!mapIds.has(String(beat.mapId))) issue('beat.map', `$.storyBeats[${index}].mapId`, 'Beat map does not exist.');
    if (typeof beat.nextBeatId === 'string' && !beatIds.has(beat.nextBeatId)) issue('beat.next', `$.storyBeats[${index}].nextBeatId`, 'Next beat does not exist.');
    if (beat.type === 'dialogue') records(beat.lines).forEach((line, lineIndex) => {
      if (!characterIds.has(String(line.speakerId))) issue('beat.speaker', `$.storyBeats[${index}].lines[${lineIndex}]`, 'Speaker does not exist.');
    });
    if (beat.type === 'choice') {
      const options = records(beat.options);
      if (options.length < 2) issue('choice.options', `$.storyBeats[${index}].options`, 'A choice requires at least two options.');
      options.forEach((option, optionIndex) => {
        const path = `$.storyBeats[${index}].options[${optionIndex}]`;
        validateEffects(option.effects, `${path}.effects`);
        validateConditions(option.conditions, `${path}.conditions`);
        const hasNext = typeof option.nextBeatId === 'string' && beatIds.has(option.nextBeatId);
        const hasEnding = typeof option.endingId === 'string' && endingIds.has(option.endingId);
        if (hasNext === hasEnding) issue('choice.destination', path, 'Option must reference exactly one valid beat or ending.');
      });
    }
    if (beat.type === 'puzzle' && !puzzleIds.has(String(beat.systemId))) issue('beat.puzzle', `$.storyBeats[${index}].systemId`, 'Puzzle beat references an unknown puzzle.');
    if (beat.type === 'chase' && !chaseIds.has(String(beat.systemId))) issue('beat.chase', `$.storyBeats[${index}].systemId`, 'Chase beat references an unknown chase.');
  });

  if (endings.length !== 2) issue('ending.count', '$.endings', 'The vertical slice requires exactly two endings.');
  endings.forEach((ending, index) => validateConditions(ending.requirements, `$.endings[${index}].requirements`));
  const reachedEndingIds = new Set(choiceBeats.flatMap(beat => records(beat.options).map(option => option.endingId).filter((id): id is string => typeof id === 'string')));
  endingIds.forEach(id => {
    if (!reachedEndingIds.has(id)) issue('ending.unreachable', '$.endings', `Ending "${id}" is not reachable from a choice.`);
  });

  const assetPolicy = isRecord(value.assetPolicy) ? value.assetPolicy : {};
  if (assetPolicy.remoteUrlsAllowed !== false || assetPolicy.thirdPartyAssetsIncluded !== false) {
    issue('asset.external', '$.assetPolicy', 'The starter must not include remote or third-party assets.');
  }
  const serialized = JSON.stringify(value);
  if (/https?:\/\//i.test(serialized)) issue('asset.remote-url', '$', 'Canonical content must not contain remote URLs.');

  return issues;
}

export function assertValidHorrorBlVerticalSlice(value: unknown): asserts value is JsonRecord {
  const issues = validateHorrorBlVerticalSlice(value);
  if (issues.length > 0) {
    throw new Error(issues.map(entry => `${entry.path}: ${entry.message}`).join('\n'));
  }
}
