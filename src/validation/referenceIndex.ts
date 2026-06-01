import type { FullProjectState } from '../adapters/types';
import type { DatabaseListKey, EventCommand, MapData } from '../types/project';

export type ReferenceTable = DatabaseListKey | 'items' | 'tilesets' | 'animations' | 'questObjectives';

export interface ReferenceTarget {
  table: ReferenceTable;
  id: string;
  parentId?: string;
}

export interface ReferenceRecord {
  table: ReferenceTable;
  id: string;
  parentId?: string;
  source: string;
  label: string;
}

function matches(ref: ReferenceRecord, target: ReferenceTarget): boolean {
  return (
    ref.table === target.table &&
    ref.id === target.id &&
    (target.parentId === undefined || ref.parentId === target.parentId)
  );
}

function add(
  refs: ReferenceRecord[],
  table: ReferenceTable,
  id: string | undefined,
  source: string,
  label: string,
  parentId?: string,
) {
  if (!id) return;
  refs.push({ table, id, source, label, parentId });
}

function commandReferences(command: EventCommand, source: string, refs: ReferenceRecord[]) {
  switch (command.type) {
    case 'ifSwitch':
    case 'controlSwitch':
      add(refs, 'switches', command.switchId, source, 'Switch command');
      break;
    case 'ifVariable':
      add(refs, 'variables', command.variableId, source, 'Variable command');
      break;
    case 'controlVariable':
      add(refs, 'variables', command.variableId, source, 'Variable command');
      add(refs, 'variables', command.sourceVariableId, source, 'Variable source command');
      break;
    case 'addItem':
    case 'removeItem':
      add(refs, 'items', command.itemId, source, 'Item command');
      break;
    case 'callCommonEvent':
      add(refs, 'commonEvents', command.commonEventId, source, 'Common event command');
      break;
    case 'startQuest':
    case 'completeQuest':
      add(refs, 'quests', command.questId, source, 'Quest command');
      break;
    case 'updateQuestObjective':
      add(refs, 'quests', command.questId, source, 'Quest command');
      add(refs, 'questObjectives', command.objectiveId, source, 'Quest objective command', command.questId);
      break;
    case 'openShop':
      add(refs, 'shops', command.shopId, source, 'Shop command');
      break;
    case 'startBattle':
      add(refs, 'troops', command.troopId, source, 'Troop command');
      break;
    case 'changeActorHp':
      add(refs, 'actors', command.actorId, source, 'Actor command');
      break;
    default:
      break;
  }
}

function walkCommands(commands: EventCommand[], source: string, refs: ReferenceRecord[]) {
  for (const command of commands) {
    commandReferences(command, source, refs);
    if (command.type === 'ifFlag' || command.type === 'ifSwitch' || command.type === 'ifSelfSwitch' || command.type === 'ifVariable') {
      walkCommands(command.then, source, refs);
      walkCommands(command.else, source, refs);
    } else if (command.type === 'showChoices') {
      for (const choice of command.choices) {
        walkCommands(choice.commands, source, refs);
      }
    } else if (command.type === 'startBattle') {
      walkCommands(command.victoryBranch ?? [], source, refs);
      walkCommands(command.defeatBranch ?? [], source, refs);
    }
  }
}

function mapReferences(map: MapData, refs: ReferenceRecord[]) {
  add(refs, 'tilesets', map.tilesetId, `maps/${map.id}/tilesetId`, 'Map tileset');
  for (const event of map.events) {
    add(refs, 'animations', event.animationSet, `maps/${map.id}/events/${event.id}/animationSet`, 'Event animation set');
    walkCommands(event.commands, `maps/${map.id}/events/${event.id}/commands`, refs);
    for (const page of event.pages ?? []) {
      for (const switchId of Object.keys(page.conditions.switches ?? {})) {
        add(
          refs,
          'switches',
          switchId,
          `maps/${map.id}/events/${event.id}/pages/${page.id}/conditions/switches/${switchId}`,
          'Event page switch condition',
        );
      }
      for (const variable of page.conditions.variables ?? []) {
        add(
          refs,
          'variables',
          variable.variableId,
          `maps/${map.id}/events/${event.id}/pages/${page.id}/conditions/variables/${variable.variableId}`,
          'Event page variable condition',
        );
      }
      add(refs, 'animations', page.graphic.animationSet, `maps/${map.id}/events/${event.id}/pages/${page.id}/graphic/animationSet`, 'Event page animation set');
      walkCommands(page.commands, `maps/${map.id}/events/${event.id}/commands`, refs);
    }
  }
}

export function listReferences(project: FullProjectState): ReferenceRecord[] {
  const refs: ReferenceRecord[] = [];
  for (const map of Object.values(project.maps)) {
    mapReferences(map, refs);
  }

  const { databases, items } = project;
  for (const actor of databases.actors) {
    add(refs, 'classes', actor.classId, `database/actors/${actor.id}/classId`, 'Actor class');
    for (const itemId of Object.values(actor.equipment)) {
      add(refs, 'items', itemId ?? undefined, `database/actors/${actor.id}/equipment`, 'Actor equipment');
    }
    for (const skillId of actor.skills) {
      add(refs, 'skills', skillId, `database/actors/${actor.id}/skills/${skillId}`, 'Actor skill');
    }
  }
  for (const cls of databases.classes) {
    for (const learned of cls.learnedSkills) {
      add(refs, 'skills', learned.skillId, `database/classes/${cls.id}/learnedSkills/${learned.skillId}`, 'Class learned skill');
    }
  }
  for (const weapon of databases.weapons) {
    add(refs, 'animations', weapon.animationId, `database/weapons/${weapon.id}/animationId`, 'Weapon animation');
  }
  for (const enemy of databases.enemies) {
    for (const drop of enemy.drops) {
      add(refs, 'items', drop.itemId, `database/enemies/${enemy.id}/drops/${drop.itemId}`, 'Enemy drop');
    }
  }
  for (const troop of databases.troops) {
    for (const enemyId of troop.members) {
      add(refs, 'enemies', enemyId, `database/troops/${troop.id}/members/${enemyId}`, 'Troop member');
    }
  }
  for (const quest of databases.quests) {
    for (const reward of quest.rewards.items) {
      add(refs, 'items', reward.itemId, `database/quests/${quest.id}/rewards/items/${reward.itemId}`, 'Quest reward item');
    }
  }
  for (const shop of databases.shops) {
    for (const listing of shop.listings) {
      add(refs, 'items', listing.itemId, `database/shops/${shop.id}/listings/${listing.itemId}`, 'Shop listing');
    }
  }
  for (const commonEvent of databases.commonEvents) {
    add(refs, 'switches', commonEvent.switchId, `database/commonEvents/${commonEvent.id}/switchId`, 'Common event condition switch');
    walkCommands(commonEvent.commands, `database/commonEvents/${commonEvent.id}/commands`, refs);
  }
  for (const actorId of databases.system.startingParty) {
    add(refs, 'actors', actorId, `database/system/startingParty/${actorId}`, 'System starting party');
  }
  add(refs, 'animations', databases.system.playerAnimationSet, 'database/system/playerAnimationSet', 'System player animation set');
  for (const item of items.items) {
    add(refs, 'items', item.slot ? item.id : undefined, `database/items/${item.id}/slot`, 'Equippable item');
  }
  return refs;
}

export function findReferences(project: FullProjectState, target: ReferenceTarget): ReferenceRecord[] {
  return listReferences(project).filter(ref => matches(ref, target));
}

function renameCommandReferences(command: EventCommand, table: ReferenceTable, oldId: string, newId: string) {
  switch (command.type) {
    case 'ifSwitch':
    case 'controlSwitch':
      if (table === 'switches' && command.switchId === oldId) command.switchId = newId;
      break;
    case 'ifVariable':
      if (table === 'variables' && command.variableId === oldId) command.variableId = newId;
      break;
    case 'controlVariable':
      if (table === 'variables' && command.variableId === oldId) command.variableId = newId;
      if (table === 'variables' && command.sourceVariableId === oldId) command.sourceVariableId = newId;
      break;
    case 'addItem':
    case 'removeItem':
      if (table === 'items' && command.itemId === oldId) command.itemId = newId;
      break;
    case 'callCommonEvent':
      if (table === 'commonEvents' && command.commonEventId === oldId) command.commonEventId = newId;
      break;
    case 'startQuest':
    case 'completeQuest':
      if (table === 'quests' && command.questId === oldId) command.questId = newId;
      break;
    case 'updateQuestObjective':
      if (table === 'quests' && command.questId === oldId) command.questId = newId;
      if (table === 'questObjectives' && command.objectiveId === oldId) command.objectiveId = newId;
      break;
    case 'openShop':
      if (table === 'shops' && command.shopId === oldId) command.shopId = newId;
      break;
    case 'startBattle':
      if (table === 'troops' && command.troopId === oldId) command.troopId = newId;
      break;
    case 'changeActorHp':
      if (table === 'actors' && command.actorId === oldId) command.actorId = newId;
      break;
    default:
      break;
  }
}

function renameCommandListReferences(commands: EventCommand[], table: ReferenceTable, oldId: string, newId: string) {
  for (const command of commands) {
    renameCommandReferences(command, table, oldId, newId);
    if (command.type === 'ifFlag' || command.type === 'ifSwitch' || command.type === 'ifSelfSwitch' || command.type === 'ifVariable') {
      renameCommandListReferences(command.then, table, oldId, newId);
      renameCommandListReferences(command.else, table, oldId, newId);
    } else if (command.type === 'showChoices') {
      for (const choice of command.choices) {
        renameCommandListReferences(choice.commands, table, oldId, newId);
      }
    } else if (command.type === 'startBattle') {
      renameCommandListReferences(command.victoryBranch ?? [], table, oldId, newId);
      renameCommandListReferences(command.defeatBranch ?? [], table, oldId, newId);
    }
  }
}

export function renameReferences(project: FullProjectState, table: ReferenceTable, oldId: string, newId: string): FullProjectState {
  for (const map of Object.values(project.maps)) {
    if (table === 'tilesets' && map.tilesetId === oldId) map.tilesetId = newId;
    for (const event of map.events) {
      if (table === 'animations' && event.animationSet === oldId) event.animationSet = newId;
      renameCommandListReferences(event.commands, table, oldId, newId);
      for (const page of event.pages ?? []) {
        if (table === 'switches' && page.conditions.switches?.[oldId] !== undefined) {
          page.conditions.switches[newId] = page.conditions.switches[oldId];
          delete page.conditions.switches[oldId];
        }
        if (table === 'variables') {
          for (const variable of page.conditions.variables ?? []) {
            if (variable.variableId === oldId) variable.variableId = newId;
          }
        }
        if (table === 'animations' && page.graphic.animationSet === oldId) page.graphic.animationSet = newId;
        renameCommandListReferences(page.commands, table, oldId, newId);
      }
    }
  }

  const { databases, items } = project;
  for (const actor of databases.actors) {
    if (table === 'classes' && actor.classId === oldId) actor.classId = newId;
    if (table === 'skills') actor.skills = actor.skills.map(skillId => skillId === oldId ? newId : skillId);
    if (table === 'items') {
      for (const [slot, itemId] of Object.entries(actor.equipment)) {
        if (itemId === oldId) actor.equipment[slot as keyof typeof actor.equipment] = newId;
      }
    }
  }
  for (const cls of databases.classes) {
    if (table === 'skills') {
      for (const learned of cls.learnedSkills) {
        if (learned.skillId === oldId) learned.skillId = newId;
      }
    }
  }
  for (const weapon of databases.weapons) {
    if (table === 'animations' && weapon.animationId === oldId) weapon.animationId = newId;
  }
  for (const enemy of databases.enemies) {
    if (table === 'items') {
      for (const drop of enemy.drops) {
        if (drop.itemId === oldId) drop.itemId = newId;
      }
    }
  }
  for (const troop of databases.troops) {
    if (table === 'enemies') troop.members = troop.members.map(enemyId => enemyId === oldId ? newId : enemyId);
  }
  for (const quest of databases.quests) {
    if (table === 'items') {
      for (const reward of quest.rewards.items) {
        if (reward.itemId === oldId) reward.itemId = newId;
      }
    }
  }
  for (const shop of databases.shops) {
    if (table === 'items') {
      for (const listing of shop.listings) {
        if (listing.itemId === oldId) listing.itemId = newId;
      }
    }
  }
  for (const commonEvent of databases.commonEvents) {
    if (table === 'switches' && commonEvent.switchId === oldId) commonEvent.switchId = newId;
    renameCommandListReferences(commonEvent.commands, table, oldId, newId);
  }
  if (table === 'actors') {
    databases.system.startingParty = databases.system.startingParty.map(actorId => actorId === oldId ? newId : actorId);
  }
  if (table === 'animations' && databases.system.playerAnimationSet === oldId) {
    databases.system.playerAnimationSet = newId;
  }
  if (table === 'items') {
    for (const item of items.items) {
      if (item.id === oldId) item.id = newId;
    }
  }
  return project;
}
