import {
  createGenerationHistoryRecord,
} from '../providers/generationHistory';
import {
  tryApplyCandidateProjectCommit,
  type ProjectAction,
  type ProjectStoreState,
} from '../stores/projectStore';
import type {
  GenerationHistoryKind,
  GenerationHistoryLinkedOutput,
  GenerationHistoryRecord,
} from '../types/project';
import { validateCandidateResourceDiff } from './candidateLifecycle';
import type {
  Candidate,
  CandidateKind,
  CandidateResourceDiff,
} from './candidateTypes';

export type CandidateProjectApplyResult =
  | {
      ok: true;
      committedAt: string;
      historyRecordId: string;
      appliedActionCount: number;
    }
  | {
      ok: false;
      code:
        | 'candidate-not-approved'
        | 'project-mismatch'
        | 'invalid-validation'
        | 'missing-lineage'
        | 'invalid-diff'
        | 'diff-mismatch'
        | 'commit-rejected';
      message: string;
    };

export type PreparedCandidateProjectCommit =
  | {
      ok: true;
      action: Extract<ProjectAction, { type: 'COMMIT_AI_CANDIDATE' }>;
      result: Extract<CandidateProjectApplyResult, { ok: true }>;
    }
  | Extract<CandidateProjectApplyResult, { ok: false }>;

function mapPath(state: ProjectStoreState | undefined, mapId: string): string {
  return state?.project.maps.find(reference => reference.id === mapId)?.path
    ?? `data/maps/${mapId}.json`;
}

function databasePath(state: ProjectStoreState | undefined, table: string): string {
  const configured = state?.project.database[
    table as keyof ProjectStoreState['project']['database']
  ];
  return typeof configured === 'string' && configured.trim()
    ? configured
    : `data/database/${table}.json`;
}

function assetCatalogPath(state: ProjectStoreState | undefined): string {
  return state?.project.assetCatalog?.trim() || 'data/assets/catalog.json';
}

function change(
  path: string,
  kind: CandidateResourceDiff['kind'],
  summary: string,
): CandidateResourceDiff {
  return { path, kind, summary };
}

function mergeChanges(changes: CandidateResourceDiff[]): CandidateResourceDiff[] {
  const merged = new Map<string, CandidateResourceDiff>();
  for (const entry of changes) {
    const key = `${entry.kind}:${entry.path}`;
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, entry);
      continue;
    }
    if (!previous.summary.includes(entry.summary)) {
      merged.set(key, { ...previous, summary: `${previous.summary}; ${entry.summary}` });
    }
  }
  return [...merged.values()];
}

/**
 * Produces the concrete project-resource review diff for reducer actions.
 * Supplying state resolves custom map/database/catalog paths; generation-time
 * callers may omit it and use the canonical default paths.
 */
export function candidateResourceDiffForActions(
  actions: readonly ProjectAction[],
  state?: ProjectStoreState,
): CandidateResourceDiff[] {
  const changes: CandidateResourceDiff[] = [];

  for (const action of actions) {
    switch (action.type) {
      case 'UPDATE_PROJECT_META':
      case 'UPDATE_MAP_REFERENCE':
      case 'MOVE_MAP':
      case 'SWAP_MAP_ORDER':
        changes.push(change('data/project.json', 'modify', `Apply ${action.type.toLowerCase()} metadata change.`));
        break;

      case 'CREATE_MAP':
        changes.push(
          change('data/project.json', 'modify', `Register map ${action.mapId}.`),
          change(mapPath(state, action.mapId), 'add', `Create map ${action.mapId}.`),
        );
        break;
      case 'ADD_GENERATED_MAP':
        changes.push(
          change('data/project.json', 'modify', `Register generated map ${action.map.id}.`),
          change(mapPath(state, action.map.id), 'add', `Add generated map ${action.map.id}.`),
        );
        break;
      case 'DUPLICATE_MAP':
        changes.push(
          change('data/project.json', 'modify', `Register duplicated map ${action.newMapId}.`),
          change(mapPath(state, action.newMapId), 'add', `Create duplicated map ${action.newMapId}.`),
        );
        break;
      case 'REMOVE_MAP':
        changes.push(
          change('data/project.json', 'modify', `Remove map ${action.mapId} from the project index.`),
          change(mapPath(state, action.mapId), 'delete', `Delete map ${action.mapId}.`),
        );
        break;

      case 'PAINT_TILE':
      case 'PAINT_RECT':
      case 'FLOOD_FILL':
      case 'RESIZE_MAP':
      case 'REPLACE_MAP':
      case 'UPDATE_MAP_LAYER_META':
      case 'UPDATE_MAP_PROPERTIES':
      case 'ADD_EVENT':
      case 'DUPLICATE_EVENT':
      case 'REMOVE_EVENT':
      case 'UPDATE_EVENT':
      case 'ADD_EVENT_PAGE':
      case 'UPDATE_EVENT_PAGE':
      case 'REMOVE_EVENT_PAGE':
      case 'REORDER_EVENT_PAGE':
      case 'RENAME_EVENT':
      case 'UPDATE_COMMAND':
      case 'ADD_COMMAND':
      case 'INSERT_COMMAND':
      case 'MOVE_COMMAND':
      case 'DUPLICATE_COMMAND':
      case 'REMOVE_COMMAND':
      case 'REMOVE_COMMAND_RANGE':
      case 'UPDATE_PAGE_COMMAND':
      case 'ADD_PAGE_COMMAND':
      case 'INSERT_PAGE_COMMAND':
      case 'MOVE_PAGE_COMMAND':
      case 'DUPLICATE_PAGE_COMMAND':
      case 'REMOVE_PAGE_COMMAND':
      case 'REMOVE_PAGE_COMMAND_RANGE':
        changes.push(change(mapPath(state, action.mapId), 'modify', `Apply ${action.type.toLowerCase()} to map ${action.mapId}.`));
        break;

      case 'ADD_DATABASE_ENTRY':
      case 'UPDATE_DATABASE_ENTRY':
      case 'REMOVE_DATABASE_ENTRY':
      case 'RENAME_DATABASE_ENTRY':
        changes.push(change(databasePath(state, action.table), 'modify', `Apply ${action.type.toLowerCase()} to ${action.table}.`));
        break;
      case 'UPDATE_SYSTEM_DATA':
        changes.push(change(databasePath(state, 'system'), 'modify', 'Update system database data.'));
        break;
      case 'UPDATE_TYPES_DATABASE':
        changes.push(change(databasePath(state, 'types'), 'modify', 'Update type database data.'));
        break;
      case 'UPDATE_TERMS_DATABASE':
        changes.push(change(databasePath(state, 'terms'), 'modify', 'Update terms database data.'));
        break;
      case 'UPDATE_ITEM_DATABASE':
        changes.push(change(state?.project.database.items ?? 'data/database/items.json', 'modify', 'Update item database data.'));
        break;
      case 'UPDATE_TILESET_DATABASE':
        changes.push(change(databasePath(state, 'tilesets'), 'modify', 'Update tileset database data.'));
        break;
      case 'UPDATE_ANIMATION_DATABASE':
        changes.push(change(databasePath(state, 'animations'), 'modify', 'Update animation database data.'));
        break;
      case 'UPDATE_COMMON_EVENT_COMMANDS':
        changes.push(change(databasePath(state, 'commonEvents'), 'modify', `Update common event ${action.commonEventId}.`));
        break;

      case 'ADD_ASSET_CATALOG_ENTRY':
      case 'UPDATE_ASSET_CATALOG_METADATA':
        changes.push(change(assetCatalogPath(state), 'modify', `Apply ${action.type.toLowerCase()} to the asset catalog.`));
        break;

      // Reference repair can touch several independently reviewed resources;
      // control actions are never valid candidate payloads. They deliberately
      // produce no diff so preparation fails closed.
      case 'REPAIR_REFERENCE':
      case 'LOAD_PROJECT':
      case 'COMMIT_AI_CANDIDATE':
      case 'UNDO':
      case 'REDO':
      case 'BEGIN_STROKE':
      case 'END_STROKE':
      case 'MARK_SAVED':
      case 'VALIDATE':
        break;
    }
  }

  return mergeChanges(changes);
}

function historyKind(kind: CandidateKind): GenerationHistoryKind {
  if (kind === 'asset-draft') return 'asset';
  if (kind === 'event-draft' || kind === 'event-commands') return 'text';
  return 'structured-data';
}

function linkedOutputs(
  state: ProjectStoreState,
  actions: readonly ProjectAction[],
): GenerationHistoryLinkedOutput[] {
  const outputs: GenerationHistoryLinkedOutput[] = [];
  for (const action of actions) {
    if (action.type === 'ADD_EVENT') {
      outputs.push({
        kind: 'event',
        id: action.event.id,
        path: mapPath(state, action.mapId),
        label: action.event.id,
      });
    } else if (action.type === 'ADD_ASSET_CATALOG_ENTRY') {
      outputs.push({
        kind: 'asset',
        id: action.asset.id,
        path: action.asset.path,
        label: action.asset.name,
      });
    } else if (action.type === 'ADD_GENERATED_MAP') {
      outputs.push({
        kind: 'map',
        id: action.map.id,
        path: mapPath(state, action.map.id),
        label: action.map.name,
      });
    } else if (action.type === 'CREATE_MAP') {
      outputs.push({
        kind: 'map',
        id: action.mapId,
        path: mapPath(state, action.mapId),
        label: action.name,
      });
    } else if (action.type === 'ADD_DATABASE_ENTRY') {
      outputs.push({
        kind: 'database',
        id: action.entry.id,
        table: action.table,
        path: databasePath(state, action.table),
        label: action.entry.id,
      });
    }
  }
  return outputs;
}

function acceptedHistoryRecord(
  state: ProjectStoreState,
  candidate: Candidate,
): GenerationHistoryRecord {
  const reviewedAt = candidate.reviewedAt ?? new Date().toISOString();
  const outputs = linkedOutputs(state, candidate.payload.applyActions);
  const record = createGenerationHistoryRecord({
    id: candidate.historyRecordId!,
    kind: historyKind(candidate.kind),
    operation: candidate.provenance.operation,
    providerId: candidate.provenance.providerId,
    modelId: candidate.provenance.modelId,
    createdAt: candidate.createdAt,
    prompt: candidate.payload.summary,
    inputContext: {
      candidateId: candidate.id,
      projectId: candidate.projectId,
      resourceDiff: candidate.resourceDiff,
    },
    output: candidate.payload.output,
    outputSummary: candidate.payload.summary,
    promptTemplateId: candidate.provenance.promptTemplateId,
    promptTemplateVersion: candidate.provenance.promptTemplateVersion,
  });
  return {
    ...record,
    reviewState: 'accepted',
    linkedOutputs: outputs,
    acceptanceHistory: [
      {
        status: 'accepted',
        reviewedAt,
        output: outputs[0],
        notes: candidate.reviewerNote,
      },
    ],
  };
}

function diffKeys(diff: readonly CandidateResourceDiff[]): string[] {
  return diff.map(entry => `${entry.kind}:${entry.path}`).sort();
}

export function prepareCandidateProjectCommit(
  state: ProjectStoreState,
  candidate: Candidate,
  activeProjectId: string | null,
): PreparedCandidateProjectCommit {
  if (candidate.reviewState !== 'accepted' || !candidate.reviewedAt) {
    return {
      ok: false,
      code: 'candidate-not-approved',
      message: 'The candidate must have an explicit review approval before commit.',
    };
  }
  if (!activeProjectId || candidate.projectId !== activeProjectId) {
    return {
      ok: false,
      code: 'project-mismatch',
      message: 'This candidate belongs to a different project and cannot be committed here.',
    };
  }
  if (candidate.validation.errors.length > 0) {
    return {
      ok: false,
      code: 'invalid-validation',
      message: 'Unresolved candidate validation errors block the project commit.',
    };
  }
  if (!candidate.historyRecordId?.trim()) {
    return {
      ok: false,
      code: 'missing-lineage',
      message: 'The candidate has no canonical generation-history lineage id.',
    };
  }

  const diffErrors = validateCandidateResourceDiff(candidate.resourceDiff, {
    requireIntegrityHashes: false,
  });
  if (candidate.resourceDiff.length === 0 || diffErrors.length > 0) {
    return {
      ok: false,
      code: 'invalid-diff',
      message: diffErrors[0] ?? 'The candidate has no project-resource diff to review.',
    };
  }
  const expectedDiff = candidateResourceDiffForActions(candidate.payload.applyActions, state);
  if (
    expectedDiff.length === 0
    || JSON.stringify(diffKeys(expectedDiff)) !== JSON.stringify(diffKeys(candidate.resourceDiff))
  ) {
    return {
      ok: false,
      code: 'diff-mismatch',
      message: 'The reviewed resource diff does not match the candidate project actions.',
    };
  }

  const historyRecord = acceptedHistoryRecord(state, candidate);
  const action: Extract<ProjectAction, { type: 'COMMIT_AI_CANDIDATE' }> = {
    type: 'COMMIT_AI_CANDIDATE',
    candidateId: candidate.id,
    historyRecord,
    actions: candidate.payload.applyActions,
  };
  const preview = tryApplyCandidateProjectCommit(state, action);
  if (!preview.ok) {
    return {
      ok: false,
      code: 'commit-rejected',
      message: preview.message,
    };
  }
  return {
    ok: true,
    action,
    result: {
      ok: true,
      committedAt: candidate.reviewedAt,
      historyRecordId: historyRecord.id,
      appliedActionCount: preview.appliedActionCount,
    },
  };
}
