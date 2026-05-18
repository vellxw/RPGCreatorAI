import { describe, expect, it } from 'vitest';
import { editorAssets, eventAssets, gameAssets, uiAssets } from '../assetCatalog';

describe('generated asset catalog', () => {
  it('exposes the required production game assets', () => {
    expect(gameAssets).toMatchObject({
      grass: expect.stringContaining('tile_grass'),
      path: expect.stringContaining('tile_path'),
      water: expect.stringContaining('tile_water'),
      wall: expect.stringContaining('tile_wall'),
      snow: expect.stringContaining('tile_snow'),
      tree: expect.stringContaining('tile_tree'),
      interiorFloor: expect.stringContaining('tile_interior_floor'),
      interiorWall: expect.stringContaining('tile_interior_wall'),
      collisionOverlay: expect.stringContaining('tile_collision_overlay'),
      voidWarning: expect.stringContaining('tile_void_warning'),
      player: expect.stringContaining('player_adventurer'),
      oldMan: expect.stringContaining('npc_old_man'),
      shopkeeper: expect.stringContaining('npc_shopkeeper'),
      chest: expect.stringContaining('chest_closed'),
      door: expect.stringContaining('transfer_door'),
      shopMarker: expect.stringContaining('shop_marker'),
      battleMarker: expect.stringContaining('battle_marker'),
      slime: expect.stringContaining('enemy_slime'),
      potion: expect.stringContaining('item_potion'),
      sword: expect.stringContaining('item_sword'),
      shield: expect.stringContaining('item_shield'),
      skillBook: expect.stringContaining('skill_book'),
    });
  });

  it('provides editor and runtime-facing UI assets without emoji fallbacks', () => {
    expect(editorAssets.map).toContain('icon_map');
    expect(editorAssets.event).toContain('icon_event');
    expect(editorAssets.database).toContain('icon_database');
    expect(uiAssets.inventory).toContain('ui_inventory');
    expect(uiAssets.questJournal).toContain('ui_quest_journal');
    expect(uiAssets.status).toContain('ui_status');
    expect(uiAssets.battle).toContain('ui_battle');
    expect(uiAssets.shop).toContain('ui_shop');
  });

  it('maps each event type to a real generated asset', () => {
    expect(eventAssets).toEqual({
      npc: gameAssets.oldMan,
      transfer: gameAssets.door,
      chest: gameAssets.chest,
      object: gameAssets.slime,
      trigger: gameAssets.battleMarker,
    });
  });
});
