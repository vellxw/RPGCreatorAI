import type {
  VisualNovelAudioNode,
  VisualNovelChoice,
  VisualNovelCondition,
  VisualNovelContentV1,
  VisualNovelDialogueNode,
  VisualNovelEndingNode,
  VisualNovelNode,
  VisualNovelScene,
  VisualNovelTransitionNode,
  VisualNovelValue,
  VisualNovelVariableEffect,
  VisualNovelVariables,
} from './contracts';

export type VisualNovelRuntimeCue =
  | { type: 'transition'; node: VisualNovelTransitionNode }
  | { type: 'audio'; node: VisualNovelAudioNode }
  | { type: 'variable'; effect: VisualNovelVariableEffect; value: VisualNovelValue };

export type VisualNovelPresentation =
  | { type: 'dialogue'; node: VisualNovelDialogueNode }
  | { type: 'choice'; prompt?: string; choices: Array<Pick<VisualNovelChoice, 'id' | 'text'>> }
  | { type: 'ending'; node: VisualNovelEndingNode };

export interface VisualNovelRuntimeState {
  sceneId: string;
  currentNodeId: string;
  variables: VisualNovelVariables;
  visitedNodeIds: string[];
  selectedChoiceIds: string[];
  endingId?: string;
}

export type VisualNovelAction = { type: 'advance' } | { type: 'choose'; choiceId: string };

export type VisualNovelEvaluationResult =
  | {
      ok: true;
      state: VisualNovelRuntimeState;
      presentation: VisualNovelPresentation;
      cues: VisualNovelRuntimeCue[];
    }
  | { ok: false; state: VisualNovelRuntimeState; error: string; cues: VisualNovelRuntimeCue[] };

export interface VisualNovelValidationIssue {
  path: string;
  message: string;
}

const AUTO_NODE_LIMIT = 128;

function cloneVariables(variables: VisualNovelVariables): VisualNovelVariables {
  return { ...variables };
}

function isFiniteNumber(value: VisualNovelValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function evaluateVisualNovelCondition(
  condition: VisualNovelCondition,
  variables: VisualNovelVariables,
): boolean {
  const actual = variables[condition.variable];
  switch (condition.operator) {
    case 'equals': return actual === condition.value;
    case 'notEquals': return actual !== condition.value;
    case 'greaterThan': return isFiniteNumber(actual) && isFiniteNumber(condition.value) && actual > condition.value;
    case 'greaterThanOrEqual': return isFiniteNumber(actual) && isFiniteNumber(condition.value) && actual >= condition.value;
    case 'lessThan': return isFiniteNumber(actual) && isFiniteNumber(condition.value) && actual < condition.value;
    case 'lessThanOrEqual': return isFiniteNumber(actual) && isFiniteNumber(condition.value) && actual <= condition.value;
    case 'truthy': return Boolean(actual);
    case 'falsy': return !actual;
  }
}

export function isVisualNovelChoiceAvailable(
  choice: VisualNovelChoice,
  variables: VisualNovelVariables,
): boolean {
  return (choice.conditions ?? []).every(condition =>
    evaluateVisualNovelCondition(condition, variables));
}

function applyVariableEffect(
  variables: VisualNovelVariables,
  effect: VisualNovelVariableEffect,
): VisualNovelValue {
  if (effect.operation === 'set') {
    variables[effect.variable] = effect.value;
    return effect.value;
  }
  const previous = variables[effect.variable];
  const rawNext = (typeof previous === 'number' && Number.isFinite(previous) ? previous : 0) + effect.value;
  const next = effect.clamp
    ? Math.min(effect.clamp.max, Math.max(effect.clamp.min, rawNext))
    : rawNext;
  variables[effect.variable] = next;
  return next;
}

function nodeMap(scene: VisualNovelScene): Map<string, VisualNovelNode> {
  return new Map(scene.nodes.map(node => [node.id, node]));
}

function visibleChoices(node: Extract<VisualNovelNode, { type: 'choice' }>, state: VisualNovelRuntimeState) {
  return node.choices
    .filter(choice => isVisualNovelChoiceAvailable(choice, state.variables))
    .map(({ id, text }) => ({ id, text }));
}

function enterNode(
  scene: VisualNovelScene,
  state: VisualNovelRuntimeState,
  startNodeId: string,
  initialCues: VisualNovelRuntimeCue[] = [],
): VisualNovelEvaluationResult {
  const byId = nodeMap(scene);
  const cues = [...initialCues];
  let nodeId = startNodeId;

  for (let traversed = 0; traversed < AUTO_NODE_LIMIT; traversed += 1) {
    const node = byId.get(nodeId);
    state.currentNodeId = nodeId;
    if (!node) return { ok: false, state, cues, error: `Unknown visual novel node "${nodeId}".` };
    state.visitedNodeIds.push(node.id);

    switch (node.type) {
      case 'variable': {
        const value = applyVariableEffect(state.variables, node.effect);
        cues.push({ type: 'variable', effect: node.effect, value });
        nodeId = node.next;
        break;
      }
      case 'transition':
        cues.push({ type: 'transition', node });
        nodeId = node.next;
        break;
      case 'audio':
        cues.push({ type: 'audio', node });
        nodeId = node.next;
        break;
      case 'dialogue':
        return { ok: true, state, cues, presentation: { type: 'dialogue', node } };
      case 'choice':
        return {
          ok: true,
          state,
          cues,
          presentation: { type: 'choice', prompt: node.prompt, choices: visibleChoices(node, state) },
        };
      case 'ending':
        state.endingId = node.endingId;
        return { ok: true, state, cues, presentation: { type: 'ending', node } };
    }
  }
  return { ok: false, state, cues, error: `Visual novel scene exceeded ${AUTO_NODE_LIMIT} automatic nodes.` };
}

export function startVisualNovelScene(
  content: VisualNovelContentV1,
  sceneId: string,
  variables: VisualNovelVariables = {},
  nodeId?: string,
): VisualNovelEvaluationResult {
  const scene = content.scenes[sceneId];
  const state: VisualNovelRuntimeState = {
    sceneId,
    currentNodeId: nodeId ?? scene?.entryNodeId ?? '',
    variables: { ...(scene?.initialVariables ?? {}), ...cloneVariables(variables) },
    visitedNodeIds: [],
    selectedChoiceIds: [],
  };
  if (!scene) return { ok: false, state, cues: [], error: `Unknown visual novel scene "${sceneId}".` };
  return enterNode(scene, state, nodeId ?? scene.entryNodeId);
}

/**
 * Restores a saved blocking node without replaying already-consumed audio,
 * transition, or variable nodes. Older/future saves that point at an automatic
 * node are advanced deterministically as a migration fallback.
 */
export function resumeVisualNovelScene(
  content: VisualNovelContentV1,
  sourceState: VisualNovelRuntimeState,
): VisualNovelEvaluationResult {
  const state: VisualNovelRuntimeState = {
    ...sourceState,
    variables: cloneVariables(sourceState.variables),
    visitedNodeIds: [...sourceState.visitedNodeIds],
    selectedChoiceIds: [...sourceState.selectedChoiceIds],
  };
  const scene = content.scenes[state.sceneId];
  if (!scene) return { ok: false, state, cues: [], error: `Unknown visual novel scene "${state.sceneId}".` };
  const node = nodeMap(scene).get(state.currentNodeId);
  if (!node) return { ok: false, state, cues: [], error: `Unknown visual novel node "${state.currentNodeId}".` };
  if (node.type === 'dialogue') {
    delete state.endingId;
    return { ok: true, state, cues: [], presentation: { type: 'dialogue', node } };
  }
  if (node.type === 'choice') {
    delete state.endingId;
    return {
      ok: true,
      state,
      cues: [],
      presentation: { type: 'choice', prompt: node.prompt, choices: visibleChoices(node, state) },
    };
  }
  if (node.type === 'ending') {
    state.endingId = node.endingId;
    return { ok: true, state, cues: [], presentation: { type: 'ending', node } };
  }
  delete state.endingId;
  return enterNode(scene, state, node.id);
}

export function evaluateVisualNovelAction(
  content: VisualNovelContentV1,
  sourceState: VisualNovelRuntimeState,
  action: VisualNovelAction,
): VisualNovelEvaluationResult {
  const state: VisualNovelRuntimeState = {
    ...sourceState,
    variables: cloneVariables(sourceState.variables),
    visitedNodeIds: [...sourceState.visitedNodeIds],
    selectedChoiceIds: [...sourceState.selectedChoiceIds],
  };
  const scene = content.scenes[state.sceneId];
  if (!scene) return { ok: false, state, cues: [], error: `Unknown visual novel scene "${state.sceneId}".` };
  if (state.endingId) return { ok: false, state, cues: [], error: `Visual novel scene already ended with "${state.endingId}".` };
  const node = nodeMap(scene).get(state.currentNodeId);
  if (!node) return { ok: false, state, cues: [], error: `Unknown visual novel node "${state.currentNodeId}".` };

  if (node.type === 'dialogue') {
    if (action.type !== 'advance') return { ok: false, state, cues: [], error: 'A dialogue node requires an advance action.' };
    if (!node.next) return { ok: false, state, cues: [], error: `Dialogue node "${node.id}" has no next node.` };
    return enterNode(scene, state, node.next);
  }
  if (node.type === 'choice') {
    if (action.type !== 'choose') return { ok: false, state, cues: [], error: 'A choice node requires a choose action.' };
    const choice = node.choices.find(candidate => candidate.id === action.choiceId);
    if (!choice) return { ok: false, state, cues: [], error: `Unknown choice "${action.choiceId}".` };
    if (!isVisualNovelChoiceAvailable(choice, state.variables)) {
      return { ok: false, state, cues: [], error: `Choice "${choice.id}" is not available.` };
    }
    const cues: VisualNovelRuntimeCue[] = [];
    for (const effect of choice.effects ?? []) {
      cues.push({ type: 'variable', effect, value: applyVariableEffect(state.variables, effect) });
    }
    state.selectedChoiceIds.push(choice.id);
    return enterNode(scene, state, choice.next, cues);
  }
  return { ok: false, state, cues: [], error: `Node "${node.id}" cannot wait for input.` };
}

export function validateVisualNovelContent(content: VisualNovelContentV1): VisualNovelValidationIssue[] {
  const issues: VisualNovelValidationIssue[] = [];
  if (content.schemaVersion !== 1) issues.push({ path: 'schemaVersion', message: 'Expected visual novel schemaVersion 1.' });
  for (const [sceneKey, scene] of Object.entries(content.scenes)) {
    const base = `scenes.${sceneKey}`;
    if (scene.id !== sceneKey) issues.push({ path: `${base}.id`, message: 'Scene id must match its registry key.' });
    const ids = new Set<string>();
    for (const [index, node] of scene.nodes.entries()) {
      const path = `${base}.nodes[${index}]`;
      if (!node.id.trim()) issues.push({ path: `${path}.id`, message: 'Node id must not be empty.' });
      if (ids.has(node.id)) issues.push({ path: `${path}.id`, message: `Duplicate node id "${node.id}".` });
      ids.add(node.id);
      if (node.type === 'choice') {
        const choiceIds = new Set<string>();
        for (const [choiceIndex, choice] of node.choices.entries()) {
          if (choiceIds.has(choice.id)) issues.push({ path: `${path}.choices[${choiceIndex}].id`, message: `Duplicate choice id "${choice.id}".` });
          choiceIds.add(choice.id);
        }
      }
      if (node.type === 'audio' && node.action === 'play' && !node.assetId) {
        issues.push({ path: `${path}.assetId`, message: 'Playing audio requires an assetId.' });
      }
      if (node.type === 'variable' && node.effect.operation === 'add' && node.effect.clamp
        && (!Number.isFinite(node.effect.clamp.min)
          || !Number.isFinite(node.effect.clamp.max)
          || node.effect.clamp.min > node.effect.clamp.max)) {
        issues.push({ path: `${path}.effect.clamp`, message: 'Variable clamp requires finite min <= max.' });
      }
      if (node.type === 'choice') {
        node.choices.forEach((choice, choiceIndex) => {
          (choice.effects ?? []).forEach((effect, effectIndex) => {
            if (effect.operation === 'add' && effect.clamp
              && (!Number.isFinite(effect.clamp.min)
                || !Number.isFinite(effect.clamp.max)
                || effect.clamp.min > effect.clamp.max)) {
              issues.push({
                path: `${path}.choices[${choiceIndex}].effects[${effectIndex}].clamp`,
                message: 'Variable clamp requires finite min <= max.',
              });
            }
          });
        });
      }
      if ('durationMs' in node && node.durationMs !== undefined && (!Number.isFinite(node.durationMs) || node.durationMs < 0)) {
        issues.push({ path: `${path}.durationMs`, message: 'Transition duration must be a finite non-negative number.' });
      }
    }
    if (!ids.has(scene.entryNodeId)) issues.push({ path: `${base}.entryNodeId`, message: `Unknown entry node "${scene.entryNodeId}".` });
    for (const [index, node] of scene.nodes.entries()) {
      const targets = node.type === 'choice' ? node.choices.map(choice => choice.next) : 'next' in node && node.next ? [node.next] : [];
      for (const target of targets) if (!ids.has(target)) issues.push({ path: `${base}.nodes[${index}]`, message: `Unknown next node "${target}".` });
    }
  }
  return issues;
}
