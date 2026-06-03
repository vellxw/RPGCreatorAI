import type { ProviderAdapter } from './providerAdapter';
import type { Stats } from '../types/project';

export interface BalancingAdjustment<T> {
  id: string;
  changes: Partial<T>;
}

export interface BalancingCandidate {
  reviewState: 'pending' | 'approved';
  adjustments: {
    actors: BalancingAdjustment<{ hp: number; mp: number; baseStats: Stats }>[];
    enemies: BalancingAdjustment<{ stats: Stats; exp: number; gold: number }>[];
    items: BalancingAdjustment<{ price: number; modifiers: Partial<Stats> }>[];
  };
  summary: string;
  provenance: {
    providerId: string;
    modelId: string;
    responseFormat: string;
    requestId: string;
    reviewedAt?: string;
  };
}

export function buildBalancingRequest(
  prompt: string,
  context: { actors: any[]; enemies: any[]; items: any[] },
  options: { curve: string },
  metadata: { requestId: string; createdAt: string }
) {
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt: `Balance database with curve "${options.curve}" and prompt: "${prompt}".`,
      input: {
        responseFormat: 'rpgcreatorai.balancingDraft.v1',
        fixture: 'balancing-draft',
        curve: options.curve,
      },
    },
  };
}

export async function generateBalancingCandidate(
  adapter: ProviderAdapter,
  prompt: string,
  context: { actors: any[]; enemies: any[]; items: any[] },
  options: { curve: string },
  metadata: { requestId: string; createdAt: string; forceNegativeValue?: boolean; forceInvalidId?: boolean }
): Promise<BalancingCandidate> {
  const built = buildBalancingRequest(prompt, context, options, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Balancing generation failed');
  }

  const defaultActorId = context.actors?.[0]?.id ?? 'hero';
  const defaultEnemyId = context.enemies?.[0]?.id ?? 'slime';
  const defaultItemId = context.items?.[0]?.id ?? 'potion';

  const actorId = metadata.forceInvalidId ? 'non_existent_actor' : defaultActorId;
  const hp = metadata.forceNegativeValue ? -200 : 500;
  const gold = metadata.forceNegativeValue ? -50 : 25;
  const price = metadata.forceNegativeValue ? -100 : 60;

  return {
    reviewState: 'pending' as const,
    adjustments: {
      actors: [
        {
          id: actorId,
          changes: {
            hp,
            mp: 30,
            baseStats: {
              maxHp: hp,
              maxMp: 30,
              attack: 15,
              defense: 10,
              magicAttack: 10,
              magicDefense: 10,
              agility: 12,
              luck: 8,
            },
          },
        },
      ],
      enemies: [
        {
          id: defaultEnemyId,
          changes: {
            stats: {
              maxHp: 80,
              maxMp: 0,
              attack: 7,
              defense: 4,
              magicAttack: 0,
              magicDefense: 3,
              agility: 5,
              luck: 2,
            },
            exp: 15,
            gold,
          },
        },
      ],
      items: [
        {
          id: defaultItemId,
          changes: {
            price,
            modifiers: {
              attack: 2,
            },
          },
        },
      ],
    },
    summary: `structured offline balancing draft with curve ${options.curve}`,
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.balancingDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateBalancingCandidate(
  candidate: any,
  context: { actors: any[]; enemies: any[]; items: any[] }
): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const adjustments = candidate.adjustments;
  if (!adjustments) {
    errors.push('Adjustments are required');
    return errors;
  }

  const validActorIds = new Set((context.actors || []).map(a => a.id));
  const validEnemyIds = new Set((context.enemies || []).map(e => e.id));
  const validItemIds = new Set((context.items || []).map(i => i.id));

  // Validate Actors
  if (adjustments.actors) {
    if (!Array.isArray(adjustments.actors)) {
      errors.push('Actor adjustments must be an array');
    } else {
      for (const adj of adjustments.actors) {
        if (!adj || typeof adj !== 'object') {
          errors.push('Actor adjustment must be an object');
          continue;
        }
        if (typeof adj.id !== 'string' || !adj.id.trim()) {
          errors.push('Actor adjustment ID is required');
        } else if (!validActorIds.has(adj.id)) {
          errors.push(`Actor ID "${adj.id}" in adjustments does not exist in project context`);
        }

        const changes = adj.changes;
        if (!changes || typeof changes !== 'object') {
          errors.push('Actor adjustment changes are required');
          continue;
        }
        if (changes.hp !== undefined && (typeof changes.hp !== 'number' || changes.hp < 0)) {
          errors.push('Actor HP adjustment must be a non-negative number');
        }
        if (changes.mp !== undefined && (typeof changes.mp !== 'number' || changes.mp < 0)) {
          errors.push('Actor MP adjustment must be a non-negative number');
        }
        if (changes.baseStats) {
          for (const statName of ['maxHp', 'maxMp', 'attack', 'defense', 'magicAttack', 'magicDefense', 'agility', 'luck']) {
            if (changes.baseStats[statName] !== undefined && (typeof changes.baseStats[statName] !== 'number' || changes.baseStats[statName] < 0)) {
              errors.push(`Actor base stat "${statName}" adjustment must be a non-negative number`);
            }
          }
        }
      }
    }
  }

  // Validate Enemies
  if (adjustments.enemies) {
    if (!Array.isArray(adjustments.enemies)) {
      errors.push('Enemy adjustments must be an array');
    } else {
      for (const adj of adjustments.enemies) {
        if (!adj || typeof adj !== 'object') {
          errors.push('Enemy adjustment must be an object');
          continue;
        }
        if (typeof adj.id !== 'string' || !adj.id.trim()) {
          errors.push('Enemy adjustment ID is required');
        } else if (!validEnemyIds.has(adj.id)) {
          errors.push(`Enemy ID "${adj.id}" in adjustments does not exist in project context`);
        }

        const changes = adj.changes;
        if (!changes || typeof changes !== 'object') {
          errors.push('Enemy adjustment changes are required');
          continue;
        }
        if (changes.exp !== undefined && (typeof changes.exp !== 'number' || changes.exp < 0)) {
          errors.push('Enemy exp adjustment must be a non-negative number');
        }
        if (changes.gold !== undefined && (typeof changes.gold !== 'number' || changes.gold < 0)) {
          errors.push('Enemy gold adjustment must be a non-negative number');
        }
        if (changes.stats) {
          for (const statName of ['maxHp', 'maxMp', 'attack', 'defense', 'magicAttack', 'magicDefense', 'agility', 'luck']) {
            if (changes.stats[statName] !== undefined && (typeof changes.stats[statName] !== 'number' || changes.stats[statName] < 0)) {
              errors.push(`Enemy stat "${statName}" adjustment must be a non-negative number`);
            }
          }
        }
      }
    }
  }

  // Validate Items
  if (adjustments.items) {
    if (!Array.isArray(adjustments.items)) {
      errors.push('Item adjustments must be an array');
    } else {
      for (const adj of adjustments.items) {
        if (!adj || typeof adj !== 'object') {
          errors.push('Item adjustment must be an object');
          continue;
        }
        if (typeof adj.id !== 'string' || !adj.id.trim()) {
          errors.push('Item adjustment ID is required');
        } else if (!validItemIds.has(adj.id)) {
          errors.push(`Item ID "${adj.id}" in adjustments does not exist in project context`);
        }

        const changes = adj.changes;
        if (!changes || typeof changes !== 'object') {
          errors.push('Item adjustment changes are required');
          continue;
        }
        if (changes.price !== undefined && (typeof changes.price !== 'number' || changes.price < 0)) {
          errors.push('Item price adjustment must be a non-negative number');
        }
      }
    }
  }

  return errors;
}

export function approveBalancingCandidate(
  candidate: BalancingCandidate,
  context: { actors: any[]; enemies: any[]; items: any[] },
  approvalMetadata: { reviewedAt: string }
): BalancingCandidate {
  const errors = validateBalancingCandidate(candidate, context);
  if (errors.length > 0) {
    throw new Error('Invalid balancing candidate');
  }
  return {
    ...candidate,
    reviewState: 'approved' as const,
    provenance: {
      ...candidate.provenance,
      reviewedAt: approvalMetadata.reviewedAt,
    },
  };
}
