import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveEventCommandsCandidate,
  buildEventCommandGenerationRequest,
  generateEventCommandsCandidate,
  validateEventCommandsCandidate,
} from '../eventCommandGenerationWorkflow';

const projectContext = {
  items: [
    { id: 'potion', name: 'Potion' },
    { id: 'elixir', name: 'Elixir' },
  ],
  mapIds: ['map_town', 'map_dungeon'],
};

describe('eventCommandGenerationWorkflow', () => {
  it('builds a text-generation request for structured offline event commands', () => {
    const built = buildEventCommandGenerationRequest(
      {
        prompt: 'Generate dialogue and give potion',
        targetEventId: 'guide_event',
      },
      projectContext,
      {
        requestId: 'event-gen-1',
        createdAt: '2026-06-03T00:30:00.000Z',
      }
    );

    expect(built.request).toMatchObject({
      id: 'event-gen-1',
      operation: 'text.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: '2026-06-03T00:30:00.000Z',
      input: {
        responseFormat: 'rpgcreatorai.eventCommandsDraft.v1',
        fixture: 'event-commands-draft',
        targetEventId: 'guide_event',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('dialogue and give potion');
  });

  it('generates a pending editable event commands candidate through mock response', async () => {
    const candidate = await generateEventCommandsCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Give potion',
        targetEventId: 'chest_event',
      },
      {
        requestId: 'event-gen-chest',
        createdAt: '2026-06-03T00:31:00.000Z',
      }
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.commands).toHaveLength(3);
    expect(candidate.commands[0]).toMatchObject({
      type: 'showText',
      speaker: 'Guide',
      text: 'Welcome to the adventure!',
    });
    expect(validateEventCommandsCandidate(candidate, projectContext)).toEqual([]);
  });

  it('rejects invalid command types before approval', async () => {
    const candidate = await generateEventCommandsCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Bad commands',
        targetEventId: 'test_event',
      },
      {
        requestId: 'event-gen-bad',
        createdAt: '2026-06-03T00:32:00.000Z',
        fixtureInvalidCommands: 'unknown-type',
      }
    );

    const errors = validateEventCommandsCandidate(candidate, projectContext);
    expect(errors).toContain('Command at index 1 has unknown type "invalid_command_type_xyz"');
  });

  it('rejects invalid map reference before approval', async () => {
    const candidate = await generateEventCommandsCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Teleport',
        targetEventId: 'portal_event',
      },
      {
        requestId: 'event-gen-teleport',
        createdAt: '2026-06-03T00:33:00.000Z',
        fixtureInvalidCommands: 'invalid-map-reference',
      }
    );

    const errors = validateEventCommandsCandidate(candidate, projectContext);
    expect(errors).toContain('Command at index 1 (transferMap) targets unknown map "non_existent_map_123"');
  });

  it('approves candidates with reviewedAt timestamp', async () => {
    const candidate = await generateEventCommandsCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Give item',
        targetEventId: 'merchant_event',
      },
      {
        requestId: 'event-gen-merchant',
        createdAt: '2026-06-03T00:34:00.000Z',
      }
    );

    const approved = approveEventCommandsCandidate(candidate, projectContext, {
      reviewedAt: '2026-06-03T00:35:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.reviewedAt).toBe('2026-06-03T00:35:00.000Z');
    expect(approved.provenance.reviewedAt).toBe('2026-06-03T00:35:00.000Z');
  });
});
