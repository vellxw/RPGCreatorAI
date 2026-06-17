/**
 * Phase 12 M03 — Command Router (PX-056, FRA-490 / PX-081 / PX-082).
 *
 * Maps a free-form creator message into either:
 * - a typed intent (read / preview / mutation), or
 * - a clarification request when the request is too ambiguous.
 *
 * Mutation intents always carry a preview and a stable writeIntentId. The
 * apply step lives outside this module; callers must run `mutationGuard`
 * before applying.
 */

import {
  buildRationale,
  computeConfidence,
  inferCapability,
  inferPipeline,
  nextIntentId,
  nextPreviewId,
  nextWriteIntentId,
  type CommandRouterIntent,
  type MutationIntent,
  type PreviewOnlyIntent,
  type PreviewTarget,
  type ReadOnlyIntent,
} from './intentContract';
import {
  buildClarification,
  isAmbiguous,
  type CommandRouterClarification,
} from './ambiguity';

export type CommandRouterResult =
  | { kind: 'intent'; intent: CommandRouterIntent }
  | { kind: 'clarification'; clarification: CommandRouterClarification };

export interface CommandRouterInput {
  message: string;
  projectId: string | null;
  selectedMapId?: string;
  selectedEventId?: string;
  selectedDatabaseTable?: string;
  selectedRecordId?: string;
}

export function routeCreatorRequest(input: CommandRouterInput): CommandRouterResult {
  const { message, projectId } = input;
  if (!projectId) {
    return {
      kind: 'clarification',
      clarification: {
        kind: 'clarification',
        question: 'Open or create a project to use AI Studio commands.',
        options: [],
        contextMessage: message,
      },
    };
  }

  if (isAmbiguous(message)) {
    return { kind: 'clarification', clarification: buildClarification(message) };
  }

  const pipeline = inferPipeline(message);
  if (pipeline === 'unsupported') {
    return { kind: 'clarification', clarification: buildClarification(message) };
  }

  const capability = inferCapability(message, pipeline);
  const confidence = computeConfidence(message, pipeline);
  const rationale = buildRationale(message, pipeline, capability);
  const id = nextIntentId(pipeline);
  const baseTarget: PreviewTarget = pickTarget(input);

  if (capability === 'read') {
    const intent: ReadOnlyIntent = {
      id,
      pipeline,
      capability: 'read',
      confidence,
      rationale,
      requiresProject: true,
      target: {
        projectId,
        mapId: input.selectedMapId,
        eventId: input.selectedEventId,
        databaseTable: input.selectedDatabaseTable,
        recordId: input.selectedRecordId,
      },
    };
    return { kind: 'intent', intent };
  }

  if (capability === 'preview') {
    const intent: PreviewOnlyIntent = {
      id,
      pipeline,
      capability: 'preview',
      confidence,
      rationale,
      requiresProject: true,
      target: baseTarget,
      preview: {
        previewId: nextPreviewId(id),
        title: humanTitle(pipeline),
        summary: humanSummary(pipeline),
        payload: derivePayload(pipeline, input),
      },
    };
    return { kind: 'intent', intent };
  }

  const intent: MutationIntent = {
    id,
    pipeline,
    capability: 'mutation',
    confidence,
    rationale,
    requiresProject: true,
    target: baseTarget,
    preview: {
      previewId: nextPreviewId(id),
      title: humanTitle(pipeline),
      summary: humanSummary(pipeline),
      payload: derivePayload(pipeline, input),
    },
    writeIntentId: nextWriteIntentId(pipeline),
  };
  return { kind: 'intent', intent };
}

function pickTarget(input: CommandRouterInput): PreviewTarget {
  if (input.selectedMapId && input.selectedEventId) {
    return { kind: 'event', projectId: input.projectId ?? '', mapId: input.selectedMapId, eventId: input.selectedEventId };
  }
  if (input.selectedMapId) {
    return { kind: 'map', projectId: input.projectId ?? '', mapId: input.selectedMapId };
  }
  if (input.selectedDatabaseTable) {
    return {
      kind: 'database',
      projectId: input.projectId ?? '',
      table: input.selectedDatabaseTable,
      recordId: input.selectedRecordId,
    };
  }
  return { kind: 'project', projectId: input.projectId ?? '' };
}

function derivePayload(pipeline: string, input: CommandRouterInput): Record<string, unknown> {
  return {
    pipeline,
    mapId: input.selectedMapId,
    eventId: input.selectedEventId,
    databaseTable: input.selectedDatabaseTable,
    recordId: input.selectedRecordId,
  };
}

function humanTitle(pipeline: string): string {
  return `Draft ${pipeline.replace(/-/g, ' ')}`;
}

function humanSummary(pipeline: string): string {
  return `Preview the proposed ${pipeline.replace(/-/g, ' ')} before applying it to the project.`;
}
