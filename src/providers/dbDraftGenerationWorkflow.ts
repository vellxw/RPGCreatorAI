import type { ProviderAdapter } from './providerAdapter';
import type { Stats, ActorData, EnemyData, ItemData } from '../types/project';

export function buildDbDraftGenerationRequest(
  kind: 'actor' | 'enemy' | 'item',
  prompt: string,
  options: { id: string; name: string },
  metadata: { requestId: string; createdAt: string }
) {
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt: `Generate ${kind} with id: "${options.id}", name: "${options.name}" and prompt: "${prompt}".`,
      input: {
        responseFormat: `rpgcreatorai.${kind}Draft.v1`,
        fixture: `${kind}-draft`,
        id: options.id,
        name: options.name,
      },
    },
  };
}

export async function generateActorDraftCandidate(
  adapter: ProviderAdapter,
  prompt: string,
  context: { classes: any[] },
  options: { actorId: string; actorName: string },
  metadata: { requestId: string; createdAt: string; forceInvalidClass?: boolean; forceNegativeStats?: boolean }
) {
  const built = buildDbDraftGenerationRequest('actor', prompt, { id: options.actorId, name: options.actorName }, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Actor generation failed');
  }

  const defaultClassId = context.classes?.[0]?.id ?? 'hero';
  const classId = metadata.forceInvalidClass ? 'invalid_class_id' : defaultClassId;
  const hp = metadata.forceNegativeStats ? -100 : 450;

  return {
    reviewState: 'pending' as const,
    actor: {
      id: options.actorId,
      name: options.actorName,
      classId,
      level: 1,
      hp,
      mp: 20,
      baseStats: {
        maxHp: hp,
        maxMp: 20,
        attack: 12,
        defense: 8,
        magicAttack: 15,
        magicDefense: 10,
        agility: 11,
        luck: 9,
      },
      equipment: {
        weapon: null,
        armor: null,
        accessory: null,
      },
      skills: [],
    },
    summary: 'structured offline actor draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.actorDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateActorCandidate(candidate: any, context: { classes: any[] }): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const actor = candidate.actor;
  if (!actor) {
    errors.push('Actor data is required');
    return errors;
  }
  if (typeof actor.id !== 'string' || !actor.id.trim()) {
    errors.push('Actor ID is required');
  }
  if (typeof actor.name !== 'string' || !actor.name.trim()) {
    errors.push('Actor Name is required');
  }
  if (typeof actor.level !== 'number' || actor.level <= 0) {
    errors.push('Actor level must be a positive number');
  }
  if (typeof actor.hp !== 'number' || actor.hp < 0) {
    errors.push('Actor HP must be a non-negative number');
  }
  if (typeof actor.mp !== 'number' || actor.mp < 0) {
    errors.push('Actor MP must be a non-negative number');
  }

  const validClassIds = new Set((context.classes || []).map(cls => cls.id));
  if (actor.classId && !validClassIds.has(actor.classId)) {
    errors.push(`Actor Class ID "${actor.classId}" does not exist in project context`);
  }

  if (!actor.baseStats || typeof actor.baseStats !== 'object') {
    errors.push('Actor baseStats is required');
  } else {
    const stats = actor.baseStats;
    for (const statName of ['maxHp', 'maxMp', 'attack', 'defense', 'magicAttack', 'magicDefense', 'agility', 'luck']) {
      if (typeof stats[statName] !== 'number' || stats[statName] < 0) {
        errors.push(`Base stat "${statName}" must be a non-negative number`);
      }
    }
  }

  return errors;
}

export async function generateEnemyDraftCandidate(
  adapter: ProviderAdapter,
  prompt: string,
  context: { items: any[] },
  options: { enemyId: string; enemyName: string },
  metadata: { requestId: string; createdAt: string; forceInvalidDropItem?: boolean; forceNegativeRewards?: boolean }
) {
  const built = buildDbDraftGenerationRequest('enemy', prompt, { id: options.enemyId, name: options.enemyName }, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Enemy generation failed');
  }

  const defaultItemId = context.items?.[0]?.id ?? 'potion';
  const itemId = metadata.forceInvalidDropItem ? 'invalid_item_id' : defaultItemId;
  const exp = metadata.forceNegativeRewards ? -10 : 35;

  return {
    reviewState: 'pending' as const,
    enemy: {
      id: options.enemyId,
      name: options.enemyName,
      stats: {
        maxHp: 150,
        maxMp: 0,
        attack: 10,
        defense: 5,
        magicAttack: 0,
        magicDefense: 4,
        agility: 8,
        luck: 3,
      },
      exp,
      gold: 20,
      drops: [
        { itemId, rate: 0.5 },
      ],
    },
    summary: 'structured offline enemy draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.enemyDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateEnemyCandidate(candidate: any, context: { items: any[] }): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const enemy = candidate.enemy;
  if (!enemy) {
    errors.push('Enemy data is required');
    return errors;
  }
  if (typeof enemy.id !== 'string' || !enemy.id.trim()) {
    errors.push('Enemy ID is required');
  }
  if (typeof enemy.name !== 'string' || !enemy.name.trim()) {
    errors.push('Enemy Name is required');
  }
  if (typeof enemy.exp !== 'number' || enemy.exp < 0) {
    errors.push('Enemy exp reward must be a non-negative number');
  }
  if (typeof enemy.gold !== 'number' || enemy.gold < 0) {
    errors.push('Enemy gold reward must be a non-negative number');
  }

  if (!enemy.stats || typeof enemy.stats !== 'object') {
    errors.push('Enemy stats is required');
  } else {
    const stats = enemy.stats;
    for (const statName of ['maxHp', 'maxMp', 'attack', 'defense', 'magicAttack', 'magicDefense', 'agility', 'luck']) {
      if (typeof stats[statName] !== 'number' || stats[statName] < 0) {
        errors.push(`Enemy stat "${statName}" must be a non-negative number`);
      }
    }
  }

  if (enemy.drops) {
    if (!Array.isArray(enemy.drops)) {
      errors.push('Enemy drops must be an array');
    } else {
      const validItemIds = new Set((context.items || []).map(item => item.id));
      for (const drop of enemy.drops) {
        if (!drop || typeof drop !== 'object') {
          errors.push('Enemy drop must be an object');
          continue;
        }
        if (typeof drop.itemId !== 'string' || !drop.itemId.trim()) {
          errors.push('Enemy drop itemId is required');
        } else if (!validItemIds.has(drop.itemId)) {
          errors.push(`Enemy drop item "${drop.itemId}" does not exist in project context`);
        }
        if (typeof drop.rate !== 'number' || drop.rate < 0 || drop.rate > 1) {
          errors.push('Enemy drop rate must be a number between 0 and 1');
        }
      }
    }
  }

  return errors;
}

export async function generateItemDraftCandidate(
  adapter: ProviderAdapter,
  prompt: string,
  context: { categories: string[]; slots: string[] },
  options: { itemId: string; itemName: string },
  metadata: { requestId: string; createdAt: string; forceInvalidCategory?: boolean; forceNegativePrice?: boolean }
) {
  const built = buildDbDraftGenerationRequest('item', prompt, { id: options.itemId, name: options.itemName }, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Item generation failed');
  }

  const category = metadata.forceInvalidCategory ? 'invalid_category' : (context.categories?.[0] ?? 'consumable');
  const price = metadata.forceNegativePrice ? -15 : 50;

  return {
    reviewState: 'pending' as const,
    item: {
      id: options.itemId,
      name: options.itemName,
      description: prompt,
      type: category,
      price,
      effect: {
        hp: 50,
        mp: 0,
      },
      modifiers: {},
    },
    summary: 'structured offline item draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.itemDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateItemCandidate(candidate: any, context: { categories: string[]; slots: string[] }): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const item = candidate.item;
  if (!item) {
    errors.push('Item data is required');
    return errors;
  }
  if (typeof item.id !== 'string' || !item.id.trim()) {
    errors.push('Item ID is required');
  }
  if (typeof item.name !== 'string' || !item.name.trim()) {
    errors.push('Item Name is required');
  }
  if (typeof item.type !== 'string' || !item.type.trim()) {
    errors.push('Item category type is required');
  } else if (context.categories && context.categories.length > 0 && !context.categories.includes(item.type)) {
    errors.push(`Item category "${item.type}" is not supported in project settings`);
  }
  if (typeof item.price !== 'number' || item.price < 0) {
    errors.push('Item price must be a non-negative number');
  }

  if (item.effect) {
    if (typeof item.effect !== 'object') {
      errors.push('Item effect must be an object');
    } else {
      if (item.effect.hp !== undefined && typeof item.effect.hp !== 'number') {
        errors.push('Item effect hp must be a number');
      }
      if (item.effect.mp !== undefined && typeof item.effect.mp !== 'number') {
        errors.push('Item effect mp must be a number');
      }
    }
  }

  if (item.slot && context.slots && context.slots.length > 0 && !context.slots.includes(item.slot)) {
    errors.push(`Equipment slot "${item.slot}" is not supported in project settings`);
  }

  return errors;
}

export function approveDbDraftCandidate(
  kind: 'actor' | 'enemy' | 'item',
  candidate: any,
  context: any,
  approvalMetadata: { reviewedAt: string }
) {
  let errors: string[] = [];
  if (kind === 'actor') {
    errors = validateActorCandidate(candidate, context);
  } else if (kind === 'enemy') {
    errors = validateEnemyCandidate(candidate, context);
  } else {
    errors = validateItemCandidate(candidate, context);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid ${kind} candidate`);
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
