import { describe, expect, it } from 'vitest';
import { getProjectDataAdapter, _resetAdaptersForTest } from '../../adapters/adapterFactory';
import { buildPlaytestLaunchPlan } from '../../playtest/playtestLaunchRequest';
import { createMockProviderAdapter } from '../../providers/mockProviderAdapter';
import {
  approveBalancingCandidate,
  generateBalancingCandidate,
} from '../../providers/balancingAssistantWorkflow';
import {
  approveDbDraftCandidate,
  generateActorDraftCandidate,
  generateItemDraftCandidate,
} from '../../providers/dbDraftGenerationWorkflow';
import {
  approveEventCommandsCandidate,
  generateEventCommandsCandidate,
} from '../../providers/eventCommandGenerationWorkflow';
import {
  appendGenerationHistoryRecord,
  createGenerationHistoryRecord,
  linkGenerationHistoryOutput,
} from '../../providers/generationHistory';
import {
  approveMapDraftGenerationCandidate,
  generateMapDraftCandidate,
  validateMapDraftGenerationCandidate,
} from '../../providers/mapDraftGenerationWorkflow';
import {
  approveQuestCandidate,
  generateQuestCandidate,
} from '../../providers/questGenerationWorkflow';
import {
  approveRepairCandidate,
  generateValidationRepairCandidate,
} from '../../providers/validationRepairWorkflow';
import {
  initialProjectStoreState,
  projectReducer,
  type ProjectAction,
  type ProjectStoreState,
} from '../../stores/projectStore';
import { initialEditorState } from '../../stores/editorStore';
import { performSave } from '../../stores/saveActions';
import type { FullProjectState } from '../../adapters/types';
import type { DatabaseListKey, GenerationHistoryLinkedOutput, GenerationHistoryRecord, ProjectData } from '../../types/project';
import { validateProject } from '../../validation/validateProject';

const createdAt = '2026-06-04T05:00:00.000Z';
const reviewedAt = '2026-06-04T05:05:00.000Z';

function fullState(state: ProjectStoreState): FullProjectState {
  return {
    project: state.project,
    maps: state.maps,
    items: state.items,
    databases: state.databases,
    assets: state.assets,
  };
}

function dispatchThrough(stateRef: { current: ProjectStoreState }) {
  return (action: ProjectAction) => {
    stateRef.current = projectReducer(stateRef.current, action);
  };
}

function recordAcceptedOutput(
  project: ProjectData,
  record: GenerationHistoryRecord,
  output: GenerationHistoryLinkedOutput,
): ProjectData {
  return linkGenerationHistoryOutput(
    appendGenerationHistoryRecord(project, record),
    record.id,
    {
      status: 'accepted',
      reviewedAt,
      output,
      notes: 'CP-088 mock integration gate accepted this output.',
    },
  );
}

function makeRecord(
  id: string,
  operation: string,
  prompt: string,
  outputSummary: string,
): GenerationHistoryRecord {
  return createGenerationHistoryRecord({
    id,
    kind: 'structured-data',
    operation,
    providerId: 'local',
    modelId: 'offline-mock',
    createdAt,
    prompt,
    inputContext: { gate: 'CP-088', authorization: 'Bearer sk-test-secret' },
    outputSummary,
  });
}

function updateHistory(state: ProjectStoreState, project: ProjectData): ProjectStoreState {
  return projectReducer(state, {
    type: 'UPDATE_PROJECT_META',
    changes: { generationHistory: project.generationHistory },
  });
}

describe('CP-088 AI game content pipeline integration gate', () => {
  it('runs every content pipeline through mock generation, validation, accepted insertion, save/reload, and playtest planning', async () => {
    _resetAdaptersForTest();
    const adapter = getProjectDataAdapter();
    const mockProvider = createMockProviderAdapter();
    const stateRef = {
      current: projectReducer(initialProjectStoreState, {
        type: 'LOAD_PROJECT',
        payload: await adapter.loadProject(),
      }),
    };
    const dispatch = dispatchThrough(stateRef);

    const initial = stateRef.current;
    const firstTilesetId = initial.databases.tilesets.tilesets[0]?.id ?? 'sample-town';

    const mapCandidate = await generateMapDraftCandidate(
      mockProvider,
      { defaultTilesetId: firstTilesetId },
      {
        prompt: 'Create a safe cave encounter map with one greeter and one hook trigger.',
        mapId: 'cp088_cave',
        mapName: 'CP088 Cave',
        templateId: 'cave',
      },
      { requestId: 'cp088-map', createdAt },
    );
    expect(validateMapDraftGenerationCandidate(mapCandidate, { tilesets: initial.databases.tilesets.tilesets })).toEqual([]);
    const malformedMapCandidate = {
      ...mapCandidate,
      map: {
        ...mapCandidate.map,
        events: [{ id: 'bad_event', trigger: 'interact' }],
      },
    };
    expect(validateMapDraftGenerationCandidate(malformedMapCandidate, { tilesets: initial.databases.tilesets.tilesets })).toEqual(
      expect.arrayContaining([
        'Map event "bad_event" x must be an in-bounds integer',
        'Map event "bad_event" commands must be an array',
      ]),
    );
    const approvedMap = approveMapDraftGenerationCandidate(
      mapCandidate,
      { tilesets: initial.databases.tilesets.tilesets },
      { reviewedAt },
    );
    stateRef.current = projectReducer(stateRef.current, {
      type: 'ADD_GENERATED_MAP',
      map: approvedMap.map,
      parentId: 'town',
    });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-map-history', 'map.draft.generate', 'Create a safe cave encounter map.', approvedMap.summary),
        { kind: 'map', id: approvedMap.map.id, path: `data/maps/${approvedMap.map.id}.json`, label: approvedMap.map.name },
      ),
    );

    const questCandidate = await generateQuestCandidate(
      mockProvider,
      { items: stateRef.current.items.items },
      {
        prompt: 'Reward the player for exploring the generated cave.',
        questId: 'cp088_cave_quest',
        questTitle: 'Cave Proof',
      },
      { requestId: 'cp088-quest', createdAt },
    );
    const approvedQuest = approveQuestCandidate(questCandidate, { items: stateRef.current.items.items }, { reviewedAt });
    stateRef.current = projectReducer(stateRef.current, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'quests',
      entry: approvedQuest.quest,
    });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-quest-history', 'quest.draft.generate', 'Generate a cave quest.', approvedQuest.summary),
        { kind: 'database', table: 'quests', id: approvedQuest.quest.id, label: approvedQuest.quest.title },
      ),
    );

    const eventCandidate = await generateEventCommandsCandidate(
      mockProvider,
      {
        items: stateRef.current.items.items,
        mapIds: Object.keys(stateRef.current.maps),
      },
      { prompt: 'Greet the player and give one useful item.', targetEventId: 'draft_greeter' },
      { requestId: 'cp088-event', createdAt },
    );
    const approvedEvent = approveEventCommandsCandidate(
      eventCandidate,
      {
        items: stateRef.current.items.items,
        mapIds: Object.keys(stateRef.current.maps),
      },
      { reviewedAt },
    );
    stateRef.current = projectReducer(stateRef.current, {
      type: 'UPDATE_EVENT_PAGE',
      mapId: approvedMap.map.id,
      eventId: 'draft_greeter',
      pageId: 'page_1',
      changes: { commands: approvedEvent.commands },
    });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-event-history', 'event.commands.generate', 'Generate cave greeter commands.', approvedEvent.summary),
        { kind: 'event', id: 'draft_greeter', path: `${approvedMap.map.id}/draft_greeter`, label: 'draft_greeter' },
      ),
    );

    const actorCandidate = await generateActorDraftCandidate(
      mockProvider,
      'Create a test actor for the cave proof.',
      { classes: stateRef.current.databases.classes },
      { actorId: 'cp088_actor', actorName: 'CP088 Actor' },
      { requestId: 'cp088-actor', createdAt },
    );
    const approvedActor = approveDbDraftCandidate('actor', actorCandidate, { classes: stateRef.current.databases.classes }, { reviewedAt });
    stateRef.current = projectReducer(stateRef.current, {
      type: 'ADD_DATABASE_ENTRY',
      table: 'actors',
      entry: approvedActor.actor,
    });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-actor-history', 'database.actor.generate', 'Generate an actor draft.', approvedActor.summary),
        { kind: 'database', table: 'actors', id: approvedActor.actor.id, label: approvedActor.actor.name },
      ),
    );

    const itemCandidate = await generateItemDraftCandidate(
      mockProvider,
      'Create a deterministic cave reward item.',
      {
        categories: stateRef.current.databases.types.itemCategories.map(type => type.id),
        slots: stateRef.current.databases.types.equipmentSlots.map(slot => slot.id),
      },
      { itemId: 'cp088_reward', itemName: 'CP088 Reward' },
      { requestId: 'cp088-item', createdAt },
    );
    const approvedItem = approveDbDraftCandidate(
      'item',
      itemCandidate,
      {
        categories: stateRef.current.databases.types.itemCategories.map(type => type.id),
        slots: stateRef.current.databases.types.equipmentSlots.map(slot => slot.id),
      },
      { reviewedAt },
    );
    stateRef.current = projectReducer(stateRef.current, {
      type: 'UPDATE_ITEM_DATABASE',
      items: { items: [...stateRef.current.items.items, approvedItem.item] },
    });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-item-history', 'database.item.generate', 'Generate an item draft.', approvedItem.summary),
        { kind: 'database', table: 'items' as DatabaseListKey, id: approvedItem.item.id, label: approvedItem.item.name },
      ),
    );

    const balanceCandidate = await generateBalancingCandidate(
      mockProvider,
      'Keep the starter loop deterministic after generated content is accepted.',
      {
        actors: stateRef.current.databases.actors,
        enemies: stateRef.current.databases.enemies,
        items: stateRef.current.items.items,
      },
      { curve: 'starter' },
      { requestId: 'cp088-balance', createdAt },
    );
    const approvedBalance = approveBalancingCandidate(
      balanceCandidate,
      {
        actors: stateRef.current.databases.actors,
        enemies: stateRef.current.databases.enemies,
        items: stateRef.current.items.items,
      },
      { reviewedAt },
    );
    for (const adjustment of approvedBalance.adjustments.actors) {
      stateRef.current = projectReducer(stateRef.current, {
        type: 'UPDATE_DATABASE_ENTRY',
        table: 'actors',
        id: adjustment.id,
        changes: adjustment.changes,
      });
    }
    for (const adjustment of approvedBalance.adjustments.enemies) {
      stateRef.current = projectReducer(stateRef.current, {
        type: 'UPDATE_DATABASE_ENTRY',
        table: 'enemies',
        id: adjustment.id,
        changes: adjustment.changes,
      });
    }
    for (const adjustment of approvedBalance.adjustments.items) {
      stateRef.current = projectReducer(stateRef.current, {
        type: 'UPDATE_ITEM_DATABASE',
        items: {
          items: stateRef.current.items.items.map(item =>
            item.id === adjustment.id ? { ...item, ...adjustment.changes } : item,
          ),
        },
      });
    }
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-balance-history', 'database.balance.generate', 'Balance accepted starter records.', approvedBalance.summary),
        { kind: 'database', table: 'actors', id: approvedBalance.adjustments.actors[0].id, label: 'starter balance pass' },
      ),
    );

    const repairCandidate = await generateValidationRepairCandidate(
      mockProvider,
      [],
      [{ level: 'warning', message: 'Generated map includes void ground tiles for review.', source: `${approvedMap.map.id}/ground` }],
      { requestId: 'cp088-repair', createdAt },
    );
    const approvedRepair = approveRepairCandidate(repairCandidate, { reviewedAt });
    stateRef.current = updateHistory(
      stateRef.current,
      recordAcceptedOutput(
        stateRef.current.project,
        makeRecord('cp088-repair-history', 'validation.repair.generate', 'Summarize validation repair guidance.', approvedRepair.summary),
        { kind: 'map', id: approvedMap.map.id, path: `data/maps/${approvedMap.map.id}.json`, label: 'repair suggestions reviewed' },
      ),
    );

    const report = validateProject(fullState(stateRef.current));
    expect(report.errors).toEqual([]);

    const outcome = await performSave(stateRef.current, dispatch);
    const reloaded = await adapter.loadProject();
    const reloadedReport = validateProject(reloaded);
    const playtestPlan = buildPlaytestLaunchPlan(
      {
        ...initialEditorState,
        selectedMapId: approvedMap.map.id,
        selectedEventMapId: approvedMap.map.id,
        selectedEvent: reloaded.maps[approvedMap.map.id].events.find(event => event.id === 'draft_greeter') ?? null,
        playtestMode: 'selectedEvent',
      },
      reloaded,
    );

    expect(outcome.success).toBe(true);
    expect(reloadedReport.errors).toEqual([]);
    expect(reloaded.maps[approvedMap.map.id].events.find(event => event.id === 'draft_greeter')?.commands).toEqual(approvedEvent.commands);
    expect(reloaded.databases.quests.map(quest => quest.id)).toContain(approvedQuest.quest.id);
    expect(reloaded.databases.actors.map(actor => actor.id)).toContain(approvedActor.actor.id);
    expect(reloaded.items.items.map(item => item.id)).toContain(approvedItem.item.id);
    expect(playtestPlan.request).toEqual({
      mode: 'selectedEvent',
      currentMapId: approvedMap.map.id,
      selectedEventMapId: approvedMap.map.id,
      selectedEventId: 'draft_greeter',
    });
    expect(reloaded.project.generationHistory?.records).toHaveLength(7);
    expect(reloaded.project.generationHistory?.records.every(record => record.reviewState === 'accepted')).toBe(true);
    expect(JSON.stringify(reloaded.project.generationHistory)).not.toMatch(/sk-test-secret|Bearer/i);
  });
});
