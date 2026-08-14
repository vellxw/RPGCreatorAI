import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const templateRoot = join(repoRoot, 'templates', 'horror-bl');
const blueprintPath = join(templateRoot, 'data', 'content', 'vertical-slice.json');
const assetManifestPath = join(templateRoot, 'data', 'assets', 'assets-manifest.json');
const releaseRoot = join(templateRoot, 'release-input');
const projectPath = join(templateRoot, 'data', 'project.json');
const allowlistPath = join(releaseRoot, 'asset-allowlist.json');

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

async function sha256(path) {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
}

async function writeJson(path, value, force) {
  if (!force) {
    try {
      await readFile(path);
      throw new Error(`Refusing to overwrite existing file without --force: ${path}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

const force = hasFlag('--force');
const tempRoot = await mkdtemp(join(tmpdir(), 'rpgcreatorai-horror-materializer-'));

try {
  const compiledGameBundlePath = join(tempRoot, 'horrorBlGameBundle.mjs');
  const compiledRuntimeAdapterPath = join(tempRoot, 'horrorBlRuntimeAdapter.mjs');
  await build({
    entryPoints: {
      horrorBlGameBundle: join(repoRoot, 'src', 'templates', 'horrorBlGameBundle.ts'),
      horrorBlRuntimeAdapter: join(repoRoot, 'src', 'templates', 'horrorBlRuntimeAdapter.ts'),
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outdir: tempRoot,
    outExtension: { '.js': '.mjs' },
    sourcemap: false,
    logLevel: 'silent',
  });

  const [gameBundleModule, runtimeAdapterModule] = await Promise.all([
    import(pathToFileURL(compiledGameBundlePath).href),
    import(pathToFileURL(compiledRuntimeAdapterPath).href),
  ]);
  const { materializeHorrorBlGameBundle } = gameBundleModule;
  const { adaptHorrorBlVerticalSliceToRuntime } = runtimeAdapterModule;
  const blueprint = JSON.parse(await readFile(blueprintPath, 'utf8'));
  const assets = JSON.parse(await readFile(assetManifestPath, 'utf8'));
  const allowlistDocument = JSON.parse(await readFile(allowlistPath, 'utf8'));
  const visualAssetAllowlist = Array.isArray(allowlistDocument)
    ? allowlistDocument
    : allowlistDocument.assetAllowlist;
  const supplementalAudioAssetAllowlist = Array.isArray(allowlistDocument)
    ? []
    : allowlistDocument.supplementalAudioAssetAllowlist ?? [];
  const supplementalAnimationAssetAllowlist = Array.isArray(allowlistDocument)
    ? []
    : allowlistDocument.supplementalAnimationAssetAllowlist ?? [];
  if (!Array.isArray(visualAssetAllowlist) || !Array.isArray(supplementalAnimationAssetAllowlist) || !Array.isArray(supplementalAudioAssetAllowlist)) {
    throw new Error(`Asset allowlist must be an array: ${allowlistPath}`);
  }
  const assetAllowlist = [...new Set([
    ...visualAssetAllowlist,
    ...supplementalAnimationAssetAllowlist,
    ...supplementalAudioAssetAllowlist,
  ])];
  const runtimeAdaptation = adaptHorrorBlVerticalSliceToRuntime(blueprint);
  const result = materializeHorrorBlGameBundle(blueprint, {
    assets,
    dialogue: runtimeAdaptation.dialogue,
    assetAllowlist,
    allowedAssetRoots: ['assets/generated/runtime', 'assets/audio/horror-bl'],
  });
  if (!result.ok) {
    for (const issue of result.errors) console.error(`[${issue.code}] ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
  } else {
    await mkdir(releaseRoot, { recursive: true });
    const gameBundlePath = join(releaseRoot, 'game-bundle.v1.json');
    const warningsPath = join(releaseRoot, 'compiler-warnings.json');
    const reportPath = join(releaseRoot, 'materialization-report.v1.json');

    await writeJson(gameBundlePath, result.bundle, force);
    await writeJson(warningsPath, { schemaVersion: 1, warnings: result.warnings }, force);
    const [blueprintSha256, projectSha256, assetManifestSha256, gameBundleSha256] = await Promise.all([
      sha256(blueprintPath),
      sha256(projectPath),
      sha256(assetManifestPath),
      sha256(gameBundlePath),
    ]);
    await writeJson(reportPath, {
      schemaVersion: 1,
      blueprintId: result.report.blueprintId,
      mapIds: result.report.mapIds,
      dialogueIncluded: result.report.dialogueIncluded,
      blueprint: { sha256: blueprintSha256 },
      project: { sha256: projectSha256 },
      assets: {
        manifest: { sha256: assetManifestSha256 },
        allowlist: [...result.report.assetAllowlist],
      },
      gameBundle: { sha256: gameBundleSha256 },
      offlineOnly: true,
      externalReferencesAllowed: false,
    }, force);
    console.log(JSON.stringify({
      ok: true,
      gameBundlePath,
      warningCount: result.warnings.length,
      mapIds: result.report.mapIds,
      dialogueIncluded: result.report.dialogueIncluded,
      gameBundleSha256,
    }, null, 2));
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
