import { describe, expect, it } from 'vitest';
import { createPortableSave } from '../../../runtime-core/saveSchema';
import {
  ANDROID_SAVE_BRIDGE_SCHEMA_VERSION,
  AndroidSaveBridgeCoordinator,
  safeAndroidSaveName,
} from '../saveBridge';

const save = createPortableSave({
  currentMapId: 'town',
  player: { x: 4, y: 8, direction: 'down' },
});

describe('AndroidSaveBridgeCoordinator', () => {
  it('creates a bounded, versioned mirror request and restores its response', () => {
    const bridge = new AndroidSaveBridgeCoordinator('playtest');
    const write = bridge.begin({ operation: 'mirror.write', slotId: 'auto', save }, 10);
    expect(write).toMatchObject({
      schemaVersion: ANDROID_SAVE_BRIDGE_SCHEMA_VERSION,
      requestId: 'playtest:1',
      operation: 'mirror.write',
      slotId: 'auto',
    });
    bridge.complete({
      schemaVersion: 1,
      requestId: write.requestId,
      operation: write.operation,
      status: 'ok',
    });

    const read = bridge.begin({ operation: 'mirror.read', slotId: 'auto' }, 11);
    const result = bridge.complete({
      schemaVersion: 1,
      requestId: read.requestId,
      operation: read.operation,
      status: 'ok',
      payload: JSON.stringify(save),
    });
    expect(result.save).toEqual(save);
  });

  it('allows only one native operation at a time', () => {
    const bridge = new AndroidSaveBridgeCoordinator('playtest');
    bridge.begin({ operation: 'document.import' }, 1);
    expect(() => bridge.begin({ operation: 'document.import' }, 2)).toThrow('pending request');
  });

  it('rejects stale or mismatched native responses without losing the pending request', () => {
    const bridge = new AndroidSaveBridgeCoordinator('playtest');
    const request = bridge.begin({ operation: 'document.import' }, 1);
    expect(() => bridge.complete({
      schemaVersion: 1,
      requestId: 'playtest:999',
      operation: 'document.import',
      status: 'cancelled',
    })).toThrow('requestId');
    expect(bridge.getPending()?.requestId).toBe(request.requestId);
  });

  it('sanitizes document names without allowing a path', () => {
    expect(safeAndroidSaveName('../../My: Save?.rpgsave.json'))
      .toBe('My_Save.rpgsave.json');
  });
});
