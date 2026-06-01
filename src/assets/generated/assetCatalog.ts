const asset = (name: string) => new URL(`./${name}.png`, import.meta.url).href;
const directions = ['down', 'left', 'right', 'up'] as const;
const playerActions = ['idle', 'walk', 'interact', 'attack', 'hurt', 'death'] as const;
const npcActions = ['idle', 'walk'] as const;

export const animationSheetKeys = [
  ...playerActions.flatMap(action => directions.map(direction => `player_adventurer_${action}_${direction}`)),
  ...npcActions.flatMap(action => directions.map(direction => `npc_old_man_${action}_${direction}`)),
  ...npcActions.flatMap(action => directions.map(direction => `npc_shopkeeper_${action}_${direction}`)),
] as const;

export const animationSheetAssets = Object.fromEntries(
  animationSheetKeys.map(key => [key, asset(key)]),
) as Record<(typeof animationSheetKeys)[number], string>;

const animationAsset = (prefix: string, action: string, direction: string) =>
  animationSheetAssets[`${prefix}_${action}_${direction}` as keyof typeof animationSheetAssets];

function animationStripSet(prefix: string, actions: readonly string[]) {
  return Object.fromEntries(
    actions.map(action => [
      action,
      Object.fromEntries(directions.map(direction => [direction, animationAsset(prefix, action, direction)])),
    ]),
  );
}

export const gameAssets = {
  grass: asset('tile_grass'),
  path: asset('tile_path'),
  water: asset('tile_water'),
  wall: asset('tile_wall'),
  snow: asset('tile_snow'),
  tree: asset('tile_tree'),
  interiorFloor: asset('tile_interior_floor'),
  interiorWall: asset('tile_interior_wall'),
  collisionOverlay: asset('tile_collision_overlay'),
  voidWarning: asset('tile_void_warning'),
  player: asset('player_adventurer'),
  oldMan: asset('npc_old_man'),
  shopkeeper: asset('npc_shopkeeper'),
  chest: asset('chest_closed'),
  door: asset('transfer_door'),
  shopMarker: asset('shop_marker'),
  battleMarker: asset('battle_marker'),
  slime: asset('enemy_slime'),
  potion: asset('item_potion'),
  sword: asset('item_sword'),
  shield: asset('item_shield'),
  skillBook: asset('skill_book'),
} as const;

export const animationAssets = {
  playerAdventurer: animationStripSet('player_adventurer', playerActions),
  oldMan: animationStripSet('npc_old_man', npcActions),
  shopkeeper: animationStripSet('npc_shopkeeper', npcActions),
} as const;

export const editorAssets = {
  map: asset('icon_map'),
  event: asset('icon_event'),
  database: asset('icon_database'),
  dialogue: asset('icon_dialogue'),
  assets: asset('icon_assets'),
  settings: asset('icon_settings'),
  save: asset('icon_save'),
  load: asset('icon_load'),
  undo: asset('icon_undo'),
  redo: asset('icon_redo'),
  duplicate: asset('icon_duplicate'),
  delete: asset('icon_delete'),
} as const;

export const uiAssets = {
  inventory: asset('ui_inventory'),
  questJournal: asset('ui_quest_journal'),
  status: asset('ui_status'),
  battle: asset('ui_battle'),
  shop: asset('ui_shop'),
} as const;

export const eventAssets = {
  npc: gameAssets.oldMan,
  transfer: gameAssets.door,
  chest: gameAssets.chest,
  object: gameAssets.slime,
  trigger: gameAssets.battleMarker,
} as const;
