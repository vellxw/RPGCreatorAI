import { describe, expect, it } from 'vitest';
import type { FullProjectState } from '../../adapters/types';
import { createNewProjectState } from '../../adapters/projectTemplates';
import type { VisualNovelContentV1 } from '../../dialogue';
import { compileGameBundleV1 } from '../gameBundleCompiler';
import { ExplorationSimulation } from '../explorationSimulation';

function bundleFixture() {
  const state = createNewProjectState('Simulation fixture') as FullProjectState;
  const map = state.maps.town;
  map.width = 3;
  map.height = 2;
  map.tileSize = 32;
  map.layers = [
    { name: 'ground', type: 'visual', role: 'ground', tiles: [1, 1, 1, 1, 1, 1] },
    { name: 'collision', type: 'collision', role: 'collision', tiles: [0, 9, 0, 0, 0, 0] },
  ];
  map.events = [{
    id: 'npc',
    type: 'npc',
    x: 2,
    y: 1,
    solid: false,
    trigger: 'interact',
    commands: [
      { type: 'showText', speaker: 'Mara', text: 'No mires atrás.' },
      { type: 'setFlag', flag: 'met_mara', value: true },
      { type: 'controlVariable', variableId: 'lucidity', op: 'sub', value: 2 },
    ],
  }];
  state.project.startPosition = { x: 0, y: 0, direction: 'right' };
  const result = compileGameBundleV1(state, { assetAllowlist: [] });
  if (!result.ok) throw new Error(result.errors.map(issue => issue.message).join('; '));
  return result.bundle;
}

function visualNovelFixture(): VisualNovelContentV1 {
  return {
    schemaVersion: 1,
    scenes: {
      reunion: {
        id: 'reunion',
        entryNodeId: 'set_lucidity',
        initialVariables: { 'variables.bond': 1 },
        nodes: [
          {
            id: 'set_lucidity',
            type: 'variable',
            effect: { operation: 'set', variable: 'variables.lucidity', value: 40 },
            next: 'fade_in',
          },
          {
            id: 'fade_in',
            type: 'transition',
            style: 'fade',
            durationMs: 300,
            backgroundAssetId: 'background.archive',
            next: 'music',
          },
          {
            id: 'music',
            type: 'audio',
            channel: 'bgm',
            action: 'play',
            assetId: 'bgm.promise',
            volume: 0.6,
            loop: true,
            next: 'line',
          },
          {
            id: 'line',
            type: 'dialogue',
            speaker: 'Damián',
            text: '¿Todavía te acordás de mí?',
            portrait: { assetId: 'portrait.damian' },
            next: 'answer',
          },
          {
            id: 'answer',
            type: 'choice',
            prompt: 'Elegí con cuidado.',
            choices: [
              {
                id: 'remember',
                text: 'Nunca te olvidé.',
                next: 'ending_together',
                effects: [{ operation: 'add', variable: 'variables.bond', value: 2 }],
              },
              {
                id: 'deny',
                text: 'No sé quién sos.',
                next: 'ending_alone',
                effects: [
                  { operation: 'set', variable: 'flags.denied', value: true },
                  { operation: 'set', variable: 'switches.archive_open', value: true },
                ],
              },
            ],
          },
          { id: 'ending_together', type: 'ending', endingId: 'promise_kept', title: 'La promesa' },
          { id: 'ending_alone', type: 'ending', endingId: 'forgotten', title: 'El olvido' },
        ],
      },
    },
  };
}

describe('ExplorationSimulation', () => {
  it('moves deterministically while respecting collision tiles', () => {
    const simulation = new ExplorationSimulation({ bundle: bundleFixture(), movementIntervalMs: 100 });

    simulation.handleInput('move.right', 'pressed', 0);
    simulation.advance(100);
    expect(simulation.getState().player).toMatchObject({ x: 0, y: 0, direction: 'right' });

    simulation.handleInput('move.right', 'released', 100);
    simulation.handleInput('move.down', 'pressed', 100);
    simulation.advance(100);
    expect(simulation.getState().player).toMatchObject({ x: 0, y: 1, direction: 'down' });
  });

  it('resolves exploration presentation cues through semantic Asset Catalog ids', () => {
    const bundle = bundleFixture();
    bundle.assets = {
      schemaVersion: 1,
      assets: [
        { id: 'audio.ambience.town', name: 'Town ambience', kind: 'audio', path: 'assets/audio/town.wav', source: 'generated', runtimeCompatible: true },
        { id: 'audio.footstep.test', name: 'Footstep', kind: 'audio', path: 'assets/audio/step.wav', source: 'generated', runtimeCompatible: true },
        { id: 'audio.ui.cancel.test', name: 'Cancel', kind: 'audio', path: 'assets/audio/cancel.wav', source: 'generated', runtimeCompatible: true },
      ],
    };
    bundle.databases.system.audioAssetIds = {
      'map.town': 'audio.ambience.town',
      'footstep.concrete': 'audio.footstep.test',
      'ui.cancel': 'audio.ui.cancel.test',
    };
    bundle.dialogue = visualNovelFixture();
    const simulation = new ExplorationSimulation({ bundle, movementIntervalMs: 100 });

    expect(simulation.drainPresentationCues()).toEqual([{
      type: 'audio', channel: 'ambient', action: 'play', assetId: 'audio.ambience.town', loop: true, volume: 0.48,
    }]);
    simulation.handleInput('move.down', 'pressed', 0);
    simulation.advance(100);
    expect(simulation.drainPresentationCues()).toEqual([{
      type: 'audio', channel: 'sfx', action: 'play', assetId: 'audio.footstep.test', volume: 0.32,
    }]);

    simulation.beginVisualNovelScene('reunion');
    simulation.drainPresentationCues();
    simulation.handleInput('cancel', 'pressed', 200);
    expect(simulation.drainPresentationCues()).toEqual([
      { type: 'audio', channel: 'sfx', action: 'play', assetId: 'audio.ui.cancel.test', volume: 0.5 },
      { type: 'transition', style: 'cut', clearBackground: true },
    ]);
  });

  it('runs interaction commands through simulation state and exposes dialogue in the snapshot', () => {
    const simulation = new ExplorationSimulation({ bundle: bundleFixture(), movementIntervalMs: 100 });
    simulation.handleInput('move.down', 'pressed', 0);
    simulation.advance(100);
    simulation.handleInput('move.down', 'released', 100);
    simulation.handleInput('move.right', 'pressed', 100);
    simulation.advance(100);
    simulation.handleInput('move.right', 'released', 200);
    simulation.handleInput('interact', 'pressed', 200);

    expect(simulation.getState()).toMatchObject({
      player: { x: 1, y: 1 },
      flags: { met_mara: true },
      variables: { lucidity: -2 },
    });
    expect(simulation.getRenderSnapshot().dialogue).toEqual({
      eventId: 'npc',
      speaker: 'Mara',
      text: 'No mires atrás.',
    });
  });

  it('repairs a blocked runtime start before the renderer is mounted', () => {
    const bundle = bundleFixture();
    const collision = bundle.maps.town.layers.find(layer => layer.type === 'collision');
    if (!collision) throw new Error('Fixture has no collision layer.');
    collision.tiles[0] = 9;

    const simulation = new ExplorationSimulation({ bundle });

    expect(simulation.getState().player).toMatchObject({ x: 0, y: 1, direction: 'right' });
  });

  it('resolves background, player, and event sprites through stable catalog animation keys', () => {
    const bundle = bundleFixture();
    bundle.assets = {
      schemaVersion: 1,
      assets: [
        { id: 'background.facility-lobby', name: 'Lobby', kind: 'image', path: 'assets/backgrounds/lobby.webp', source: 'generated', runtimeCompatible: true, width: 1920, height: 1080 },
        { id: 'sprite.damian.idle.down', name: 'Damián idle', kind: 'spritesheet', path: 'assets/sprites/damian_idle_down.webp', source: 'generated', runtimeCompatible: true },
        { id: 'sprite.damian.walk.down', name: 'Damián walk', kind: 'spritesheet', path: 'assets/sprites/damian_walk_down.webp', source: 'generated', runtimeCompatible: true },
        { id: 'sprite.elian.idle.down', name: 'Elian idle', kind: 'spritesheet', path: 'assets/sprites/elian_idle_down.webp', source: 'generated', runtimeCompatible: true },
      ],
    };
    bundle.maps.town.parallax = { image: 'background.facility-lobby' };
    bundle.maps.town.events[0].animationSet = 'elian';
    bundle.databases.system.playerAnimationSet = 'damian';
    bundle.databases.animations.sets = [
      {
        id: 'damian',
        clips: [
          { action: 'idle', direction: 'down', asset: 'sprite.damian.idle.down', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 6, loop: true, anchor: { x: 24, y: 62 } },
          { action: 'walk', direction: 'down', asset: 'sprite.damian.walk.down', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 8, loop: true, anchor: { x: 24, y: 62 } },
        ],
      },
      {
        id: 'elian',
        clips: [
          { action: 'idle', direction: 'down', asset: 'sprite.elian.idle.down', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 6, loop: true, anchor: { x: 24, y: 62 } },
        ],
      },
    ];

    const simulation = new ExplorationSimulation({ bundle, movementIntervalMs: 100 });
    expect(simulation.getRenderSnapshot().sprites.map(sprite => [sprite.id, sprite.assetKey])).toEqual([
      ['background:town', 'background.facility-lobby'],
      ['player', 'sprite.damian.idle.down'],
      ['event:npc', 'sprite.elian.idle.down'],
    ]);
    const background = simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'background:town');
    expect(background?.width).toBeCloseTo(64 * (16 / 9));
    expect(background?.height).toBe(64);

    simulation.handleInput('move.down', 'pressed', 0);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player')?.assetKey)
      .toBe('sprite.damian.walk.down');
  });

  it('plays compiled horizontal strips with authored anchors and undistorted entity sizes', () => {
    const bundle = bundleFixture();
    bundle.databases.system.playerAnimationSet = 'damian';
    bundle.databases.system.defaultCharacterHeightTiles = 1.5;
    bundle.databases.animations.sets = [{
      id: 'damian',
      clips: [{
        action: 'idle',
        direction: 'right',
        asset: 'sprite.damian.idle.right',
        frameSize: { width: 48, height: 64 },
        frameCount: 4,
        fps: 8,
        loop: true,
        anchor: { x: 24, y: 62 },
      }],
    }];
    bundle.assets = {
      schemaVersion: 1,
      assets: [{
        id: 'sprite.damian.idle.right',
        name: 'Damián idle right',
        kind: 'spritesheet',
        path: 'assets/sprites/damian_idle_right.webp',
        source: 'generated',
        runtimeCompatible: true,
      }],
    };

    const simulation = new ExplorationSimulation({ bundle });
    simulation.advance(125);
    const player = simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player');

    expect(player).toMatchObject({
      assetKey: 'sprite.damian.idle.right',
      frame: 1,
      width: 36,
      height: 48,
      originX: 0.5,
      originY: 62 / 64,
      y: 32,
    });
  });

  it('selects and restarts the directional interact strip as a finite one-shot', () => {
    const bundle = bundleFixture();
    bundle.databases.system.playerAnimationSet = 'damian';
    bundle.databases.animations.sets = [{
      id: 'damian',
      clips: [
        { action: 'idle', direction: 'right', asset: 'sprite.damian.idle.right', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 8, loop: true, anchor: { x: 24, y: 62 } },
        { action: 'walk', direction: 'right', asset: 'sprite.damian.walk.right', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 8, loop: true, anchor: { x: 24, y: 62 } },
        { action: 'interact', direction: 'right', asset: 'sprite.damian.interact.right', frameSize: { width: 48, height: 64 }, frameCount: 4, fps: 8, loop: false, anchor: { x: 24, y: 62 } },
      ],
    }];

    const simulation = new ExplorationSimulation({ bundle });
    simulation.handleInput('move.right', 'pressed', 0);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player'))
      .toMatchObject({ assetKey: 'sprite.damian.walk.right', frame: 0 });

    simulation.handleInput('interact', 'pressed', 1);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player'))
      .toMatchObject({ assetKey: 'sprite.damian.interact.right', frame: 0 });
    simulation.advance(125);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player')?.frame).toBe(1);

    simulation.handleInput('interact', 'pressed', 126);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player')?.frame).toBe(0);
    simulation.advance(250);
    simulation.advance(250);
    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player'))
      .toMatchObject({ assetKey: 'sprite.damian.walk.right', frame: 0 });
  });

  it('falls back to the available facing clip when an interact strip is absent', () => {
    const bundle = bundleFixture();
    bundle.databases.system.playerAnimationSet = 'damian';
    bundle.databases.animations.sets = [{
      id: 'damian',
      clips: [{
        action: 'idle',
        direction: 'right',
        asset: 'sprite.damian.idle.right',
        frameSize: { width: 48, height: 64 },
        frameCount: 4,
        fps: 8,
        loop: true,
        anchor: { x: 24, y: 62 },
      }],
    }];

    const simulation = new ExplorationSimulation({ bundle });
    simulation.handleInput('interact', 'pressed', 0);

    expect(simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'player'))
      .toMatchObject({ assetKey: 'sprite.damian.idle.right', frame: 0 });
  });

  it('preserves static threat aspect ratio and only exposes approved portrait assets', () => {
    const bundle = bundleFixture();
    bundle.databases.system.defaultCharacterHeightTiles = 1.5;
    bundle.assets = {
      schemaVersion: 1,
      assets: [
        { id: 'portrait.damian', name: 'Damián', kind: 'image', path: 'assets/portraits/damian.webp', source: 'generated', runtimeCompatible: true },
        { id: 'threat.ninth-witness', name: 'Noveno Testigo', kind: 'image', path: 'assets/sprites/ninth-witness.webp', source: 'generated', runtimeCompatible: true, width: 512, height: 1024 },
      ],
    };
    bundle.databases.actors = [{
      id: 'damian',
      name: 'Damián Ferreyra',
      classId: 'survivor',
      portraitAssetId: 'portrait.damian',
      level: 1,
      hp: 100,
      mp: 0,
      baseStats: {
        maxHp: 100, maxMp: 0, attack: 10, defense: 10,
        magicAttack: 0, magicDefense: 10, agility: 10, luck: 5,
      },
      equipment: {},
      skills: [],
    }];
    bundle.maps.town.events[0].sprite = 'threat.ninth-witness';
    bundle.maps.town.events[0].commands[0] = { type: 'showText', speaker: 'Damián', text: 'No mires atrás.' };

    const simulation = new ExplorationSimulation({ bundle, movementIntervalMs: 100 });
    const threat = simulation.getRenderSnapshot().sprites.find(sprite => sprite.id === 'event:npc');
    expect(threat).toMatchObject({ width: 24, height: 48, originX: 0.5, originY: 1 });

    simulation.handleInput('move.down', 'pressed', 0);
    simulation.advance(100);
    simulation.handleInput('move.down', 'released', 100);
    simulation.handleInput('move.right', 'pressed', 100);
    simulation.advance(100);
    simulation.handleInput('move.right', 'released', 200);
    simulation.handleInput('interact', 'pressed', 200);
    expect(simulation.getRenderSnapshot().dialogue?.portraitAssetId).toBe('portrait.damian');
  });

  it('plays an opt-in visual novel scene, routes choices, syncs effects, and restores exploration', () => {
    const bundle = bundleFixture();
    bundle.dialogue = visualNovelFixture();
    bundle.assets = {
      schemaVersion: 1,
      assets: [{
        id: 'portrait.damian',
        name: 'Damián',
        kind: 'image',
        path: 'assets/portraits/damian.webp',
        source: 'generated',
        runtimeCompatible: true,
      }],
    };
    bundle.databases.variables.push(
      { id: 'bond', name: 'Vínculo', initial: 0 },
      { id: 'lucidity', name: 'Lucidez', initial: 0 },
    );
    bundle.databases.switches.push({ id: 'archive_open', name: 'Archivo abierto', initial: false });

    const simulation = new ExplorationSimulation({
      bundle,
      movementIntervalMs: 100,
      initialVisualNovelSceneId: 'reunion',
    });

    expect(simulation.getRenderSnapshot().dialogue).toMatchObject({
      kind: 'dialogue',
      speaker: 'Damián',
      text: '¿Todavía te acordás de mí?',
      portraitAssetId: 'portrait.damian',
    });
    expect(simulation.getState().variables).toMatchObject({ bond: 1, lucidity: 40 });

    simulation.handleInput('interact', 'pressed', 0);
    expect(simulation.getRenderSnapshot().dialogue).toMatchObject({
      kind: 'choice',
      text: 'Elegí con cuidado.',
      choices: [
        { id: 'remember', selected: true },
        { id: 'deny', selected: false },
      ],
    });

    const positionBeforeChoice = simulation.getState().player;
    simulation.handleInput('move.down', 'pressed', 1);
    simulation.advance(100);
    expect(simulation.getState().player).toEqual(positionBeforeChoice);
    expect(simulation.getRenderSnapshot().dialogue?.choices?.[1]).toMatchObject({
      id: 'deny',
      selected: true,
    });

    simulation.handleInput('interact', 'pressed', 2);
    expect(simulation.getRenderSnapshot().dialogue).toMatchObject({
      kind: 'ending',
      endingId: 'forgotten',
      text: 'El olvido',
    });
    expect(simulation.getState()).toMatchObject({
      flags: { denied: true },
      switches: { archive_open: true },
    });

    simulation.handleInput('interact', 'pressed', 3);
    expect(simulation.getRenderSnapshot().dialogue).toBeUndefined();
    simulation.handleInput('move.down', 'pressed', 4);
    simulation.advance(100);
    expect(simulation.getState().player).toMatchObject({ x: 0, y: 1, direction: 'down' });
  });

  it('reports an unknown visual novel scene without blocking exploration', () => {
    const bundle = bundleFixture();
    bundle.dialogue = visualNovelFixture();
    const simulation = new ExplorationSimulation({ bundle, movementIntervalMs: 100 });

    expect(simulation.beginVisualNovelScene('missing')).toMatchObject({
      ok: false,
      sceneId: 'missing',
      error: 'Unknown visual novel scene "missing".',
    });
    expect(simulation.getVisualNovelSession()).toBeUndefined();
    expect(simulation.getVisualNovelError()).toBe('Unknown visual novel scene "missing".');

    simulation.handleInput('move.down', 'pressed', 0);
    simulation.advance(100);
    expect(simulation.getState().player).toMatchObject({ x: 0, y: 1 });
  });

  it('starts an authored VN node through vn.start and stops later event commands', () => {
    const bundle = bundleFixture();
    bundle.dialogue = visualNovelFixture();
    bundle.maps.town.events[0].x = 1;
    bundle.maps.town.events[0].y = 0;
    bundle.maps.town.events[0].commands = [
      {
        type: 'pluginCommand',
        pluginId: 'vn',
        command: 'start',
        args: { sceneId: 'reunion', nodeId: 'ending_alone' },
      },
      { type: 'setFlag', flag: 'must_wait_until_later_event', value: true },
    ];
    const simulation = new ExplorationSimulation({ bundle });

    simulation.handleInput('interact', 'pressed', 0);

    expect(simulation.getRenderSnapshot().dialogue).toMatchObject({
      kind: 'ending',
      endingId: 'forgotten',
    });
    expect(simulation.getState().flags.must_wait_until_later_event).toBeUndefined();
  });

  it('serializes and resumes VN choice selection without replaying presentation cues', () => {
    const bundle = bundleFixture();
    bundle.dialogue = visualNovelFixture();
    const first = new ExplorationSimulation({
      bundle,
      initialVisualNovelSceneId: 'reunion',
    });

    expect(first.drainPresentationCues()).toEqual([
      {
        type: 'transition',
        style: 'fade',
        durationMs: 300,
        backgroundAssetId: 'background.archive',
      },
      {
        type: 'audio',
        channel: 'bgm',
        action: 'play',
        assetId: 'bgm.promise',
        volume: 0.6,
        loop: true,
      },
    ]);
    first.handleInput('interact', 'pressed', 1);
    first.handleInput('move.down', 'pressed', 2);
    const save = first.toPortableSave();

    const resumed = new ExplorationSimulation({ bundle });
    resumed.loadPortableSave(save);

    expect(resumed.getRenderSnapshot().dialogue?.choices?.[1]).toMatchObject({
      id: 'deny',
      selected: true,
    });
    expect(resumed.getVisualNovelSession()?.state.currentNodeId).toBe('answer');
    expect(resumed.drainPresentationCues()).toEqual([]);
  });
});
