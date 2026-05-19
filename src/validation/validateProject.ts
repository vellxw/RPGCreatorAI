// Cross-project validation that spans maps, items, and the Phase 6 databases.

import type {
  CommonEventData,
  DatabaseEntries,
  EventCommand,
  GameEvent,
  ItemDatabase,
  MapData,
  ProjectData,
  ValidationMessage,
} from '../types/project';
import type { FullProjectState } from '../adapters/types';
import { validateMap } from './validateMap';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];
const VALID_MOVEMENT_SPEEDS = new Set([
  'oneEighth',
  'oneQuarter',
  'half',
  'normal',
  'double',
  'quadruple',
]);

// Phase 6 v1 command set. Used both for editor-side type checks and for
// the runtime parser, which mirrors this list.
const VALID_COMMAND_TYPES = new Set([
  'showText',
  'showChoices',
  'setFlag',
  'ifFlag',
  'ifSwitch',
  'ifVariable',
  'controlSwitch',
  'controlVariable',
  'addItem',
  'removeItem',
  'addGold',
  'removeGold',
  'transferMap',
  'setPlayerPosition',
  'wait',
  'playSound',
  'comment',
  'callCommonEvent',
  'startQuest',
  'updateQuestObjective',
  'completeQuest',
  'openShop',
  'startBattle',
  'changeActorHp',
  'playAnimation',
]);

export interface ValidationReport {
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
}

interface RefIndex {
  itemIds: Set<string>;
  switchIds: Set<string>;
  variableIds: Set<string>;
  actorIds: Set<string>;
  classIds: Set<string>;
  skillIds: Set<string>;
  enemyIds: Set<string>;
  troopIds: Set<string>;
  questIds: Set<string>;
  shopIds: Set<string>;
  commonEventIds: Set<string>;
  questObjectives: Map<string, Set<string>>;
  animationClips: Map<string, Set<string>>;
  playerAnimationSet: string;
}

function buildIndex(items: ItemDatabase, db: DatabaseEntries): RefIndex {
  const questObjectives = new Map<string, Set<string>>();
  for (const q of db.quests) {
    questObjectives.set(q.id, new Set(q.objectives.map(o => o.id)));
  }
  const animationClips = new Map<string, Set<string>>();
  for (const set of db.animations.sets) {
    animationClips.set(
      set.id,
      new Set(set.clips.map(clip => `${clip.action}:${clip.direction}`)),
    );
  }
  return {
    itemIds: new Set(items.items.map(i => i.id)),
    switchIds: new Set(db.switches.map(s => s.id)),
    variableIds: new Set(db.variables.map(v => v.id)),
    actorIds: new Set(db.actors.map(a => a.id)),
    classIds: new Set(db.classes.map(c => c.id)),
    skillIds: new Set(db.skills.map(s => s.id)),
    enemyIds: new Set(db.enemies.map(e => e.id)),
    troopIds: new Set(db.troops.map(t => t.id)),
    questIds: new Set(db.quests.map(q => q.id)),
    shopIds: new Set(db.shops.map(s => s.id)),
    commonEventIds: new Set(db.commonEvents.map(c => c.id)),
    questObjectives,
    animationClips,
    playerAnimationSet: db.system.playerAnimationSet || 'player_adventurer',
  };
}

export function validateProject(state: FullProjectState): ValidationReport {
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = [];

  errors.push(...validateProjectMeta(state.project, state.maps));
  errors.push(...validateDatabaseInternal(state.databases));
  errors.push(...validateItemDatabaseInternal(state.items));

  const index = buildIndex(state.items, state.databases);
  const mapIds = Object.keys(state.maps);

  for (const [, map] of Object.entries(state.maps)) {
    const mapMessages = validateMap(map, mapIds);
    for (const m of mapMessages) {
      if (m.level === 'error') errors.push(m);
      else if (m.level === 'warning') warnings.push(m);
    }
    errors.push(...validateUniqueEventIds(map));
    errors.push(...validateCommandsInMap(map, mapIds, index));
    errors.push(
      ...map.events
        .filter(e => !VALID_TRIGGERS.includes(e.trigger))
        .map(e => ({
          level: 'error' as const,
          message: `Event "${e.id}" has invalid trigger "${e.trigger}"`,
          source: `${map.id}/${e.id}`,
        })),
    );
  }

  // Cross-database referential checks
  errors.push(...validateCrossDbRefs(state.databases, index));

  // Validate common events command lists (same rules as map events)
  for (const ce of state.databases.commonEvents) {
    errors.push(...validateCommandsInCommonEvent(ce, mapIds, index));
  }

  return { errors, warnings };
}

function validateProjectMeta(project: ProjectData, maps: Record<string, MapData>): ValidationMessage[] {
  const out: ValidationMessage[] = [];

  if (!project.startMapId || !maps[project.startMapId]) {
    out.push({
      level: 'error',
      message: `Project startMapId "${project.startMapId}" does not exist`,
      source: 'project',
    });
    return out;
  }

  const startMap = maps[project.startMapId];
  const { x, y } = project.startPosition;
  if (x < 0 || x >= startMap.width || y < 0 || y >= startMap.height) {
    out.push({
      level: 'error',
      message: `Project startPosition (${x}, ${y}) is out of bounds for map "${project.startMapId}"`,
      source: 'project',
    });
  }

  return out;
}

export function validateUniqueEventIds(map: MapData): ValidationMessage[] {
  const seen = new Map<string, number>();
  for (const event of map.events) {
    seen.set(event.id, (seen.get(event.id) ?? 0) + 1);
  }
  const out: ValidationMessage[] = [];
  for (const [id, count] of seen) {
    if (count > 1) {
      out.push({
        level: 'error',
        message: `Map "${map.id}" has ${count} events with duplicate id "${id}"`,
        source: `${map.id}/${id}`,
      });
    }
  }
  return out;
}

function validateItemDatabaseInternal(items: ItemDatabase): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const seen = new Set<string>();
  for (const item of items.items) {
    if (seen.has(item.id)) {
      out.push({
        level: 'error',
        message: `Duplicate item id "${item.id}"`,
        source: 'database/items',
      });
    }
    seen.add(item.id);
  }
  return out;
}

function validateDatabaseInternal(db: DatabaseEntries): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const tables: Array<[string, Array<{ id: string }>]> = [
    ['actors', db.actors],
    ['classes', db.classes],
    ['skills', db.skills],
    ['enemies', db.enemies],
    ['troops', db.troops],
    ['quests', db.quests],
    ['shops', db.shops],
    ['switches', db.switches],
    ['variables', db.variables],
    ['commonEvents', db.commonEvents],
  ];
  for (const [name, list] of tables) {
    const seen = new Set<string>();
    for (const entry of list) {
      if (!entry.id || entry.id.trim() === '') {
        out.push({
          level: 'error',
          message: `${name} entry is missing an id`,
          source: `database/${name}`,
        });
        continue;
      }
      if (seen.has(entry.id)) {
        out.push({
          level: 'error',
          message: `Duplicate ${name.slice(0, -1)} id "${entry.id}"`,
          source: `database/${name}`,
        });
      }
      seen.add(entry.id);
    }
  }

  if (
    db.system.playerMovementSpeed !== undefined &&
    !VALID_MOVEMENT_SPEEDS.has(db.system.playerMovementSpeed)
  ) {
    out.push({
      level: 'error',
      message: `System playerMovementSpeed "${db.system.playerMovementSpeed}" is invalid`,
      source: 'database/system',
    });
  }
  if (
    db.system.defaultCharacterHeightTiles !== undefined &&
    (!Number.isFinite(db.system.defaultCharacterHeightTiles) || db.system.defaultCharacterHeightTiles <= 0)
  ) {
    out.push({
      level: 'error',
      message: `System defaultCharacterHeightTiles must be a positive finite number`,
      source: 'database/system',
    });
  }

  for (const set of db.animations.sets) {
    if (!set.display) continue;
    if (!Number.isFinite(set.display.heightTiles) || set.display.heightTiles <= 0) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.heightTiles must be a positive finite number`,
        source: `database/animations/${set.id}`,
      });
    }
    if (
      set.display.widthTiles !== undefined &&
      (!Number.isFinite(set.display.widthTiles) || set.display.widthTiles <= 0)
    ) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.widthTiles must be a positive finite number`,
        source: `database/animations/${set.id}`,
      });
    }
    if (
      set.display.yOffsetPx !== undefined &&
      !Number.isFinite(set.display.yOffsetPx)
    ) {
      out.push({
        level: 'error',
        message: `Animation set "${set.id}" display.yOffsetPx must be finite`,
        source: `database/animations/${set.id}`,
      });
    }
  }
  return out;
}

function validateCrossDbRefs(db: DatabaseEntries, index: RefIndex): ValidationMessage[] {
  const out: ValidationMessage[] = [];

  for (const actor of db.actors) {
    if (actor.classId && !index.classIds.has(actor.classId)) {
      out.push({
        level: 'error',
        message: `Actor "${actor.id}" references unknown class "${actor.classId}"`,
        source: `database/actors/${actor.id}`,
      });
    }
    for (const skillId of actor.skills) {
      if (!index.skillIds.has(skillId)) {
        out.push({
          level: 'error',
          message: `Actor "${actor.id}" references unknown skill "${skillId}"`,
          source: `database/actors/${actor.id}`,
        });
      }
    }
    for (const slot of Object.keys(actor.equipment)) {
      const itemId = actor.equipment[slot as keyof typeof actor.equipment];
      if (itemId && !index.itemIds.has(itemId)) {
        out.push({
          level: 'error',
          message: `Actor "${actor.id}" equips unknown item "${itemId}" in slot "${slot}"`,
          source: `database/actors/${actor.id}`,
        });
      }
    }
  }

  for (const cls of db.classes) {
    for (const learn of cls.learnedSkills) {
      if (!index.skillIds.has(learn.skillId)) {
        out.push({
          level: 'error',
          message: `Class "${cls.id}" references unknown skill "${learn.skillId}"`,
          source: `database/classes/${cls.id}`,
        });
      }
    }
  }

  for (const enemy of db.enemies) {
    for (const drop of enemy.drops) {
      if (!index.itemIds.has(drop.itemId)) {
        out.push({
          level: 'error',
          message: `Enemy "${enemy.id}" drops unknown item "${drop.itemId}"`,
          source: `database/enemies/${enemy.id}`,
        });
      }
    }
  }

  for (const troop of db.troops) {
    for (const memberId of troop.members) {
      if (!index.enemyIds.has(memberId)) {
        out.push({
          level: 'error',
          message: `Troop "${troop.id}" references unknown enemy "${memberId}"`,
          source: `database/troops/${troop.id}`,
        });
      }
    }
  }

  for (const quest of db.quests) {
    for (const reward of quest.rewards.items) {
      if (!index.itemIds.has(reward.itemId)) {
        out.push({
          level: 'error',
          message: `Quest "${quest.id}" rewards unknown item "${reward.itemId}"`,
          source: `database/quests/${quest.id}`,
        });
      }
    }
  }

  for (const shop of db.shops) {
    for (const listing of shop.listings) {
      if (!index.itemIds.has(listing.itemId)) {
        out.push({
          level: 'error',
          message: `Shop "${shop.id}" lists unknown item "${listing.itemId}"`,
          source: `database/shops/${shop.id}`,
        });
      }
    }
  }

  // System.startingParty -> actorIds
  for (const id of db.system.startingParty) {
    if (!index.actorIds.has(id)) {
      out.push({
        level: 'error',
        message: `System startingParty references unknown actor "${id}"`,
        source: 'database/system',
      });
    }
  }

  return out;
}

function validateCommandsInMap(map: MapData, mapIds: string[], index: RefIndex): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    out.push(...validateCommandList(event.commands, mapIds, index, `${map.id}/${event.id}`, event.id, map.events, event));
  }
  return out;
}

function validateCommandsInCommonEvent(
  ce: CommonEventData,
  mapIds: string[],
  index: RefIndex,
): ValidationMessage[] {
  return validateCommandList(ce.commands, mapIds, index, `commonEvent/${ce.id}`, ce.id, [], undefined);
}

function validateCommandList(
  commands: EventCommand[],
  mapIds: string[],
  index: RefIndex,
  source: string,
  ownerLabel: string,
  mapEvents: GameEvent[],
  ownerEvent: GameEvent | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const cmd of commands) {
    if (!VALID_COMMAND_TYPES.has(cmd.type)) {
      out.push({
        level: 'error',
        message: `Event "${ownerLabel}" has unknown command type "${cmd.type}"`,
        source,
      });
      continue;
    }
    out.push(...validateSingleCommand(cmd, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));

    // Walk nested branches.
    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifVariable') {
      out.push(...validateCommandList(cmd.then, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      out.push(...validateCommandList(cmd.else, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) {
        out.push(...validateCommandList(choice.commands, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) {
        out.push(...validateCommandList(cmd.victoryBranch, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
      if (cmd.defeatBranch) {
        out.push(...validateCommandList(cmd.defeatBranch, mapIds, index, source, ownerLabel, mapEvents, ownerEvent));
      }
    }
  }
  return out;
}

function validateSingleCommand(
  cmd: EventCommand,
  mapIds: string[],
  index: RefIndex,
  source: string,
  ownerLabel: string,
  mapEvents: GameEvent[],
  ownerEvent: GameEvent | undefined,
): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  const err = (msg: string) => {
    out.push({ level: 'error', message: `Event "${ownerLabel}" ${msg}`, source });
  };

  switch (cmd.type) {
    case 'addItem':
    case 'removeItem':
      if (!index.itemIds.has(cmd.itemId)) err(`${cmd.type} references unknown item "${cmd.itemId}"`);
      break;
    case 'transferMap':
    case 'setPlayerPosition':
      if (!mapIds.includes(cmd.mapId)) err(`${cmd.type} targets unknown map "${cmd.mapId}"`);
      break;
    case 'controlSwitch':
    case 'ifSwitch':
      if (!index.switchIds.has(cmd.switchId)) err(`${cmd.type} references unknown switch "${cmd.switchId}"`);
      break;
    case 'controlVariable':
      if (!index.variableIds.has(cmd.variableId))
        err(`controlVariable references unknown variable "${cmd.variableId}"`);
      if (cmd.sourceVariableId && !index.variableIds.has(cmd.sourceVariableId))
        err(`controlVariable source references unknown variable "${cmd.sourceVariableId}"`);
      if (cmd.op === 'div' && !cmd.sourceVariableId && cmd.value === 0)
        err(`controlVariable divides by zero (literal 0)`);
      break;
    case 'ifVariable':
      if (!index.variableIds.has(cmd.variableId))
        err(`ifVariable references unknown variable "${cmd.variableId}"`);
      break;
    case 'callCommonEvent':
      if (!index.commonEventIds.has(cmd.commonEventId))
        err(`callCommonEvent references unknown common event "${cmd.commonEventId}"`);
      break;
    case 'startQuest':
    case 'completeQuest':
      if (!index.questIds.has(cmd.questId)) err(`${cmd.type} references unknown quest "${cmd.questId}"`);
      break;
    case 'updateQuestObjective': {
      if (!index.questIds.has(cmd.questId))
        err(`updateQuestObjective references unknown quest "${cmd.questId}"`);
      const objectives = index.questObjectives.get(cmd.questId);
      if (objectives && !objectives.has(cmd.objectiveId))
        err(
          `updateQuestObjective references unknown objective "${cmd.objectiveId}" in quest "${cmd.questId}"`,
        );
      break;
    }
    case 'openShop':
      if (!index.shopIds.has(cmd.shopId)) err(`openShop references unknown shop "${cmd.shopId}"`);
      break;
    case 'startBattle':
      if (!index.troopIds.has(cmd.troopId)) err(`startBattle references unknown troop "${cmd.troopId}"`);
      break;
    case 'changeActorHp':
      if (!index.actorIds.has(cmd.actorId)) err(`changeActorHp references unknown actor "${cmd.actorId}"`);
      break;
    case 'playAnimation': {
      const targetEvent =
        cmd.target === 'thisEvent'
          ? ownerEvent
          : cmd.target === 'event'
            ? mapEvents.find(e => e.id === cmd.eventId)
            : undefined;
      if (cmd.target === 'event' && !targetEvent) {
        err(`playAnimation targets unknown event "${cmd.eventId ?? ''}"`);
      }

      const setId =
        cmd.target === 'player'
          ? index.animationClips.has(index.playerAnimationSet) ? index.playerAnimationSet : ''
          : targetEvent?.animationSet ?? '';
      const clips = setId ? index.animationClips.get(setId) : undefined;
      const directionMatches =
        cmd.direction === 'current'
          ? [...(clips ?? new Set<string>())].some(key => key.startsWith(`${cmd.action}:`))
          : clips?.has(`${cmd.action}:${cmd.direction}`) || clips?.has(`${cmd.action}:any`);

      if (!clips || !directionMatches) {
        err(`playAnimation references unknown animation clip "${setId || '(missing-set)'}/${cmd.action}/${cmd.direction}"`);
      }
      if (!Number.isFinite(cmd.durationMs) || cmd.durationMs < 0) {
        err(`playAnimation durationMs must be a non-negative finite number`);
      }
      break;
    }
    case 'addGold':
    case 'removeGold':
      if (!Number.isFinite(cmd.amount) || cmd.amount < 0)
        err(`${cmd.type} amount must be a non-negative finite number`);
      break;
    case 'wait':
      if (!Number.isFinite(cmd.ms) || cmd.ms < 0) err(`wait ms must be a non-negative finite number`);
      break;
    default:
      break;
  }

  return out;
}

// ---- Backwards-compatible exports used by older callers / tests. ---------

export function validateItemReferencesInMap(map: MapData, itemIds: Set<string>): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    walkAllCommands(event.commands, cmd => {
      if (cmd.type === 'addItem' && !itemIds.has(cmd.itemId)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" addItem references unknown item "${cmd.itemId}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    });
  }
  return out;
}

export function validateTriggerAndCommandTypesInMap(map: MapData): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    if (!VALID_TRIGGERS.includes(event.trigger)) {
      out.push({
        level: 'error',
        message: `Event "${event.id}" has invalid trigger "${event.trigger}"`,
        source: `${map.id}/${event.id}`,
      });
    }
    walkAllCommands(event.commands, cmd => {
      if (!VALID_COMMAND_TYPES.has(cmd.type)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" has unknown command type "${cmd.type}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    });
  }
  return out;
}

export function validateTransferTargetsInMap(map: MapData, mapIds: string[]): ValidationMessage[] {
  const out: ValidationMessage[] = [];
  for (const event of map.events) {
    walkAllCommands(event.commands, cmd => {
      if (cmd.type === 'transferMap' && !mapIds.includes(cmd.mapId)) {
        out.push({
          level: 'error',
          message: `Event "${event.id}" transfers to unknown map "${cmd.mapId}"`,
          source: `${map.id}/${event.id}`,
        });
      }
    });
  }
  return out;
}

function walkAllCommands(commands: EventCommand[], visit: (cmd: EventCommand) => void): void {
  for (const cmd of commands) {
    visit(cmd);
    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifVariable') {
      walkAllCommands(cmd.then, visit);
      walkAllCommands(cmd.else, visit);
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) walkAllCommands(choice.commands, visit);
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) walkAllCommands(cmd.victoryBranch, visit);
      if (cmd.defeatBranch) walkAllCommands(cmd.defeatBranch, visit);
    }
  }
}

export function eventPositionInBounds(event: GameEvent, map: MapData): boolean {
  return event.x >= 0 && event.x < map.width && event.y >= 0 && event.y < map.height;
}
