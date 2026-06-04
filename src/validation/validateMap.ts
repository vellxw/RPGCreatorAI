import type { MapData, ValidationMessage, GameEvent, EventCommand } from '../types/project';
import {
  isSupportedCollisionTile,
  isSupportedRegionTile,
  isSupportedVisualTile,
  isVoidVisualTile,
} from '../visual/tileCatalog';

const VALID_TRIGGERS = ['interact', 'touch', 'autorun', 'parallel'];
const VALID_SCROLL_TYPES = ['none', 'vertical', 'horizontal', 'both'];
const VALID_PAGE_PRIORITIES = ['belowCharacters', 'sameAsCharacters', 'aboveCharacters'];
const VALID_SELF_SWITCHES = ['A', 'B', 'C', 'D'];
const VALID_MOVEMENT_ROUTE_TARGETS = ['player', 'thisEvent', 'event'];
const VALID_MOVEMENT_ROUTE_STEPS = new Set([
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'turnUp',
  'turnDown',
  'turnLeft',
  'turnRight',
  'wait',
]);

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

const SAFE_PLUGIN_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_PLUGIN_COMMAND = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/;
const SAFE_PLUGIN_ARG_KEY = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const CODE_LIKE_PLUGIN_TEXT =
  /(?:=>|\bfunction\b|\beval\s*\(|\bimport\s*\(|\brequire\s*\(|\bnew\s+Function\b|<script\b)/i;

export interface MapValidationOptions {
  isSupportedVisualTile?(tileId: number, tilesetId: string | undefined): boolean;
}

export function validateMap(
  map: MapData,
  allMapIds: string[],
  options: MapValidationOptions = {},
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const supportsVisualTile = options.isSupportedVisualTile ?? isSupportedVisualTile;

  if (map.scrollType !== undefined && !VALID_SCROLL_TYPES.includes(map.scrollType)) {
    messages.push({
      level: 'error',
      message: `Map "${map.id}" has invalid scrollType "${map.scrollType}"`,
      source: `${map.id}/scrollType`,
    });
  }
  if (
    map.encounterSteps !== undefined &&
    (!Number.isFinite(map.encounterSteps) || map.encounterSteps < 0)
  ) {
    messages.push({
      level: 'error',
      message: `Map "${map.id}" encounterSteps must be non-negative`,
      source: `${map.id}/encounterSteps`,
    });
  }
  if (map.parallax) {
    if (map.parallax.scrollX !== undefined && !Number.isFinite(map.parallax.scrollX)) {
      messages.push({
        level: 'error',
        message: `Map "${map.id}" parallax.scrollX must be finite`,
        source: `${map.id}/parallax`,
      });
    }
    if (map.parallax.scrollY !== undefined && !Number.isFinite(map.parallax.scrollY)) {
      messages.push({
        level: 'error',
        message: `Map "${map.id}" parallax.scrollY must be finite`,
        source: `${map.id}/parallax`,
      });
    }
  }

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

      const unsupported = [...new Set(layer.tiles.filter(tile => !supportsVisualTile(tile, map.tilesetId)))];
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

  if (!Array.isArray(event.commands)) {
    messages.push({
      level: 'error',
      message: `Event "${event.id}" commands must be an array`,
      source: `${map.id}/${event.id}`,
    });
  } else {
    messages.push(...validateCommands(event.commands, event.id, map.id, allMapIds, map.events));
  }
  if (event.pages) {
    messages.push(...validateEventPages(event, map, allMapIds));
  }

  if (event.type === 'npc' && !event.sprite) {
    messages.push({
      level: 'warning',
      message: `NPC "${event.id}" has no movement pattern`,
      source: `${map.id}/${event.id}`,
    });
  }

  return messages;
}

function validateEventPages(event: GameEvent, map: MapData, allMapIds: string[]): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const seen = new Set<string>();
  for (const page of event.pages ?? []) {
    if (!page.id || !page.id.trim()) {
      messages.push({
        level: 'error',
        message: `Event "${event.id}" has a page without an id`,
        source: `${map.id}/${event.id}`,
      });
    } else if (seen.has(page.id)) {
      messages.push({
        level: 'error',
        message: `Event "${event.id}" has duplicate page id "${page.id}"`,
        source: `${map.id}/${event.id}`,
      });
    }
    seen.add(page.id);

    if (!VALID_TRIGGERS.includes(page.trigger)) {
      messages.push({
        level: 'error',
        message: `Event "${event.id}" page "${page.id}" has invalid trigger "${page.trigger}"`,
        source: `${map.id}/${event.id}/${page.id}`,
      });
    }
    if (!VALID_PAGE_PRIORITIES.includes(page.priority)) {
      messages.push({
        level: 'error',
        message: `Event "${event.id}" page "${page.id}" has invalid priority "${page.priority}"`,
        source: `${map.id}/${event.id}/${page.id}`,
      });
    }
    for (const key of Object.keys(page.conditions?.selfSwitches ?? {})) {
      if (!VALID_SELF_SWITCHES.includes(key)) {
        messages.push({
          level: 'error',
          message: `Event "${event.id}" page "${page.id}" has invalid self switch "${key}"`,
          source: `${map.id}/${event.id}/${page.id}`,
        });
      }
    }
    if (!Array.isArray(page.commands)) {
      messages.push({
        level: 'error',
        message: `Event "${event.id}" page "${page.id}" commands must be an array`,
        source: `${map.id}/${event.id}/${page.id}`,
      });
    } else {
      messages.push(...validateCommands(page.commands, event.id, map.id, allMapIds, map.events));
    }
  }
  return messages;
}

function validateCommands(
  commands: EventCommand[],
  eventId: string,
  mapId: string,
  allMapIds: string[],
  mapEvents: GameEvent[],
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

    if (cmd.type === 'ifFlag' || cmd.type === 'ifSwitch' || cmd.type === 'ifSelfSwitch' || cmd.type === 'ifVariable') {
      if (cmd.type === 'ifSelfSwitch' && !VALID_SELF_SWITCHES.includes(cmd.switchId)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" ifSelfSwitch uses invalid self switch "${cmd.switchId}"`,
          source: `${mapId}/${eventId}`,
        });
      }
      messages.push(...validateCommands(cmd.then, eventId, mapId, allMapIds, mapEvents));
      messages.push(...validateCommands(cmd.else, eventId, mapId, allMapIds, mapEvents));
    } else if (cmd.type === 'controlSelfSwitch') {
      if (!VALID_SELF_SWITCHES.includes(cmd.switchId)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" controlSelfSwitch uses invalid self switch "${cmd.switchId}"`,
          source: `${mapId}/${eventId}`,
        });
      }
    } else if (cmd.type === 'showChoices') {
      for (const choice of cmd.choices) {
        messages.push(...validateCommands(choice.commands, eventId, mapId, allMapIds, mapEvents));
      }
    } else if (cmd.type === 'startBattle') {
      if (cmd.victoryBranch) messages.push(...validateCommands(cmd.victoryBranch, eventId, mapId, allMapIds, mapEvents));
      if (cmd.defeatBranch) messages.push(...validateCommands(cmd.defeatBranch, eventId, mapId, allMapIds, mapEvents));
    } else if (cmd.type === 'pluginCommand') {
      validatePluginCommand(cmd, eventId, mapId, messages);
    } else if (cmd.type === 'setMovementRoute') {
      if (!VALID_MOVEMENT_ROUTE_TARGETS.includes(cmd.target)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" setMovementRoute has invalid target "${cmd.target}"`,
          source: `${mapId}/${eventId}`,
        });
      }
      if (cmd.target === 'event' && !mapEvents.some(event => event.id === cmd.eventId)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" setMovementRoute targets unknown event "${cmd.eventId ?? ''}"`,
          source: `${mapId}/${eventId}`,
        });
      }
      if (!Array.isArray(cmd.steps)) {
        messages.push({
          level: 'error',
          message: `Event "${eventId}" setMovementRoute steps must be an array`,
          source: `${mapId}/${eventId}`,
        });
        continue;
      }
      cmd.steps.forEach((step, index) => {
        if (!VALID_MOVEMENT_ROUTE_STEPS.has(step.type)) {
          messages.push({
            level: 'error',
            message: `Event "${eventId}" setMovementRoute step ${index + 1} has invalid step type "${step.type}"`,
            source: `${mapId}/${eventId}`,
          });
        }
        if (step.type === 'wait' && (!Number.isFinite(step.ms) || (step.ms ?? 0) < 0)) {
          messages.push({
            level: 'error',
            message: `Event "${eventId}" setMovementRoute step ${index + 1} wait ms must be a non-negative finite number`,
            source: `${mapId}/${eventId}`,
          });
        }
      });
    }
  }

  return messages;
}

function validatePluginCommand(
  cmd: EventCommand,
  eventId: string,
  mapId: string,
  messages: ValidationMessage[],
): void {
  if (cmd.type !== 'pluginCommand') return;
  const source = `${mapId}/${eventId}`;
  const error = (message: string) => {
    messages.push({ level: 'error', message: `Event "${eventId}" ${message}`, source });
  };

  if (!SAFE_PLUGIN_IDENTIFIER.test(cmd.pluginId)) {
    error(`pluginCommand pluginId "${cmd.pluginId}" is not a safe identifier`);
  }
  if (!SAFE_PLUGIN_COMMAND.test(cmd.command)) {
    error(`pluginCommand command "${cmd.command}" is not a safe identifier`);
  }

  const args = (cmd as { args?: unknown }).args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    error(`pluginCommand args must be an object of scalar values`);
    return;
  }

  for (const [key, value] of Object.entries(args)) {
    if (!SAFE_PLUGIN_ARG_KEY.test(key)) {
      error(`pluginCommand arg "${key}" is not a safe identifier`);
    }
    if (!isPluginScalarArg(value)) {
      error(`pluginCommand arg "${key}" must be a scalar`);
      continue;
    }
    if (typeof value === 'string' && CODE_LIKE_PLUGIN_TEXT.test(value)) {
      error(`pluginCommand arg "${key}" contains code-like text`);
    }
  }
}

function isPluginScalarArg(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
