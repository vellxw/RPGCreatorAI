import type { MapData, ValidationMessage, GameEvent, EventCommand } from '../types/project';
import {
  isSupportedCollisionTile,
  isSupportedRegionTile,
  isSupportedVisualTile,
  isVoidVisualTile,
} from '../visual/tileCatalog';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];

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

export function validateMap(map: MapData, allMapIds: string[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // Check dimensions
  const expectedTiles = map.width * map.height;
  if (map.tilesetId !== undefined) {
    const requiredLayers = ['ground', 'decoration', 'foreground', 'collision', 'region'];
    for (const name of requiredLayers) {
      if (!map.layers.some(layer => layer.name === name)) {
        messages.push({
          level: 'error',
          message: `Map "${map.id}" is missing required layer "${name}"`,
          source: `${map.id}/layers`,
        });
      }
    }
  }
  for (const layer of map.layers) {
    if (layer.tiles.length !== expectedTiles) {
      messages.push({
        level: 'error',
        message: `Layer "${layer.name}" has ${layer.tiles.length} tiles, expected ${expectedTiles}`,
        source: `${map.id}/${layer.name}`,
      });
    }

    if (layer.type === 'visual') {
      const voidCount = layer.tiles.filter(isVoidVisualTile).length;
      if (voidCount > 0 && (layer.role ?? layer.name) === 'ground') {
        messages.push({
          level: 'warning',
          message: `Layer "${layer.name}" contains ${voidCount} void tile${voidCount === 1 ? '' : 's'}`,
          source: `${map.id}/${layer.name}`,
        });
      }

      const unsupported = [...new Set(layer.tiles.filter(tile => !isSupportedVisualTile(tile, map.tilesetId)))];
      for (const tileId of unsupported) {
        messages.push({
          level: 'error',
          message: `Layer "${layer.name}" uses unsupported visual tile id "${tileId}"`,
          source: `${map.id}/${layer.name}`,
        });
      }
    }

    if (layer.type === 'collision') {
      const unsupported = [...new Set(layer.tiles.filter(tile => !isSupportedCollisionTile(tile)))];
      for (const tileId of unsupported) {
        messages.push({
          level: 'error',
          message: `Layer "${layer.name}" uses unsupported collision tile id "${tileId}"`,
          source: `${map.id}/${layer.name}`,
        });
      }
    }
    if (layer.type === 'region') {
      const unsupported = [...new Set(layer.tiles.filter(tile => !isSupportedRegionTile(tile)))];
      for (const tileId of unsupported) {
        messages.push({
          level: 'error',
          message: `Layer "${layer.name}" uses unsupported region id "${tileId}"`,
          source: `${map.id}/${layer.name}`,
        });
      }
    }
  }

  // Validate events
  for (const event of map.events) {
    messages.push(...validateEvent(event, map, allMapIds));
  }

  if (messages.filter(m => m.level === 'error').length === 0) {
    messages.unshift({
      level: 'info',
      message: `Map has no blocking errors`,
      source: map.id,
    });
  }

  return messages;
}

export function validateEvent(event: GameEvent, map: MapData, allMapIds: string[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  if (!event.id || event.id.trim() === '') {
    messages.push({
      level: 'error',
      message: `Event is missing an id`,
      source: `${map.id}/unknown`,
    });
  }

  if (event.x < 0 || event.x >= map.width || event.y < 0 || event.y >= map.height) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" position (${event.x}, ${event.y}) is out of map bounds (${map.width}x${map.height})`,
      source: `${map.id}/${event.id}`,
    });
  }

  if (!VALID_TRIGGERS.includes(event.trigger)) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" has invalid trigger "${event.trigger}"`,
      source: `${map.id}/${event.id}`,
    });
  }

  if (
    event.displayHeightTiles !== undefined &&
    (!Number.isFinite(event.displayHeightTiles) || event.displayHeightTiles <= 0)
  ) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" displayHeightTiles must be a positive finite number`,
      source: `${map.id}/${event.id}`,
    });
  }

  messages.push(...validateCommands(event.commands, event.id, map.id, allMapIds));

  if (event.type === 'npc' && !event.sprite) {
    messages.push({
      level: 'warning',
      message: `NPC "${event.id}" has no movement pattern`,
      source: `${map.id}/${event.id}`,
    });
  }

  return messages;
}

function validateCommands(
  commands: EventCommand[],
  eventId: string,
  mapId: string,
  allMapIds: string[],
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const cmd of commands) {
    if (!VALID_COMMAND_TYPES.has(cmd.type)) {
      messages.push({
        level: 'error',
        message: `Event "${eventId}" has unknown command type "${cmd.type}"`,
        source: `${mapId}/${eventId}`,
      });
    }

    if (cmd.type === 'transferMap' || cmd.type === 'setPlayerPosition') {
      if (!allMapIds.includes(cmd.mapId)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" ${cmd.type} targets unknown map "${cmd.mapId}"`,
          source: `${mapId}/${eventId}`,
        });
      }
    }

    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifVariable') {
      messages.push(...validateCommands(cmd.then, eventId, mapId, allMapIds));
      messages.push(...validateCommands(cmd.else, eventId, mapId, allMapIds));
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) {
        messages.push(...validateCommands(choice.commands, eventId, mapId, allMapIds));
      }
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) messages.push(...validateCommands(cmd.victoryBranch, eventId, mapId, allMapIds));
      if (cmd.defeatBranch) messages.push(...validateCommands(cmd.defeatBranch, eventId, mapId, allMapIds));
    }
  }

  return messages;
}
