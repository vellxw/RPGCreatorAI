import type { MapData, ValidationMessage, GameEvent, EventCommand } from '../types/project';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];
const VALID_COMMAND_TYPES = ['showText', 'setFlag', 'ifFlag', 'addItem', 'transferMap', 'playSound'];

export function validateMap(map: MapData, allMapIds: string[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  // Check dimensions
  const expectedTiles = map.width * map.height;
  for (const layer of map.layers) {
    if (layer.tiles.length !== expectedTiles) {
      messages.push({
        level: 'error',
        message: `Layer "${layer.name}" has ${layer.tiles.length} tiles, expected ${expectedTiles}`,
        source: `${map.id}/${layer.name}`,
      });
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

  // Event must have id
  if (!event.id || event.id.trim() === '') {
    messages.push({
      level: 'error',
      message: `Event is missing an id`,
      source: `${map.id}/unknown`,
    });
  }

  // Position within bounds
  if (event.x < 0 || event.x >= map.width || event.y < 0 || event.y >= map.height) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" position (${event.x}, ${event.y}) is out of map bounds (${map.width}x${map.height})`,
      source: `${map.id}/${event.id}`,
    });
  }

  // Valid trigger
  if (!VALID_TRIGGERS.includes(event.trigger)) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" has invalid trigger "${event.trigger}"`,
      source: `${map.id}/${event.id}`,
    });
  }

  // Validate commands
  messages.push(...validateCommands(event.commands, event.id, map.id, allMapIds));

  // Warnings
  if (event.type === 'npc' && !event.sprite) {
    messages.push({
      level: 'warning',
      message: `NPC "${event.id}" has no movement pattern`,
      source: `${map.id}/${event.id}`,
    });
  }

  return messages;
}

function validateCommands(commands: EventCommand[], eventId: string, mapId: string, allMapIds: string[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];

  for (const cmd of commands) {
    if (!VALID_COMMAND_TYPES.includes(cmd.type)) {
      messages.push({
        level: 'error',
        message: `Event "${eventId}" has unknown command type "${cmd.type}"`,
        source: `${mapId}/${eventId}`,
      });
    }

    if (cmd.type === 'transferMap') {
      if (!allMapIds.includes(cmd.mapId)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" transfers to unknown map "${cmd.mapId}"`,
          source: `${mapId}/${eventId}`,
        });
      }
    }

    if (cmd.type === 'ifFlag') {
      messages.push(...validateCommands(cmd.then, eventId, mapId, allMapIds));
      messages.push(...validateCommands(cmd.else, eventId, mapId, allMapIds));
    }
  }

  return messages;
}
