import { describe, expect, it } from 'vitest';
import type { ProjectData } from '../../types/project';
import {
  appendGenerationHistoryRecord,
  clearGenerationHistory,
  createGenerationHistoryRecord,
  exportGenerationHistory,
  linkGenerationHistoryOutput,
} from '../generationHistory';

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
});
