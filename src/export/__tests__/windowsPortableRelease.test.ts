import { describe, expect, it } from 'vitest';
import { validateWindowsPortableRelease } from '../windowsPortableRelease';

const SHA256 = 'a'.repeat(64);

function file(path: string, role: string) {
  return { path, role, sizeBytes: 1, sha256: SHA256 };
}

function validInput(): any {
  const nativeData = {
    'data/project.json': {
      schemaVersion: 1,
      title: 'Portable fixture',
      startMapId: 'start',
      startPosition: { x: 1, y: 1, direction: 'down' },
      maps: [{ id: 'start', path: 'data/maps/start.json' }],
      database: { items: 'data/database/items.json' },
    },
    'data/maps/start.json': {
      schemaVersion: 1,
      id: 'start',
      name: 'Start',
      width: 2,
      height: 2,
      tileSize: 32,
      layers: [],
      events: [],
    },
    'data/database/items.json': { items: [] },
  };
  return {
    manifest: {
      schemaVersion: 1,
      target: 'windows-portable',
      artifact: {
        kind: 'portable-directory',
        name: 'Portable-fixture-v1.0.0-windows-x64-portable-dev',
        version: '1.0.0',
        architecture: 'x64',
        entryExecutable: 'Portable-fixture.exe',
        runtimeExecutable: 'rpg_creator_runtime.exe',
        nativeProjectPath: 'data/project.json',
        gameBundlePath: 'data/game-bundle.v1.json',
        provenancePath: 'data/asset-provenance.v1.json',
      },
      assetAllowlist: [],
      nativeDataAllowlist: [
        'data/project.json',
        'data/maps/start.json',
        'data/database/items.json',
      ],
      files: [
        file('Portable-fixture.exe', 'launcher'),
        file('rpg_creator_runtime.exe', 'runtime'),
        file('data/project.json', 'native-project'),
        file('data/maps/start.json', 'native-map'),
        file('data/database/items.json', 'native-database'),
        file('data/game-bundle.v1.json', 'game-bundle'),
        file('data/asset-provenance.v1.json', 'provenance'),
        file('LICENSE.txt', 'license'),
        file('README.md', 'readme'),
      ],
    },
    nativeData,
    gameBundle: {
      schemaVersion: 1,
      project: {},
      maps: {},
      items: {},
      databases: {},
      assets: { schemaVersion: 1, assets: [] },
    },
    provenance: { schemaVersion: 1, assets: [] },
    compilerWarnings: [],
  };
}

describe('Windows portable native data contract', () => {
  it('accepts the exact project, map, and database shard allowlist', () => {
    const result = validateWindowsPortableRelease(validInput());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a native JSON document not referenced by data/project.json', () => {
    const input = validInput();
    (input.nativeData as Record<string, unknown>)['data/maps/unlisted.json'] = { schemaVersion: 1 };
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'WP-015-native-data-allowlist' }),
    ]));
  });

  it('rejects a referenced shard with the wrong release role', () => {
    const input = validInput();
    const mapFile = input.manifest.files.find((entry: any) => entry.path === 'data/maps/start.json')!;
    mapFile.role = 'support';
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: 'WP-041-required-runtime-files',
        message: 'Missing native-map file "data/maps/start.json".',
      }),
      expect.objectContaining({ checkId: 'WP-015-native-data-allowlist' }),
    ]));
  });

  it('rejects a reordered allowlist even when its set is complete', () => {
    const input = validInput();
    input.manifest.nativeDataAllowlist.reverse();
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'WP-015-native-data-allowlist' }),
    ]));
  });

  it('accepts a technical supplemental animation strip without changing visual slots', () => {
    const input = validInput();
    const assetId = 'sprite.damian.idle.down';
    const assetPath = 'assets/generated/runtime/sprites/damian_idle_down.png';
    input.manifest.assetAllowlist = [assetId];
    input.manifest.supplementalAnimationAssetAllowlist = [assetId];
    input.manifest.files.push({ ...file(assetPath, 'asset'), assetId });
    input.gameBundle.assets.assets.push({
      id: assetId,
      name: 'Damián idle down',
      kind: 'spritesheet',
      path: assetPath,
      source: 'generated',
      runtimeCompatible: true,
      width: 1024,
      height: 384,
      frameWidth: 256,
      frameHeight: 384,
      frames: 4,
    });
    input.provenance.supplementalAnimation = [{
      assetId,
      runtimePath: assetPath,
      source: 'generated',
      origin: 'Generated technical fixture for the animation contract.',
      license: 'Project-local generated output; human acceptance remains pending.',
      generated: {
        providerId: 'openai-built-in-image-generation',
        modelId: 'not-disclosed',
        operation: 'image.generate+normalize-sprite-strip',
        createdAt: '2026-08-14T07:28:00.000Z',
        outputSha256: SHA256,
        outputSizeBytes: 1,
      },
      technicalReview: { state: 'generated-verified', verificationScript: 'scripts/dev/validate-damian-animation-v2.mjs' },
      humanAcceptance: { state: 'pending', evidence: 'not-recorded' },
    }];
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a supplemental animation sidecar for a non-spritesheet asset', () => {
    const input = validInput();
    const assetId = 'sprite.damian.idle.down';
    const assetPath = 'assets/generated/runtime/sprites/damian_idle_down.png';
    input.manifest.assetAllowlist = [assetId];
    input.manifest.supplementalAnimationAssetAllowlist = [assetId];
    input.manifest.files.push({ ...file(assetPath, 'asset'), assetId });
    input.gameBundle.assets.assets.push({ id: assetId, name: 'Wrong kind', kind: 'image', path: assetPath, source: 'generated', runtimeCompatible: true });
    input.provenance.supplementalAnimation = [{
      assetId,
      runtimePath: assetPath,
      source: 'generated',
      origin: 'Generated technical fixture.',
      license: 'Project-local generated output.',
      generated: { providerId: 'openai-built-in-image-generation', modelId: 'not-disclosed', operation: 'normalize', createdAt: '2026-08-14T07:28:00.000Z', outputSha256: SHA256, outputSizeBytes: 1 },
      technicalReview: { state: 'generated-verified', verificationScript: 'scripts/dev/validate-damian-animation-v2.mjs' },
      humanAcceptance: { state: 'pending', evidence: 'not-recorded' },
    }];
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'WP-012-asset-runtime-compatibility' }),
    ]));
  });

  it('accepts the canonical editor evidence file only in a strict manifest', () => {
    const input = validInput();
    input.manifest.artifact.acceptanceEvidencePath = 'data/editor-acceptance-evidence.v1.json';
    input.manifest.files.push(file('data/editor-acceptance-evidence.v1.json', 'acceptance-evidence'));
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts the canonical game release contract only when its inventory role is present', () => {
    const input = validInput();
    input.manifest.artifact.releaseContractPath = 'data/game-release.v1.json';
    input.manifest.files.push(file('data/game-release.v1.json', 'release-contract'));
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects a declared game release contract without its canonical inventory role', () => {
    const input = validInput();
    input.manifest.artifact.releaseContractPath = 'data/game-release.v1.json';
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: 'WP-041-required-runtime-files',
        message: 'Missing release-contract file "data/game-release.v1.json".',
      }),
    ]));
  });

  it('rejects an acceptance-evidence role at a non-canonical path', () => {
    const input = validInput();
    input.manifest.files.push(file('data/review.json', 'acceptance-evidence'));
    const result = validateWindowsPortableRelease(input);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkId: 'WP-041-required-runtime-files' }),
    ]));
  });
});
