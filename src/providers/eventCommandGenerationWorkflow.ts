import type { ProviderAdapter } from './providerAdapter';
import type { EventCommand } from '../types/project';

export function buildEventCommandGenerationRequest(
  options: { prompt: string; targetEventId?: string },
  context: { mapEvents?: any[]; switches?: any[]; variables?: any[]; items?: any[]; commonEvents?: any[]; quests?: any[]; shops?: any[] },
  metadata: { requestId: string; createdAt: string }
) {
  const prompt = `Generate event commands for event: "${options.targetEventId ?? 'unknown'}" and prompt: "${options.prompt}".`;
  return {
    request: {
      id: metadata.requestId,
      operation: 'text.generate' as const,
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: metadata.createdAt,
      prompt,
      input: {
        responseFormat: 'rpgcreatorai.eventCommandsDraft.v1',
        fixture: 'event-commands-draft',
        targetEventId: options.targetEventId,
        reviewRequired: true,
      },
    },
  };
}

export async function generateEventCommandsCandidate(
  adapter: ProviderAdapter,
  context: { mapEvents?: any[]; switches?: any[]; variables?: any[]; items?: any[]; commonEvents?: any[]; quests?: any[]; shops?: any[]; mapIds?: string[] },
  options: { prompt: string; targetEventId?: string },
  metadata: { requestId: string; createdAt: string; fixtureInvalidCommands?: string }
) {
  const built = buildEventCommandGenerationRequest(options, context, metadata);
  const response = await adapter.execute(built.request);
  if (response.status !== 'succeeded') {
    throw new Error(response.error ?? 'Event command generation failed');
  }

  if (metadata.fixtureInvalidCommands === 'unknown-type') {
    return {
      reviewState: 'pending' as const,
      commands: [
        { type: 'showText', text: 'Hello!' },
        { type: 'invalid_command_type_xyz', someParam: 123 }
      ] as any[],
      summary: 'structured offline event commands draft candidate with unknown type',
      provenance: {
        providerId: 'local',
        modelId: 'offline-mock',
        responseFormat: 'rpgcreatorai.eventCommandsDraft.v1',
        requestId: metadata.requestId,
      }
    };
  }

  if (metadata.fixtureInvalidCommands === 'invalid-map-reference') {
    return {
      reviewState: 'pending' as const,
      commands: [
        { type: 'showText', text: 'Teleporting...' },
        { type: 'transferMap', mapId: 'non_existent_map_123', x: 0, y: 0, direction: 'down' }
      ] as any[],
      summary: 'structured offline event commands draft candidate with invalid map reference',
      provenance: {
        providerId: 'local',
        modelId: 'offline-mock',
        responseFormat: 'rpgcreatorai.eventCommandsDraft.v1',
        requestId: metadata.requestId,
      }
    };
  }

  const firstItemId = context.items?.[0]?.id ?? 'potion';
  return {
    reviewState: 'pending' as const,
    commands: [
      { type: 'showText', speaker: 'Guide', text: 'Welcome to the adventure!' },
      { type: 'addItem', itemId: firstItemId, amount: 1 },
      { type: 'controlSelfSwitch', switchId: 'A', value: true }
    ] as any[],
    summary: 'structured offline event commands draft candidate',
    provenance: {
      providerId: 'local',
      modelId: 'offline-mock',
      responseFormat: 'rpgcreatorai.eventCommandsDraft.v1',
      requestId: metadata.requestId,
    },
  };
}

export function validateEventCommandsCandidate(
  candidate: any,
  context: { mapEvents?: any[]; switches?: any[]; variables?: any[]; items?: any[]; commonEvents?: any[]; quests?: any[]; shops?: any[]; mapIds?: string[] }
): string[] {
  const errors: string[] = [];
  if (!candidate) {
    errors.push('Candidate is required');
    return errors;
  }
  const commands = candidate.commands;
  if (!Array.isArray(commands)) {
    errors.push('Commands must be an array');
    return errors;
  }

  const VALID_COMMAND_TYPES = new Set([
    'showText',
    'showChoices',
    'setFlag',
    'ifFlag',
    'ifSwitch',
    'ifSelfSwitch',
    'ifVariable',
    'controlSwitch',
    'controlSelfSwitch',
    'controlVariable',
    'addItem',
    'removeItem',
    'addGold',
    'removeGold',
    'transferMap',
    'setPlayerPosition',
    'wait',
    'playSound',
    'pluginCommand',
    'comment',
    'callCommonEvent',
    'startQuest',
    'updateQuestObjective',
    'completeQuest',
    'openShop',
    'startBattle',
    'changeActorHp',
    'playAnimation',
    'setMovementRoute',
  ]);

  const validMapIds = new Set(context.mapIds || []);
  const validItemIds = new Set((context.items || []).map((item: any) => item.id));

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (!cmd || typeof cmd !== 'object') {
      errors.push(`Command at index ${i} must be an object`);
      continue;
    }
    if (!VALID_COMMAND_TYPES.has(cmd.type)) {
      errors.push(`Command at index ${i} has unknown type "${cmd.type}"`);
    }

    if (cmd.type === 'showText') {
      if (typeof cmd.text !== 'string') {
        errors.push(`Command at index ${i} (showText) is missing text string`);
      }
    }

    if (cmd.type === 'transferMap' || cmd.type === 'setPlayerPosition') {
      if (typeof cmd.mapId !== 'string' || !cmd.mapId.trim()) {
        errors.push(`Command at index ${i} (${cmd.type}) is missing mapId`);
      } else if (context.mapIds && !validMapIds.has(cmd.mapId)) {
        errors.push(`Command at index ${i} (${cmd.type}) targets unknown map "${cmd.mapId}"`);
      }
    }

    if (cmd.type === 'addItem' || cmd.type === 'removeItem') {
      if (typeof cmd.itemId !== 'string' || !cmd.itemId.trim()) {
        errors.push(`Command at index ${i} (${cmd.type}) is missing itemId`);
      } else if (context.items && !validItemIds.has(cmd.itemId)) {
        errors.push(`Command at index ${i} (${cmd.type}) targets unknown item "${cmd.itemId}"`);
      }
      if (typeof cmd.amount !== 'number' || cmd.amount <= 0) {
        errors.push(`Command at index ${i} (${cmd.type}) amount must be a positive number`);
      }
    }
  }

  return errors;
}

export function approveEventCommandsCandidate(
  candidate: any,
  context: { mapEvents?: any[]; switches?: any[]; variables?: any[]; items?: any[]; commonEvents?: any[]; quests?: any[]; shops?: any[]; mapIds?: string[] },
  approvalMetadata: { reviewedAt: string }
) {
  const errors = validateEventCommandsCandidate(candidate, context);
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
