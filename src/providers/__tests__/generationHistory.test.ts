import { describe, expect, it } from 'vitest';
import type { AssetCatalogEntry, ProjectData } from '../../types/project';
import {
  appendGenerationHistoryRecord,
  clearGenerationHistory,
  createFailedGenerationHistoryRecord,
  createHistoryRecordForGeneratedAsset,
  createGenerationHistoryRecord,
  exportGenerationHistory,
  linkGenerationHistoryOutput,
} from '../generationHistory';
import type { ProviderAdapterRequest, ProviderAdapterResponse } from '../providerAdapter';

function projectWithHistory(): ProjectData {
  return {
    schemaVersion: 1,
    title: 'History Test',
    startMapId: 'town',
    startPosition: { x: 0, y: 0, direction: 'down' },
    maps: [{ id: 'town', path: 'data/maps/town.json' }],
    database: { items: 'data/database/items.json' },
  };
}

describe('generation history', () => {
  it('creates safe records with prompt, provider, model, input context, and output metadata', () => {
    const record = createGenerationHistoryRecord({
      id: 'history-1',
      kind: 'structured-data',
      operation: 'quest.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: '2026-06-04T04:10:00.000Z',
      prompt: 'Create a quest with secret sk-test-123 and token fixture-token-value',
      inputContext: {
        mapId: 'town',
        headers: {
          Authorization: 'Bearer provider-token',
        },
        nested: {
          apiKey: 'sk-provider-key',
          safe: 'kept',
        },
      },
      output: {
        questId: 'slime_hunt',
        secret: 'raw-secret-output',
      },
      outputSummary: 'Quest draft slime_hunt with token fixture-token-value',
    });

    const serialized = JSON.stringify(record);
    expect(record).toMatchObject({
      id: 'history-1',
      kind: 'structured-data',
      operation: 'quest.generate',
      providerId: 'local',
      modelId: 'offline-mock',
      createdAt: '2026-06-04T04:10:00.000Z',
      reviewState: 'pending',
    });
    expect(record.prompt).toContain('[REDACTED]');
    expect(record.inputContext).toMatchObject({
      mapId: 'town',
      headers: { Authorization: '[REDACTED]' },
      nested: { apiKey: '[REDACTED]', safe: 'kept' },
    });
    expect(record.output).toMatchObject({ questId: 'slime_hunt', secret: '[REDACTED]' });
    expect(record.outputSummary).toContain('[REDACTED]');
    expect(serialized).not.toMatch(/sk-test|fixture-token-value|provider-token|sk-provider-key|raw-secret-output/i);
  });

  it('records known generation cost metadata without leaking provider secrets', () => {
    const record = createGenerationHistoryRecord({
      id: 'history-cost',
      kind: 'image',
      operation: 'portrait.generate',
      providerId: 'fixture-estimated',
      modelId: 'fixture-image',
      createdAt: '2026-06-04T04:12:00.000Z',
      prompt: 'Portrait prompt',
      cost: {
        availability: 'estimated',
        estimatedUsd: 0.08,
        currency: 'USD',
        confirmationRequired: true,
        confirmationThresholdUsd: 0.1,
        detail: 'Estimated from provider metadata with apiKey sk-provider-key',
      },
      outputSummary: 'Portrait candidate generated',
    });

    expect(record.cost).toEqual({
      availability: 'estimated',
      estimatedUsd: 0.08,
      currency: 'USD',
      confirmationRequired: true,
      confirmationThresholdUsd: 0.1,
      detail: 'Estimated from provider metadata with apiKey [REDACTED]',
    });
    expect(JSON.stringify(record)).not.toMatch(/sk-provider-key/i);
  });

  it('appends records to project history and trims oldest entries by retention limit', () => {
    let project = projectWithHistory();

    for (const id of ['one', 'two', 'three']) {
      project = appendGenerationHistoryRecord(
        project,
        createGenerationHistoryRecord({
          id,
          kind: 'text',
          operation: 'event.generate',
          providerId: 'local',
          modelId: 'offline-mock',
          createdAt: `2026-06-04T04:1${id.length}:00.000Z`,
          prompt: `Prompt ${id}`,
          outputSummary: `Output ${id}`,
        }),
        { maxRecords: 2 },
      );
    }

    expect(project.generationHistory).toMatchObject({ schemaVersion: 1, maxRecords: 2 });
    expect(project.generationHistory?.records.map(record => record.id)).toEqual(['two', 'three']);
  });

  it('links accepted outputs to assets or database entries without losing prior review events', () => {
    let project = appendGenerationHistoryRecord(
      projectWithHistory(),
      createGenerationHistoryRecord({
        id: 'history-link',
        kind: 'image',
        operation: 'portrait.generate',
        providerId: 'local',
        modelId: 'offline-image-mock',
        createdAt: '2026-06-04T04:20:00.000Z',
        prompt: 'Portrait prompt',
        outputSummary: 'Portrait candidate generated',
      }),
    );

    project = linkGenerationHistoryOutput(project, 'history-link', {
      status: 'accepted',
      reviewedAt: '2026-06-04T04:21:00.000Z',
      output: {
        kind: 'asset',
        id: 'hero_portrait',
        path: 'assets/generated/hero_portrait.png',
        label: 'Hero Portrait',
      },
      notes: 'Accepted from portrait review.',
    });
    project = linkGenerationHistoryOutput(project, 'history-link', {
      status: 'accepted',
      reviewedAt: '2026-06-04T04:22:00.000Z',
      output: {
        kind: 'database',
        table: 'actors',
        id: 'hero',
        label: 'Hero',
      },
    });

    const record = project.generationHistory?.records[0];
    expect(record?.reviewState).toBe('accepted');
    expect(record?.acceptanceHistory).toHaveLength(2);
    expect(record?.linkedOutputs).toEqual([
      {
        kind: 'asset',
        id: 'hero_portrait',
        path: 'assets/generated/hero_portrait.png',
        label: 'Hero Portrait',
      },
      {
        kind: 'database',
        table: 'actors',
        id: 'hero',
        label: 'Hero',
      },
    ]);
  });

  it('exports a clone and clears project history for cleanup', () => {
    const project = appendGenerationHistoryRecord(
      projectWithHistory(),
      createGenerationHistoryRecord({
        id: 'history-export',
        kind: 'asset',
        operation: 'tileset.generate',
        providerId: 'local',
        modelId: 'offline-image-mock',
        createdAt: '2026-06-04T04:30:00.000Z',
        prompt: 'Tileset prompt',
        outputSummary: 'Tileset candidate',
      }),
    );

    const exported = exportGenerationHistory(project);
    exported.records[0].prompt = 'mutated';

    expect(project.generationHistory?.records[0].prompt).toBe('Tileset prompt');
    expect(clearGenerationHistory(project).generationHistory?.records).toEqual([]);
  });

  it('copies generated asset cost metadata into accepted generation history records', () => {
    const asset: AssetCatalogEntry = {
      id: 'hero_portrait',
      name: 'Hero Portrait',
      kind: 'image',
      path: 'assets/generated/hero_portrait.png',
      source: 'generated',
      width: 128,
      height: 128,
      generated: {
        prompt: 'Hero portrait prompt',
        providerId: 'fixture-estimated',
        modelId: 'fixture-image',
        operation: 'portrait.generate',
        createdAt: '2026-06-04T04:40:00.000Z',
        cost: {
          availability: 'estimated',
          estimatedUsd: 0.08,
          currency: 'USD',
          confirmationRequired: true,
          confirmationThresholdUsd: 0.1,
        },
      },
    };

    const record = createHistoryRecordForGeneratedAsset(asset);

    expect(record).toMatchObject({
      id: 'asset:hero_portrait:2026-06-04T04:40:00.000Z',
      reviewState: 'accepted',
      cost: {
        availability: 'estimated',
        estimatedUsd: 0.08,
        currency: 'USD',
        confirmationRequired: true,
        confirmationThresholdUsd: 0.1,
      },
    });
  });

  it('records failed provider calls as rejected non-destructive history with preserved context', () => {
    const request: ProviderAdapterRequest = {
      id: 'failed-request-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-04T04:50:00.000Z',
      prompt: 'Create portrait from prompt secret sk-failed-prompt',
      input: {
        ownerKind: 'actor',
        ownerId: 'hero',
        promptDraft: 'original user prompt',
        apiKey: 'sk-input-secret',
      },
    };
    const response: ProviderAdapterResponse = {
      id: 'failed-request-1',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      status: 'failed',
      error: 'Provider error included token raw-failure-token',
      failure: {
        kind: 'provider-error',
        message: 'Malformed provider response with token raw-failure-token',
        retryGuidance: 'Edit the prompt and retry without changing accepted assets.',
      },
      output: {
        assetRefs: ['mock://partial/failed.png'],
        data: {
          apiKey: 'sk-output-secret',
          note: 'partial provider output',
        },
      },
    };

    const record = createFailedGenerationHistoryRecord({
      kind: 'image',
      request,
      response,
      failedAt: '2026-06-04T04:51:00.000Z',
    });

    expect(record).toMatchObject({
      id: 'failed:failed-request-1',
      kind: 'image',
      operation: 'image.generate',
      providerId: 'local',
      modelId: 'offline-image-mock',
      createdAt: '2026-06-04T04:51:00.000Z',
      reviewState: 'rejected',
      linkedOutputs: [],
      failure: {
        kind: 'provider-error',
        message: 'Malformed provider response with token [REDACTED]',
        retryGuidance: 'Edit the prompt and retry without changing accepted assets.',
      },
    });
    expect(record.prompt).toContain('[REDACTED]');
    expect(record.inputContext).toMatchObject({
      ownerKind: 'actor',
      ownerId: 'hero',
      promptDraft: 'original user prompt',
      apiKey: '[REDACTED]',
    });
    expect(record.output).toMatchObject({
      failedCandidate: true,
      partialOutput: {
        assetRefs: ['mock://partial/failed.png'],
        data: {
          apiKey: '[REDACTED]',
          note: 'partial provider output',
        },
      },
    });
    expect(record.acceptanceHistory).toEqual([
      {
        status: 'rejected',
        reviewedAt: '2026-06-04T04:51:00.000Z',
        notes: 'provider-error: Malformed provider response with token [REDACTED]',
      },
    ]);
    expect(JSON.stringify(record)).not.toMatch(/sk-failed-prompt|sk-input-secret|sk-output-secret|raw-failure-token/i);
  });
});
