import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  approveQuestCandidate,
  buildQuestGenerationRequest,
  generateQuestCandidate,
  validateQuestCandidate,
} from '../questGenerationWorkflow';

const projectContext = {
  items: [
    { id: 'potion', name: 'Potion' },
    { id: 'elixir', name: 'Elixir' },
  ],
};

describe('questGenerationWorkflow', () => {
  it('builds a text-generation request for structured offline quest drafts', () => {
    const built = buildQuestGenerationRequest(
      {
        prompt: 'Generate a quest to slay 5 slimes and retrieve their gel.',
        questId: 'slime_hunter',
        questTitle: 'Slime Hunter',
      },
      projectContext,
      {
        requestId: 'quest-draft-1',
        createdAt: '2026-06-03T00:20:00.000Z',
      }
    );

    expect(built.request).toMatchObject({
      id: 'quest-draft-1',
      operation: 'text.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: '2026-06-03T00:20:00.000Z',
      input: {
        responseFormat: 'rpgcreatorai.questDraft.v1',
        fixture: 'quest-draft',
        questId: 'slime_hunter',
        questTitle: 'Slime Hunter',
        reviewRequired: true,
      },
    });
    expect(built.request.prompt).toContain('Slime Hunter');
    expect(JSON.stringify(built.request)).not.toMatch(/apiKey|https:\/\/api|sk-/i);
  });

  it('generates a pending editable quest candidate through a structured mock response', async () => {
    const candidate = await generateQuestCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Slay goblin leader',
        questId: 'goblin_slayer',
        questTitle: 'Goblin Slayer',
      },
      {
        requestId: 'quest-draft-goblin',
        createdAt: '2026-06-03T00:21:00.000Z',
      }
    );

    expect(candidate.reviewState).toBe('pending');
    expect(candidate.quest).toMatchObject({
      id: 'goblin_slayer',
      title: 'Goblin Slayer',
      summary: 'Slay goblin leader',
      objectives: [
        { id: 'explore_cave', description: 'Explore the dark cave' },
        { id: 'defeat_boss', description: 'Defeat the goblin leader' },
      ],
      rewards: {
        gold: 100,
        exp: 250,
        items: [{ itemId: 'potion', amount: 1 }],
      },
    });
    expect(validateQuestCandidate(candidate, projectContext)).toEqual([]);
  });

  it('rejects invalid structured quest drafts before approval', async () => {
    const candidate = await generateQuestCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Bad quest',
        questId: 'bad_quest',
        questTitle: 'Bad Quest',
      },
      {
        requestId: 'quest-draft-bad',
        createdAt: '2026-06-03T00:22:00.000Z',
        fixtureInvalidQuest: 'negative-rewards',
      }
    );

    const errors = validateQuestCandidate(candidate, projectContext);
    expect(errors).toContain('Reward gold must be a non-negative number');
  });

  it('requires explicit review before returning an approved editable quest', async () => {
    const candidate = await generateQuestCandidate(
      createMockProviderAdapter(),
      projectContext,
      {
        prompt: 'Help old man',
        questId: 'old_man_help',
        questTitle: 'Helping the Old Man',
      },
      {
        requestId: 'quest-draft-ok',
        createdAt: '2026-06-03T00:23:00.000Z',
      }
    );

    const approved = approveQuestCandidate(candidate, projectContext, {
      reviewedAt: '2026-06-03T00:24:00.000Z',
    });

    expect(approved.reviewState).toBe('approved');
    expect(approved.reviewedAt).toBe('2026-06-03T00:24:00.000Z');
    expect(approved.quest.id).toBe('old_man_help');
    expect(approved.provenance.reviewedAt).toBe('2026-06-03T00:24:00.000Z');
  });

  it('validates invalid quest fields, objectives, and reward item references', () => {
    const validCandidate = {
      reviewState: 'pending',
      quest: {
        id: 'valid_quest',
        title: 'Valid Quest',
        summary: 'A valid quest description',
        objectives: [
          { id: 'obj1', description: 'Do task 1' },
          { id: 'obj2', description: 'Do task 2' },
        ],
        rewards: {
          gold: 50,
          exp: 100,
          items: [{ itemId: 'potion', amount: 1 }],
        },
      },
    };

    expect(validateQuestCandidate(validCandidate, projectContext)).toEqual([]);

    // Missing title
    const invalidTitle = { ...validCandidate, quest: { ...validCandidate.quest, id: 'q', title: '', summary: '' } };
    expect(validateQuestCandidate(invalidTitle, projectContext)).toContain('Quest Title is required');

    // Negative gold
    const negativeGold = {
      ...validCandidate,
      quest: {
        ...validCandidate.quest,
        rewards: { ...validCandidate.quest.rewards, gold: -10 },
      },
    };
    expect(validateQuestCandidate(negativeGold, projectContext)).toContain('Reward gold must be a non-negative number');

    // Duplicate objective ID
    const dupObjectives = {
      ...validCandidate,
      quest: {
        ...validCandidate.quest,
        objectives: [
          { id: 'obj1', description: 'First' },
          { id: 'obj1', description: 'Second' },
        ],
      },
    };
    expect(validateQuestCandidate(dupObjectives, projectContext)).toContain('Duplicate objective ID "obj1" in quest draft');

    // Non-existent reward item
    const badRewardItem = {
      ...validCandidate,
      quest: {
        ...validCandidate.quest,
        rewards: {
          ...validCandidate.quest.rewards,
          items: [{ itemId: 'mega_potion', amount: 1 }],
        },
      },
    };
    expect(validateQuestCandidate(badRewardItem, projectContext)).toContain('Reward item "mega_potion" does not exist in project context');
  });
});
