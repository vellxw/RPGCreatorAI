import { describe, expect, it } from 'vitest';
import { createMockProviderAdapter } from '../mockProviderAdapter';
import {
  buildDbDraftGenerationRequest,
  generateActorDraftCandidate,
  validateActorCandidate,
  generateEnemyDraftCandidate,
  validateEnemyCandidate,
  generateItemDraftCandidate,
  validateItemCandidate,
  approveDbDraftCandidate,
} from '../dbDraftGenerationWorkflow';

const mockContext = {
  classes: [
    { id: 'warrior', name: 'Warrior' },
    { id: 'mage', name: 'Mage' },
  ],
  items: [
    { id: 'potion', name: 'Potion' },
    { id: 'sword', name: 'Sword' },
  ],
  categories: ['consumable', 'weapon', 'armor'],
  slots: ['weapon', 'armor', 'accessory'],
};

describe('dbDraftGenerationWorkflow', () => {
  describe('Actors', () => {
    it('builds actor generation request correctly', () => {
      const req = buildDbDraftGenerationRequest('actor', 'A strong warrior', { id: 'warrior_1', name: 'Conan' }, {
        requestId: 'req-actor-1',
        createdAt: '2026-06-03T00:00:00Z',
      });
      expect(req.request).toMatchObject({
        id: 'req-actor-1',
        operation: 'text.generate',
        providerId: 'local',
        modelId: 'offline-mock',
        input: {
          responseFormat: 'rpgcreatorai.actorDraft.v1',
          fixture: 'actor-draft',
          id: 'warrior_1',
          name: 'Conan',
        },
      });
    });

    it('generates and validates a valid actor draft candidate', async () => {
      const candidate = await generateActorDraftCandidate(
        createMockProviderAdapter(),
        'A strong warrior',
        mockContext,
        { actorId: 'warrior_1', actorName: 'Conan' },
        { requestId: 'req-actor-1', createdAt: '2026-06-03T00:00:00Z' }
      );

      expect(candidate.reviewState).toBe('pending');
      expect(candidate.actor.name).toBe('Conan');
      expect(candidate.actor.classId).toBe('warrior');
      expect(validateActorCandidate(candidate, mockContext)).toEqual([]);
    });

    it('identifies actor validation errors for invalid class id and negative stats', async () => {
      const candidateInvalidClass = await generateActorDraftCandidate(
        createMockProviderAdapter(),
        'Invalid class',
        mockContext,
        { actorId: 'actor_invalid', actorName: 'Invalid Class Actor' },
        { requestId: 'req-actor-2', createdAt: '2026-06-03T00:00:00Z', forceInvalidClass: true }
      );
      const errorsClass = validateActorCandidate(candidateInvalidClass, mockContext);
      expect(errorsClass).toContain('Actor Class ID "invalid_class_id" does not exist in project context');

      const candidateNegativeStats = await generateActorDraftCandidate(
        createMockProviderAdapter(),
        'Negative stats',
        mockContext,
        { actorId: 'actor_negative', actorName: 'Negative Stats Actor' },
        { requestId: 'req-actor-3', createdAt: '2026-06-03T00:00:00Z', forceNegativeStats: true }
      );
      const errorsStats = validateActorCandidate(candidateNegativeStats, mockContext);
      expect(errorsStats).toContain('Actor HP must be a non-negative number');
      expect(errorsStats).toContain('Base stat "maxHp" must be a non-negative number');
    });
  });

  describe('Enemies', () => {
    it('generates and validates a valid enemy draft candidate', async () => {
      const candidate = await generateEnemyDraftCandidate(
        createMockProviderAdapter(),
        'A fiery elemental dragon',
        mockContext,
        { enemyId: 'dragon_1', enemyName: 'Fire Dragon' },
        { requestId: 'req-enemy-1', createdAt: '2026-06-03T00:00:00Z' }
      );

      expect(candidate.reviewState).toBe('pending');
      expect(candidate.enemy.name).toBe('Fire Dragon');
      expect(candidate.enemy.drops[0].itemId).toBe('potion');
      expect(validateEnemyCandidate(candidate, mockContext)).toEqual([]);
    });

    it('identifies enemy validation errors for invalid drop item and negative rewards', async () => {
      const candidateInvalidDrop = await generateEnemyDraftCandidate(
        createMockProviderAdapter(),
        'Invalid drop',
        mockContext,
        { enemyId: 'enemy_invalid', enemyName: 'Invalid Drop Enemy' },
        { requestId: 'req-enemy-2', createdAt: '2026-06-03T00:00:00Z', forceInvalidDropItem: true }
      );
      const errorsDrop = validateEnemyCandidate(candidateInvalidDrop, mockContext);
      expect(errorsDrop).toContain('Enemy drop item "invalid_item_id" does not exist in project context');

      const candidateNegativeRewards = await generateEnemyDraftCandidate(
        createMockProviderAdapter(),
        'Negative rewards',
        mockContext,
        { enemyId: 'enemy_negative', enemyName: 'Negative Rewards Enemy' },
        { requestId: 'req-enemy-3', createdAt: '2026-06-03T00:00:00Z', forceNegativeRewards: true }
      );
      const errorsRewards = validateEnemyCandidate(candidateNegativeRewards, mockContext);
      expect(errorsRewards).toContain('Enemy exp reward must be a non-negative number');
    });
  });

  describe('Items', () => {
    it('generates and validates a valid item draft candidate', async () => {
      const candidate = await generateItemDraftCandidate(
        createMockProviderAdapter(),
        'A magical recovery herb',
        mockContext,
        { itemId: 'herb_1', itemName: 'Recovery Herb' },
        { requestId: 'req-item-1', createdAt: '2026-06-03T00:00:00Z' }
      );

      expect(candidate.reviewState).toBe('pending');
      expect(candidate.item.name).toBe('Recovery Herb');
      expect(candidate.item.type).toBe('consumable');
      expect(validateItemCandidate(candidate, mockContext)).toEqual([]);
    });

    it('identifies item validation errors for invalid category and negative price', async () => {
      const candidateInvalidCat = await generateItemDraftCandidate(
        createMockProviderAdapter(),
        'Invalid category',
        mockContext,
        { itemId: 'item_invalid', itemName: 'Invalid Cat Item' },
        { requestId: 'req-item-2', createdAt: '2026-06-03T00:00:00Z', forceInvalidCategory: true }
      );
      const errorsCat = validateItemCandidate(candidateInvalidCat, mockContext);
      expect(errorsCat).toContain('Item category "invalid_category" is not supported in project settings');

      const candidateNegativePrice = await generateItemDraftCandidate(
        createMockProviderAdapter(),
        'Negative price',
        mockContext,
        { itemId: 'item_negative', itemName: 'Negative Price Item' },
        { requestId: 'req-item-3', createdAt: '2026-06-03T00:00:00Z', forceNegativePrice: true }
      );
      const errorsPrice = validateItemCandidate(candidateNegativePrice, mockContext);
      expect(errorsPrice).toContain('Item price must be a non-negative number');
    });
  });

  describe('Approval Flow', () => {
    it('approves a valid actor draft candidate', async () => {
      const candidate = await generateActorDraftCandidate(
        createMockProviderAdapter(),
        'A strong warrior',
        mockContext,
        { actorId: 'warrior_1', actorName: 'Conan' },
        { requestId: 'req-actor-1', createdAt: '2026-06-03T00:00:00Z' }
      );
      const approved = approveDbDraftCandidate('actor', candidate, mockContext, {
        reviewedAt: '2026-06-03T00:05:00Z',
      });
      expect(approved.reviewState).toBe('approved');
      expect(approved.reviewedAt).toBe('2026-06-03T00:05:00Z');
      expect(approved.provenance.reviewedAt).toBe('2026-06-03T00:05:00Z');
    });

    it('throws error when approving invalid draft candidate', async () => {
      const candidate = await generateActorDraftCandidate(
        createMockProviderAdapter(),
        'Negative stats',
        mockContext,
        { actorId: 'actor_negative', actorName: 'Negative Stats Actor' },
        { requestId: 'req-actor-3', createdAt: '2026-06-03T00:00:00Z', forceNegativeStats: true }
      );
      expect(() => {
        approveDbDraftCandidate('actor', candidate, mockContext, { reviewedAt: '2026-06-03T00:05:00Z' });
      }).toThrow('Invalid actor candidate');
    });
  });
});
