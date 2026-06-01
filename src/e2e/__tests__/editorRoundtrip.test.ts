import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectDataAdapter, _resetAdaptersForTest } from '../../adapters/adapterFactory';
import { DesktopPlaytestSessionAdapter } from '../../adapters/PlaytestSessionAdapter';
import { initialProjectStoreState, projectReducer, type ProjectAction } from '../../stores/projectStore';
import { performSave } from '../../stores/saveActions';
import { validateProject } from '../../validation/validateProject';
import type { PlaytestSessionRequest, RpgBridge } from '../../adapters/types';

function makeBridge(calls: PlaytestSessionRequest[]): RpgBridge {
  return {
    shell: { info: async () => ({ name: 'tauri', version: 'test' }) },
    fs: {
      openProjectDialog: async () => ({ root: null, cancelled: true, state: null }),
      readProject: async () => { throw new Error('not stubbed'); },
      writeProject: async () => ({ success: true }),
      listBackups: async () => [],
      closeProject: async () => undefined,
      createPlaytestSession: async (_sourceRoot, _state, request) => {
        calls.push(request);
        return { success: true, sessionRoot: `C:\\playtest\\${request.mode}` };
      },
    },
    runtime: {
      launch: async () => ({ success: true, pid: 1 }),
      kill: async () => undefined,
      status: async () => 'ready',
      getLatestLog: async () => ({ success: false, error: 'not stubbed' }),
      readLogTail: async () => ({ success: false, error: 'not stubbed' }),
      readLatestSnapshot: async () => ({ success: false, error: 'not stubbed' }),
      openLogFolder: async () => ({ success: false, error: 'not stubbed' }),
    },
    config: {
      getRecents: async () => [],
      addRecent: async () => [],
    },
  };
}

describe('editor roundtrip', () => {
  it('persists editor map edits through the active save adapter', async () => {
    _resetAdaptersForTest();
    const adapter = getProjectDataAdapter();
    let state = projectReducer(initialProjectStoreState, {
      type: 'LOAD_PROJECT',
      payload: await adapter.loadProject(),
    });

    const dispatch = (action: ProjectAction) => {
      state = projectReducer(state, action);
    };

    state = projectReducer(state, {
      type: 'PAINT_TILE',
      mapId: 'town',
      layerName: 'collision',
      x: 1,
      y: 1,
      tile: 9,
    });
    state = projectReducer(state, {
      type: 'ADD_EVENT',
      mapId: 'town',
      event: {
        id: 'roundtrip_event',
        type: 'trigger',
        x: 4,
        y: 4,
        solid: false,
        trigger: 'touch',
        commands: [],
      },
    });

    const outcome = await performSave(state, dispatch);
    const reloaded = await adapter.loadProject();
    const collision = reloaded.maps.town.layers.find(layer => layer.type === 'collision');

    expect(outcome.success).toBe(true);
    expect(collision?.tiles[1 * reloaded.maps.town.width + 1]).toBe(9);
    expect(reloaded.maps.town.events.some(event => event.id === 'roundtrip_event')).toBe(true);
  });

  it('persists database and common event edits through save, reload, and validation', async () => {
    _resetAdaptersForTest();
    const adapter = getProjectDataAdapter();
    let state = projectReducer(initialProjectStoreState, {
      type: 'LOAD_PROJECT',
      payload: await adapter.loadProject(),
    });
    const dispatch = (action: ProjectAction) => {
      state = projectReducer(state, action);
    };
    const actorId = state.databases.actors[0]?.id;
    expect(actorId).toBeTruthy();

    state = projectReducer(state, {
      type: 'UPDATE_DATABASE_ENTRY',
      table: 'actors',
      id: actorId!,
      changes: { name: 'Roundtrip Hero' },
    });
    state = projectReducer(state, {
      type: 'UPDATE_COMMON_EVENT_COMMANDS',
      commonEventId: 'save_reminder',
      commands: [{ type: 'showText', text: 'Roundtrip common event saved.' }],
    });

    const outcome = await performSave(state, dispatch);
    const reloaded = await adapter.loadProject();
    const report = validateProject(reloaded);

    expect(outcome.success).toBe(true);
    expect(report.errors).toEqual([]);
    expect(reloaded.databases.actors.find(actor => actor.id === actorId)?.name).toBe('Roundtrip Hero');
    expect(reloaded.databases.commonEvents.find(event => event.id === 'save_reminder')?.commands).toEqual([
      { type: 'showText', text: 'Roundtrip common event saved.' },
    ]);
  });

  it('requests playtest sessions for project start, current map, and selected event modes', async () => {
    _resetAdaptersForTest();
    const state = await getProjectDataAdapter().loadProject();
    const calls: PlaytestSessionRequest[] = [];
    window.rpgBridge = makeBridge(calls);

    const adapter = new DesktopPlaytestSessionAdapter();
    await adapter.createSession('C:\\source-project', state, { mode: 'projectStart' });
    await adapter.createSession('C:\\source-project', state, {
      mode: 'currentMap',
      currentMapId: 'house',
    });
    await adapter.createSession('C:\\source-project', state, {
      mode: 'selectedEvent',
      currentMapId: 'town',
      selectedEventMapId: 'town',
      selectedEventId: 'old_man',
    });

    expect(calls).toEqual([
      { mode: 'projectStart' },
      { mode: 'currentMap', currentMapId: 'house' },
      {
        mode: 'selectedEvent',
        currentMapId: 'town',
        selectedEventMapId: 'town',
        selectedEventId: 'old_man',
      },
    ]);

    delete window.rpgBridge;
  });

  it('keeps the editor-runtime roundtrip script wired to every MVP gate', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/dev/verify-editor-runtime-roundtrip.ps1'), 'utf8');
    const wrapper = readFileSync(join(process.cwd(), 'scripts/dev/verify-editor-runtime-roundtrip.bat'), 'utf8');

    for (const expected of [
      'FRONTEND ROUNDTRIP TESTS',
      'TAURI CONTENT CHECK',
      'RUST DESKTOP TESTS',
      'NATIVE BUILD AND TEST',
      'RUNTIME LAUNCH SMOKE',
      'RUNTIME SCREENSHOT ROUNDTRIP',
      'src/e2e/__tests__/editorRoundtrip.test.ts',
      'src/adapters/__tests__/PlaytestSessionAdapter.test.ts',
      'verify-tauri-content.ps1',
      'cargo test --manifest-path src-tauri/Cargo.toml',
      'verify.ps1',
      'smoke-runtime.ps1',
    ]) {
      expect(script).toContain(expected);
    }

    expect(wrapper).toContain('-ExecutionPolicy Bypass');
    expect(wrapper).toContain('verify-editor-runtime-roundtrip.ps1');
    expect(wrapper).toContain('%*');
  });
});
