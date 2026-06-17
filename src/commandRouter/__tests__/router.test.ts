import { describe, expect, it } from 'vitest';
import {
  ROUTER_FIXTURES,
  isMutationIntentWithApplyablePreview,
  runRouterFixture,
  snapshotRouter,
} from '../routerTestFixtures';
import {
  hasApplyablePreview,
  isMutationIntent,
  isPreviewOnlyIntent,
  isReadOnlyIntent,
  nextIntentId,
  nextPreviewId,
  nextWriteIntentId,
  type ReadOnlyIntent,
  type PreviewTarget,
  type MutationIntent,
} from '../intentContract';
import {
  buildClarification,
  findOptionByPipeline,
  isAmbiguous,
  listClarificationOptions,
  scoreCompetingPipelines,
} from '../ambiguity';
import { isApplyable, mutationGuard, previewIsEquivalent } from '../previewContract';
import { routeCreatorRequest } from '../router';

describe('Command Router intent contract', () => {
  it('exposes stable factories for ids', () => {
    const a = nextIntentId('map-draft');
    const b = nextIntentId('map-draft');
    expect(a).not.toEqual(b);
    expect(nextPreviewId(a)).toMatch(/^preview-/);
    expect(nextWriteIntentId('map-draft')).toMatch(/^write-/);
  });

  it('type guards discriminate intent capability', () => {
    const a = nextIntentId('map-draft');
    const read: ReadOnlyIntent = {
      id: a,
      pipeline: 'map-draft',
      capability: 'read',
      confidence: 0.5,
      rationale: 'r',
      requiresProject: true,
      target: { projectId: 'p' },
    };
    expect(isReadOnlyIntent(read)).toBe(true);
    expect(isPreviewOnlyIntent(read)).toBe(false);
    expect(isMutationIntent(read)).toBe(false);
  });
});

describe('Command Router pipeline inference', () => {
  it('classifies a sprite-sheet request as asset-sprite-sheet', () => {
    expect(snapshotRouter('Generate a new character sprite sheet for the hero.').inferPipeline).toBe(
      'asset-sprite-sheet',
    );
  });

  it('prefers the more specific multi-word match on score ties', () => {
    // 'character' + 'hero' tie 'sprite sheet' + 'sprite'. The router should
    // pick the more specific multi-word pipeline instead of the first one
    // iterated.
    const snap = snapshotRouter('Generate a new character sprite sheet for the hero.');
    expect(snap.inferPipeline).toBe('asset-sprite-sheet');
  });

  it('prefers the longest single keyword when no multi-word matches are present', () => {
    // 'item' and 'skill' are both 4 chars. A message mentioning only "skill"
    // should still classify as database-draft, not icon generation.
    const snap = snapshotRouter('Add a new skill entry to my project.');
    expect(snap.inferPipeline).toBe('database-draft');
  });

  it('classifies a balancing request as balancing', () => {
    expect(snapshotRouter('Rebalance this enemy stats so it survives two hits.').inferPipeline).toBe(
      'balancing',
    );
  });

  it('classifies a read-only explanation as read', () => {
    expect(snapshotRouter('Explain the selected map.').inferCapability).toBe('read');
  });

  it('returns unsupported when no pipeline matches', () => {
    const snap = snapshotRouter('Help me with this project.');
    expect(snap.inferPipeline).toBe('unsupported');
  });
});

describe('Command Router ambiguity detection', () => {
  it('marks a vague request as ambiguous', () => {
    expect(isAmbiguous('Help me with this project.')).toBe(true);
  });

  it('does not mark a focused request as ambiguous', () => {
    expect(isAmbiguous('Rebalance this enemy stats so it survives two hits.')).toBe(false);
  });

  it('returns sorted pipeline hits', () => {
    const hits = scoreCompetingPipelines('Generate a new character sprite sheet for the hero.');
    expect(hits[0]?.hits).toBeGreaterThanOrEqual(hits[1]?.hits ?? 0);
  });

  it('exposes a complete clarification option list with stable ids', () => {
    const options = listClarificationOptions();
    expect(options.length).toBeGreaterThan(0);
    const ids = new Set(options.map((o) => o.id));
    expect(ids.size).toBe(options.length);
  });

  it('builds a clarification with all available options', () => {
    const clarification = buildClarification('Help me with this project.');
    expect(clarification.kind).toBe('clarification');
    expect(clarification.options.length).toBeGreaterThan(0);
  });

  it('finds an option by pipeline', () => {
    const option = findOptionByPipeline('asset-sprite-sheet');
    expect(option?.id).toBe('asset-character');
  });
});

describe('Command Router preview-before-apply guard', () => {
  it('blocks apply on a read intent', () => {
    const result = routeCreatorRequest({
      message: 'Explain the selected map.',
      projectId: 'project-1',
      selectedMapId: 'map-1',
    });
    if (result.kind !== 'intent') throw new Error('expected intent');
    expect(isApplyable(result.intent)).toBe(false);
  });

  it('blocks apply on a preview-only intent', () => {
    const result = routeCreatorRequest({
      message: 'Draft event commands for the selected event page.',
      projectId: 'project-1',
      selectedMapId: 'map-1',
      selectedEventId: 'event-1',
    });
    if (result.kind !== 'intent') throw new Error('expected intent');
    expect(isApplyable(result.intent)).toBe(false);
  });

  it('allows apply on a mutation intent that carries a valid preview', () => {
    const result = routeCreatorRequest({
      message: 'Rebalance this enemy stats so it survives two hits.',
      projectId: 'project-1',
    });
    if (result.kind !== 'intent') throw new Error('expected intent');
    expect(isApplyable(result.intent)).toBe(true);
    expect(isMutationIntentWithApplyablePreview(result.intent)).toBe(true);
  });

  it('returns reasons and fix guidance when the guard fails', () => {
    const target: PreviewTarget = { kind: 'project', projectId: 'p' };
    const guard = mutationGuard({
      id: 'intent-1',
      pipeline: 'map-draft',
      capability: 'mutation',
      confidence: 0.5,
      rationale: 'r',
      requiresProject: true,
      target,
      preview: {
        previewId: 'p1',
        invalid: true,
        reasons: ['broken reference'],
        fixGuidance: ['replace the tileset id'],
      },
      writeIntentId: 'w1',
    } as unknown as MutationIntent);
    expect(guard.ok).toBe(false);
    expect(guard.reasons.length).toBeGreaterThan(0);
    expect(guard.fixGuidance.length).toBeGreaterThan(0);
  });

  it('reports hasApplyablePreview for valid previews', () => {
    const target: PreviewTarget = { kind: 'project', projectId: 'p' };
    const intent: MutationIntent = {
      id: 'i1',
      pipeline: 'map-draft',
      capability: 'mutation',
      confidence: 0.5,
      rationale: 'r',
      requiresProject: true,
      target,
      preview: { previewId: 'p1', title: 't', summary: 's', payload: {} },
      writeIntentId: 'w1',
    };
    expect(hasApplyablePreview(intent)).toBe(true);
  });

  it('compares previews by id only', () => {
    expect(
      previewIsEquivalent(
        { previewId: 'a', title: 't', summary: 's', payload: {} },
        { previewId: 'a', title: 't', summary: 'different', payload: { x: 1 } },
      ),
    ).toBe(true);
  });
});

describe('Command Router end-to-end fixtures', () => {
  for (const fixture of ROUTER_FIXTURES) {
    it(`fixture ${fixture.id} routes as expected`, () => {
      const outcome = runRouterFixture(fixture);
      expect(outcome.reasons, outcome.reasons.join('; ')).toEqual([]);
      expect(outcome.pass).toBe(true);
    });
  }
});
