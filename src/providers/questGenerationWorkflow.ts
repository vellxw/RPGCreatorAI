import type { ProviderAdapter } from './providerAdapter';

export function buildQuestGenerationRequest(
  options: { prompt: string; questId: string; questTitle: string },
  context: { items: any[] },
  metadata: { requestId: string; createdAt: string }
) {
  const prompt = `Generate quest with title: "${options.questTitle}" and prompt: "${options.prompt}".`;
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt,
      input: {
        responseFormat: 'rpgcreatorai.questDraft.v1',
        fixture: 'quest-draft',
        questId: options.questId,
        questTitle: options.questTitle,
        reviewRequired: true,
      },
    },
  };
}

export async function generateQuestCandidate(
  adapter: ProviderAdapter,
  context: { items: any[] },
  options: { prompt: string; questId: string; questTitle: string },
  metadata: { requestId: string; createdAt: string; fixtureInvalidQuest?: string }
) {
  const built = buildQuestGenerationRequest(options, context, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Quest generation failed');
  }

  if (metadata.fixtureInvalidQuest === 'negative-rewards') {
    return {
      reviewState: 'pending' as const,
      quest: {
        id: options.questId,
        title: options.questTitle,
        summary: options.prompt,
        objectives: [
          { id: 'gather_wood', description: 'Gather 5 pieces of firewood' }
        ],
        rewards: {
          gold: -50,
          exp: 100,
          items: []
        }
      },
      summary: 'structured offline quest draft candidate with invalid rewards',
      provenance: {
        providerId: 'local',
        modelId: 'offline-mock',
        responseFormat: 'rpgcreatorai.questDraft.v1',
        requestId: metadata.requestId,
      }
    };
  }

  if (metadata.fixtureInvalidQuest === 'invalid-reward-item') {
    return {
      reviewState: 'pending' as const,
      quest: {
        id: options.questId,
        title: options.questTitle,
        summary: options.prompt,
        objectives: [
          { id: 'gather_wood', description: 'Gather 5 pieces of firewood' }
        ],
        rewards: {
          gold: 50,
          exp: 100,
          items: [
            { itemId: 'non_existent_item_id', amount: 1 }
          ]
        }
      },
      summary: 'structured offline quest draft candidate with invalid reward items',
      provenance: {
        providerId: 'local',
        modelId: 'offline-mock',
        responseFormat: 'rpgcreatorai.questDraft.v1',
        requestId: metadata.requestId,
      }
    };
  }

  const firstItemId = context.items?.[0]?.id ?? 'potion';
  return {
    reviewState: 'pending' as const,
    quest: {
      id: options.questId,
      title: options.questTitle,
      summary: options.prompt,
      objectives: [
        { id: 'explore_cave', description: 'Explore the dark cave' },
        { id: 'defeat_boss', description: 'Defeat the goblin leader' }
      ],
      rewards: {
        gold: 100,
        exp: 250,
        items: [
          { itemId: firstItemId, amount: 1 }
        ]
      }
    },
    summary: 'structured offline quest draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.questDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateQuestCandidate(candidate: any, context: { items: any[] }): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const quest = candidate.quest;
  if (!quest) {
    errors.push('Quest data is required');
    return errors;
  }
  if (typeof quest.id !== 'string' || !quest.id.trim()) {
    errors.push('Quest ID is required');
  }
  if (typeof quest.title !== 'string' || !quest.title.trim()) {
    errors.push('Quest Title is required');
  }
  if (typeof quest.summary !== 'string') {
    errors.push('Quest Summary must be a string');
  }

  // Objectives validation
  if (!Array.isArray(quest.objectives)) {
    errors.push('Quest objectives must be an array');
  } else {
    const seenIds = new Set<string>();
    for (const obj of quest.objectives) {
      if (!obj || typeof obj !== 'object') {
        errors.push('Objective must be an object');
        continue;
      }
      if (typeof obj.id !== 'string' || !obj.id.trim()) {
        errors.push('Objective ID is required');
      } else {
        if (seenIds.has(obj.id)) {
          errors.push(`Duplicate objective ID "${obj.id}" in quest draft`);
        }
        seenIds.add(obj.id);
      }
      if (typeof obj.description !== 'string' || !obj.description.trim()) {
        errors.push('Objective description is required');
      }
    }
  }

  // Rewards validation
  if (!quest.rewards || typeof quest.rewards !== 'object') {
    errors.push('Quest rewards are required');
  } else {
    const rewards = quest.rewards;
    if (typeof rewards.gold !== 'number' || rewards.gold < 0) {
      errors.push('Reward gold must be a non-negative number');
    }
    if (typeof rewards.exp !== 'number' || rewards.exp < 0) {
      errors.push('Reward exp must be a non-negative number');
    }
    if (!Array.isArray(rewards.items)) {
      errors.push('Reward items must be an array');
    } else {
      const validItemIds = new Set((context.items || []).map(item => item.id));
      for (const itemReward of rewards.items) {
        if (!itemReward || typeof itemReward !== 'object') {
          errors.push('Reward item must be an object');
          continue;
        }
        if (typeof itemReward.itemId !== 'string' || !itemReward.itemId.trim()) {
          errors.push('Reward itemId is required');
        } else if (!validItemIds.has(itemReward.itemId)) {
          errors.push(`Reward item "${itemReward.itemId}" does not exist in project context`);
        }
        if (typeof itemReward.amount !== 'number' || itemReward.amount <= 0) {
          errors.push('Reward item amount must be a positive number');
        }
      }
    }
  }

  return errors;
}

export function approveQuestCandidate(
  candidate: any,
  context: { items: any[] },
  approvalMetadata: { reviewedAt: string }
) {
  const errors = validateQuestCandidate(candidate, context);
  if (errors.length > 0) {
    throw new Error('Invalid candidate');
  }
  return {
    ...candidate,
    reviewState: 'approved' as const,
    reviewedAt: approvalMetadata.reviewedAt,
    provenance: {
      ...candidate.provenance,
      reviewedAt: approvalMetadata.reviewedAt,
    },
  };
}
