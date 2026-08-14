import { describe, expect, it } from 'vitest';
import {
  assessPluginManifest,
  authorizePluginCapability,
  quarantinePlugin,
  resolveSandboxLimits,
  type AssessPluginManifestOptions,
  type PluginSandboxState,
} from '../pluginCapabilityBroker';
import type { PluginManifestV1 } from '../plugins';

const manifest: PluginManifestV1 = {
  schemaVersion: 1,
  id: 'example.weather',
  name: 'Weather',
  version: '1.0.0',
  entry: 'dist/plugin.js',
  permissions: ['runtime.state.read'],
  optionalPermissions: ['runtime.audio.play'],
};

function readyState(overrides: AssessPluginManifestOptions = {}): PluginSandboxState {
  return assessPluginManifest(manifest, {
    grant: {
      pluginId: manifest.id,
      permissions: ['runtime.state.read'],
    },
    ...overrides,
  });
}

describe('plugin capability broker', () => {
  it('denies by default and quarantines a manifest with missing required grants', () => {
    const state = assessPluginManifest(manifest);

    expect(state.status).toBe('quarantined');
    expect(state.permissions?.allowed).toEqual([]);
    expect(state.permissions?.deniedRequired).toEqual(['runtime.state.read']);
    expect(state.quarantineReasons).toContainEqual(expect.objectContaining({
      code: 'required-permission-denied',
    }));
  });

  it('becomes ready only for explicit matching grants and leaves optional capabilities denied', () => {
    const state = readyState();

    expect(state.status).toBe('ready');
    expect(state.permissions).toEqual({
      allowed: ['runtime.state.read'],
      deniedRequired: [],
      deniedOptional: ['runtime.audio.play'],
      canActivate: true,
    });

    const decision = authorizePluginCapability(state, {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
      payloadBytes: 24,
    });
    expect(decision).toMatchObject({ allowed: true, code: 'allowed' });
    expect(state.usage.requestCount).toBe(0);
    expect(decision.state.usage).toEqual({
      requestCount: 1,
      deniedRequestCount: 0,
      acceptedPayloadBytes: 24,
    });
  });

  it('never loads or executes the manifest entry while assessing it', () => {
    const state = assessPluginManifest({
      ...manifest,
      id: 'example.no-loader',
      entry: 'missing/this-file-must-not-be-imported.js',
      permissions: [],
      optionalPermissions: [],
    });

    expect(state.status).toBe('ready');
    expect(state.manifest?.entry).toBe('missing/this-file-must-not-be-imported.js');
  });

  it('quarantines malformed, ambiguous, and extended manifests', () => {
    const state = assessPluginManifest({
      ...manifest,
      entry: '../outside.js',
      permissions: ['runtime.state.read'],
      optionalPermissions: ['runtime.state.read'],
      executableFactory: 'not-supported',
    });

    expect(state.status).toBe('quarantined');
    expect(state.manifest).toBeNull();
    expect(state.quarantineReasons.map(item => item.message)).toEqual(expect.arrayContaining([
      'entry must be a safe relative path.',
      'Manifest contains an unsupported field: executableFactory.',
      'Permission cannot be both required and optional: runtime.state.read.',
    ]));
  });

  it('applies manifest byte and permission declaration limits before activation', () => {
    const permissionLimited = readyState({
      limits: { maxRequiredPermissions: 0 },
    });
    expect(permissionLimited.status).toBe('quarantined');
    expect(permissionLimited.quarantineReasons).toContainEqual(expect.objectContaining({
      code: 'required-permission-limit',
    }));

    const byteLimited = readyState({ limits: { maxManifestBytes: 32 } });
    expect(byteLimited.status).toBe('quarantined');
    expect(byteLimited.quarantineReasons).toContainEqual(expect.objectContaining({
      code: 'manifest-size-limit',
    }));
  });

  it('quarantines repeated denied requests without granting undeclared capabilities', () => {
    let state = readyState({ limits: { maxDeniedRequestsBeforeQuarantine: 2 } });

    const first = authorizePluginCapability(state, {
      pluginId: manifest.id,
      permission: 'runtime.storage.write',
    });
    expect(first).toMatchObject({ allowed: false, code: 'permission-denied' });
    state = first.state;

    const second = authorizePluginCapability(state, {
      pluginId: manifest.id,
      permission: 'runtime.storage.write',
    });
    expect(second).toMatchObject({ allowed: false, code: 'denial-limit-exceeded' });
    expect(second.state.status).toBe('quarantined');
  });

  it('fails closed on identity, permission, request, and payload boundary violations', () => {
    const identity = authorizePluginCapability(readyState(), {
      pluginId: 'example.impostor',
      permission: 'runtime.state.read',
    });
    expect(identity).toMatchObject({ allowed: false, code: 'plugin-id-mismatch' });
    expect(identity.state.status).toBe('quarantined');

    const unknown = authorizePluginCapability(readyState(), {
      pluginId: manifest.id,
      permission: 'runtime.shell.execute',
    });
    expect(unknown).toMatchObject({ allowed: false, code: 'unknown-permission' });

    const oversized = authorizePluginCapability(readyState({
      limits: { maxRequestPayloadBytes: 4 },
    }), {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
      payloadBytes: 5,
    });
    expect(oversized).toMatchObject({ allowed: false, code: 'request-payload-limit-exceeded' });

    const first = authorizePluginCapability(readyState({
      limits: { maxRequestsPerSession: 1 },
    }), {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
    });
    const exhausted = authorizePluginCapability(first.state, {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
    });
    expect(exhausted).toMatchObject({ allowed: false, code: 'request-limit-exceeded' });
  });

  it('enforces cumulative accepted payload limits and keeps quarantine monotonic', () => {
    const first = authorizePluginCapability(readyState({
      limits: { maxRequestPayloadBytes: 4, maxSessionPayloadBytes: 5 },
    }), {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
      payloadBytes: 3,
    });
    const cumulative = authorizePluginCapability(first.state, {
      pluginId: manifest.id,
      permission: 'runtime.state.read',
      payloadBytes: 3,
    });
    expect(cumulative).toMatchObject({
      allowed: false,
      code: 'session-payload-limit-exceeded',
    });

    const reviewed = quarantinePlugin(cumulative.state, {
      code: 'host-quarantine',
      message: 'Manual review required.',
    });
    expect(reviewed.status).toBe('quarantined');
    expect(reviewed.quarantineReasons.at(-1)).toEqual({
      code: 'host-quarantine',
      message: 'Manual review required.',
    });
  });

  it('rejects invalid host limit configuration deterministically', () => {
    expect(() => resolveSandboxLimits({ maxRequestPayloadBytes: -1 })).toThrow(RangeError);
    expect(() => resolveSandboxLimits({ maxDeniedRequestsBeforeQuarantine: 0 })).toThrow(RangeError);
    expect(() => resolveSandboxLimits({ maxRequestsPerSession: Number.NaN })).toThrow(RangeError);
  });
});
