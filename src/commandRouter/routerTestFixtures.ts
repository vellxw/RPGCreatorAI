/**
 * Phase 12 M03 — Command Router Intent Contract Fixtures (PX-056 / PX-081 / PX-082).
 *
 * Deterministic test fixtures that exercise the intent contract, the ambiguity
 * detector, the preview-before-apply guard, and the router end-to-end without
 * any live AI provider or filesystem access.
 */

import { routeCreatorRequest, type CommandRouterResult } from './router';
import type { CommandRouterIntent } from './intentContract';
import {
  computeConfidence,
  hasApplyablePreview,
  inferCapability,
  inferPipeline,
  isMutationIntent,
} from './intentContract';
import {
  buildClarification,
  isAmbiguous,
  scoreCompetingPipelines,
} from './ambiguity';
import { isApplyable, mutationGuard } from './previewContract';

export const ROUTER_TEST_FIXTURES_VERSION = '1.0.0';

export interface RouterFixture {
  id: string;
  message: string;
  input: Parameters<typeof routeCreatorRequest>[0];
  expectedPipeline: string;
  expectedCapability: 'read' | 'preview' | 'mutation';
  expectClarification: boolean;
  expectApplyable: boolean;
}

export const ROUTER_FIXTURES: readonly RouterFixture[] = [
  {
    id: 'fx-read-map-summary',
    message: 'Explain the selected map.',
    input: { message: 'Explain the selected map.', projectId: 'project-1', selectedMapId: 'map-1' },
    expectedPipeline: 'map-draft',
    expectedCapability: 'read',
    expectClarification: false,
    expectApplyable: false,
  },
  {
    id: 'fx-preview-event',
    message: 'Draft event commands for the selected event page.',
    input: {
      message: 'Draft event commands for the selected event page.',
      projectId: 'project-1',
      selectedMapId: 'map-1',
      selectedEventId: 'event-1',
    },
    expectedPipeline: 'event-draft',
    expectedCapability: 'preview',
    expectClarification: false,
    expectApplyable: false,
  },
  {
    id: 'fx-mutation-balancing',
    message: 'Rebalance this enemy stats so it survives two hits.',
    input: { message: 'Rebalance this enemy stats so it survives two hits.', projectId: 'project-1' },
    expectedPipeline: 'balancing',
    expectedCapability: 'mutation',
    expectClarification: false,
    expectApplyable: true,
  },
  {
    id: 'fx-ambiguous-help',
    message: 'Help me with this project.',
    input: { message: 'Help me with this project.', projectId: 'project-1' },
    expectedPipeline: 'unsupported',
    expectedCapability: 'read',
    expectClarification: true,
    expectApplyable: false,
  },
  {
    id: 'fx-no-project',
    message: 'Generate a new map outline.',
    input: { message: 'Generate a new map outline.', projectId: null },
    expectedPipeline: 'unsupported',
    expectedCapability: 'read',
    expectClarification: true,
    expectApplyable: false,
  },
  {
    id: 'fx-mutation-asset-sprite',
    message: 'Generate a new character sprite sheet for the hero.',
    input: { message: 'Generate a new character sprite sheet for the hero.', projectId: 'project-1' },
    expectedPipeline: 'asset-sprite-sheet',
    expectedCapability: 'mutation',
    expectClarification: false,
    expectApplyable: true,
  },
];

export function runRouterFixture(fixture: RouterFixture): {
  fixture: RouterFixture;
  result: CommandRouterResult;
  pass: boolean;
  reasons: string[];
} {
  const result = routeCreatorRequest(fixture.input);
  const reasons: string[] = [];
  if (fixture.expectClarification) {
    if (result.kind !== 'clarification') {
      reasons.push(`Expected clarification, got ${result.kind}`);
    }
  } else {
    if (result.kind !== 'intent') {
      reasons.push(`Expected intent, got ${result.kind}`);
      return { fixture, result, pass: false, reasons };
    }
    const intent = result.intent;
    if (intent.pipeline !== fixture.expectedPipeline) {
      reasons.push(`Pipeline ${intent.pipeline} != ${fixture.expectedPipeline}`);
    }
    if (intent.capability !== fixture.expectedCapability) {
      reasons.push(`Capability ${intent.capability} != ${fixture.expectedCapability}`);
    }
    if (fixture.expectApplyable) {
      if (!isApplyable(intent)) {
        reasons.push('Expected applyable mutation intent');
      }
    } else if (isMutationIntent(intent) && !fixture.expectApplyable) {
      reasons.push('Unexpected mutation intent with applyable preview');
    }
  }
  return { fixture, result, pass: reasons.length === 0, reasons };
}

export interface RouterSnapshot {
  inferPipelineMessage: string;
  inferPipeline: string;
  inferCapability: string;
  confidence: number;
  isAmbiguous: boolean;
  competition: ReadonlyArray<{ pipeline: string; hits: number }>;
}

export function snapshotRouter(message: string): RouterSnapshot {
  const pipeline = inferPipeline(message);
  return {
    inferPipelineMessage: message,
    inferPipeline: pipeline,
    inferCapability: inferCapability(message, pipeline),
    confidence: computeConfidence(message, pipeline),
    isAmbiguous: isAmbiguous(message),
    competition: scoreCompetingPipelines(message),
  };
}

export function isMutationIntentWithApplyablePreview(intent: CommandRouterIntent): boolean {
  return isMutationIntent(intent) && hasApplyablePreview(intent) && mutationGuard(intent).ok;
}

export { buildClarification };
