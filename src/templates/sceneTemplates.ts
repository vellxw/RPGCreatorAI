import type { Direction, GameEvent, MapData } from '../types/project';

export interface SceneTemplate {
  id:
    | 'story-room-16x9'
    | 'town-street-16x9'
    | 'forest-clearing-16x9'
    | 'snowy-village-16x9'
    | 'square-room'
    | 'small-interior'
    | 'cave-battle-approach';
  label: string;
  aspectRatio: '16:9' | '1:1' | 'custom';
  description: string;
  map: MapData;
  startPosition: { x: number; y: number; direction: Direction };
}

type MutableMap = {
  width: number;
  height: number;
  ground: number[];
  collision: number[];
};

function indexOf(map: MutableMap, x: number, y: number): number {
  return y * map.width + x;
}

function setGround(map: MutableMap, x: number, y: number, tile: number): void {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return;
  map.ground[indexOf(map, x, y)] = tile;
}

function setCollision(map: MutableMap, x: number, y: number, tile: 0 | 9): void {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return;
  map.collision[indexOf(map, x, y)] = tile;
}

function fillRect(map: MutableMap, x: number, y: number, width: number, height: number, tile: number): void {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      setGround(map, xx, yy, tile);
    }
  }
}

function border(map: MutableMap, groundTile: number): void {
  for (let x = 0; x < map.width; x += 1) {
    setGround(map, x, 0, groundTile);
    setGround(map, x, map.height - 1, groundTile);
    setCollision(map, x, 0, 9);
    setCollision(map, x, map.height - 1, 9);
  }
  for (let y = 0; y < map.height; y += 1) {
    setGround(map, 0, y, groundTile);
    setGround(map, map.width - 1, y, groundTile);
    setCollision(map, 0, y, 9);
    setCollision(map, map.width - 1, y, 9);
  }
}

function baseMap(id: string, name: string, width: number, height: number, baseTile: number): MutableMap {
  return {
    width,
    height,
    ground: new Array(width * height).fill(baseTile),
    collision: new Array(width * height).fill(0),
  };
}

function finalizeMap(id: string, name: string, map: MutableMap, events: GameEvent[]): MapData {
  return {
    schemaVersion: 1,
    id,
    name,
    width: map.width,
    height: map.height,
    tileSize: 32,
    layers: [
      { name: 'ground', type: 'visual', tiles: map.ground },
      { name: 'collision', type: 'collision', tiles: map.collision },
    ],
    events,
  };
}

function talker(id: string, x: number, y: number, text: string, sprite = 'npc_old_man'): GameEvent {
  return {
    id,
    type: 'npc',
    x,
    y,
    solid: true,
    sprite,
    trigger: 'interact',
    commands: [{ type: 'showText', text }],
  };
}

function chest(id: string, x: number, y: number, text: string): GameEvent {
  return {
    id,
    type: 'chest',
    x,
    y,
    solid: true,
    sprite: 'chest_closed',
    trigger: 'interact',
    commands: [{ type: 'showText', text }],
  };
}

function trigger(id: string, x: number, y: number, text: string): GameEvent {
  return {
    id,
    type: 'trigger',
    x,
    y,
    solid: false,
    sprite: 'battle_marker',
    trigger: 'touch',
    commands: [{ type: 'showText', text }],
  };
}

function storyRoomTemplate(): SceneTemplate {
  const map = baseMap('story-room-16x9', 'Story Room 16:9', 40, 23, 6);
  border(map, 7);
  fillRect(map, 3, 2, 34, 4, 7);
  fillRect(map, 5, 8, 10, 3, 2);
  fillRect(map, 24, 13, 10, 3, 2);
  fillRect(map, 17, 18, 6, 2, 2);
  setGround(map, 19, 22, 2);
  setCollision(map, 19, 22, 0);
  return {
    id: 'story-room-16x9',
    label: '16:9 story room',
    aspectRatio: '16:9',
    description: 'Compact emotional interior with centered staging and side props.',
    map: finalizeMap('story-room-16x9', 'Story Room 16:9', map, [
      talker('room_npc', 20, 10, 'This room is ready for a story beat.'),
      chest('room_chest', 29, 15, 'A keepsake rests inside.'),
    ]),
    startPosition: { x: 19, y: 18, direction: 'up' },
  };
}

function townStreetTemplate(): SceneTemplate {
  const map = baseMap('town-street-16x9', 'Town Street 16:9', 40, 23, 1);
  border(map, 5);
  fillRect(map, 0, 10, 40, 4, 2);
  fillRect(map, 17, 0, 6, 23, 2);
  fillRect(map, 4, 4, 7, 5, 7);
  fillRect(map, 28, 4, 8, 5, 7);
  for (const [x, y] of [[3, 15], [7, 18], [12, 3], [31, 16], [35, 18], [25, 19]]) {
    setGround(map, x, y, 5);
  }
  return {
    id: 'town-street-16x9',
    label: '16:9 town street',
    aspectRatio: '16:9',
    description: 'Wide town crossing with visual anchors and storefront rhythm.',
    map: finalizeMap('town-street-16x9', 'Town Street 16:9', map, [
      talker('town_greeter', 19, 9, 'Welcome to the town street.'),
      talker('town_shopkeeper', 30, 10, 'The shop is open.', 'npc_shopkeeper'),
      chest('town_crate', 8, 16, 'A spare supply crate.'),
    ]),
    startPosition: { x: 20, y: 13, direction: 'up' },
  };
}

function forestClearingTemplate(): SceneTemplate {
  const map = baseMap('forest-clearing-16x9', 'Forest Clearing 16:9', 40, 23, 1);
  border(map, 5);
  fillRect(map, 14, 7, 12, 8, 2);
  fillRect(map, 3, 16, 8, 4, 3);
  for (const [x, y] of [
    [4, 4], [8, 6], [10, 17], [13, 3], [28, 4], [32, 7], [35, 15], [28, 18], [20, 19],
  ]) {
    setGround(map, x, y, 5);
  }
  return {
    id: 'forest-clearing-16x9',
    label: '16:9 forest clearing',
    aspectRatio: '16:9',
    description: 'Natural wide clearing with path focus, water, and tree framing.',
    map: finalizeMap('forest-clearing-16x9', 'Forest Clearing 16:9', map, [
      talker('forest_wanderer', 20, 10, 'The clearing feels peaceful today.'),
      chest('forest_cache', 27, 16, 'You found a woodland cache.'),
    ]),
    startPosition: { x: 20, y: 14, direction: 'up' },
  };
}

function snowyVillageTemplate(): SceneTemplate {
  const map = baseMap('snowy-village-16x9', 'Snowy Village 16:9', 40, 23, 4);
  border(map, 5);
  fillRect(map, 0, 11, 40, 3, 2);
  fillRect(map, 18, 0, 4, 23, 2);
  fillRect(map, 5, 4, 8, 5, 7);
  fillRect(map, 27, 5, 8, 5, 7);
  for (const [x, y] of [[3, 17], [10, 18], [14, 4], [25, 17], [34, 18], [37, 6]]) {
    setGround(map, x, y, 5);
  }
  return {
    id: 'snowy-village-16x9',
    label: '16:9 snowy village',
    aspectRatio: '16:9',
    description: 'Snowfield composition with warm village blocks and clear lanes.',
    map: finalizeMap('snowy-village-16x9', 'Snowy Village 16:9', map, [
      talker('snow_villager', 20, 10, 'Snow keeps the village quiet.'),
      chest('snow_supply', 31, 15, 'Cold-weather supplies.'),
    ]),
    startPosition: { x: 20, y: 15, direction: 'up' },
  };
}

function squareRoomTemplate(): SceneTemplate {
  const map = baseMap('square-room', 'Square Room', 24, 24, 6);
  border(map, 7);
  fillRect(map, 4, 4, 16, 3, 7);
  fillRect(map, 5, 10, 5, 4, 2);
  fillRect(map, 15, 15, 4, 4, 2);
  return {
    id: 'square-room',
    label: 'Square room',
    aspectRatio: '1:1',
    description: 'Intentional compact square composition for intimate scenes.',
    map: finalizeMap('square-room', 'Square Room', map, [
      talker('square_host', 12, 10, 'A square room can still feel authored.'),
      chest('square_chest', 18, 18, 'A tidy reward chest.'),
    ]),
    startPosition: { x: 12, y: 18, direction: 'up' },
  };
}

function smallInteriorTemplate(): SceneTemplate {
  const map = baseMap('small-interior', 'Small Interior', 20, 15, 6);
  border(map, 7);
  fillRect(map, 3, 2, 14, 3, 7);
  fillRect(map, 3, 8, 5, 3, 2);
  fillRect(map, 12, 8, 5, 3, 2);
  return {
    id: 'small-interior',
    label: 'Small interior',
    aspectRatio: 'custom',
    description: 'Small room layout with denser furniture placement and clear circulation.',
    map: finalizeMap('small-interior', 'Small Interior', map, [
      talker('interior_resident', 10, 7, 'Small rooms should still read clearly.'),
      chest('interior_chest', 15, 10, 'A useful household item.'),
    ]),
    startPosition: { x: 10, y: 12, direction: 'up' },
  };
}

function caveBattleApproachTemplate(): SceneTemplate {
  const map = baseMap('cave-battle-approach', 'Cave Battle Approach', 40, 23, 2);
  border(map, 7);
  fillRect(map, 0, 0, 40, 5, 7);
  fillRect(map, 0, 18, 40, 5, 7);
  fillRect(map, 4, 8, 8, 7, 7);
  fillRect(map, 28, 8, 8, 7, 7);
  fillRect(map, 18, 9, 4, 5, 3);
  return {
    id: 'cave-battle-approach',
    label: 'Cave / battle approach',
    aspectRatio: '16:9',
    description: 'Tense combat lane with blockers, water, and a clear encounter focal point.',
    map: finalizeMap('cave-battle-approach', 'Cave Battle Approach', map, [
      trigger('battle_marker', 20, 12, 'An encounter waits ahead.'),
      chest('cave_cache', 24, 15, 'A reward before the descent.'),
    ]),
    startPosition: { x: 20, y: 16, direction: 'up' },
  };
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  storyRoomTemplate(),
  townStreetTemplate(),
  forestClearingTemplate(),
  snowyVillageTemplate(),
  squareRoomTemplate(),
  smallInteriorTemplate(),
  caveBattleApproachTemplate(),
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function cloneSceneTemplateMap(templateId: SceneTemplate['id'], mapId: string, mapName: string): MapData {
  const template = SCENE_TEMPLATES.find(candidate => candidate.id === templateId);
  if (!template) throw new Error(`Unknown scene template "${templateId}"`);
  const clone = deepClone(template.map);
  clone.id = mapId;
  clone.name = mapName;
  return clone;
}

export function getSceneTemplate(templateId: SceneTemplate['id']): SceneTemplate {
  const template = SCENE_TEMPLATES.find(candidate => candidate.id === templateId);
  if (!template) throw new Error(`Unknown scene template "${templateId}"`);
  return template;
}
