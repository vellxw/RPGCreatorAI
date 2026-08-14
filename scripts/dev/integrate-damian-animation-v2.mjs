import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const templateRoot = join(repoRoot, 'templates', 'horror-bl');
const additionsPath = join(templateRoot, 'data', 'assets', 'animation-packages', 'damian.runtime-additions.v1.json');
const packageProvenancePath = join(templateRoot, 'data', 'assets', 'animation-packages', 'damian.provenance.v1.json');
const manifestPath = join(templateRoot, 'data', 'assets', 'assets-manifest.json');
const allowlistPath = join(templateRoot, 'release-input', 'asset-allowlist.json');
const releaseProvenancePath = join(templateRoot, 'release-input', 'asset-provenance.v1.json');
const approvalGatePath = join(templateRoot, 'release-input', 'asset-approval-gate.v1.json');

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const additions = await readJson(additionsPath);
const packageProvenance = await readJson(packageProvenancePath);
const manifest = await readJson(manifestPath);
const allowlist = await readJson(allowlistPath);
const releaseProvenance = await readJson(releaseProvenancePath);
const approvalGate = await readJson(approvalGatePath);

if (additions.schemaVersion !== 1 || !Array.isArray(additions.assets) || additions.assets.length !== 12) {
  throw new Error('Damián runtime additions must contain exactly 12 schema-v1 assets.');
}
if (packageProvenance.schemaVersion !== 1 || packageProvenance.humanAcceptance?.state !== 'pending') {
  throw new Error('Damián animation provenance must retain pending human acceptance.');
}

const animationAssets = additions.assets.map((asset) => ({
  ...asset,
  provenance: 'release-input/asset-provenance.v1.json#supplementalAnimation',
}));
const animationIds = animationAssets.map((asset) => asset.id);
if (new Set(animationIds).size !== animationIds.length) throw new Error('Duplicate Damián animation asset id.');

const existingIds = new Set(manifest.assets.map((asset) => asset.id));
for (const asset of animationAssets) {
  const runtimeFile = join(templateRoot, asset.path.replaceAll('/', '\\'));
  const bytes = await readFile(runtimeFile);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== asset.sha256 || bytes.length !== asset.sizeBytes) {
    throw new Error(`Runtime strip integrity mismatch for ${asset.id}.`);
  }
  const previous = manifest.assets.find((entry) => entry.id === asset.id);
  if (previous && JSON.stringify(previous) !== JSON.stringify(asset)) {
    throw new Error(`Existing animation manifest entry differs for ${asset.id}; refusing implicit overwrite.`);
  }
  if (!previous) manifest.assets.push(asset);
  existingIds.add(asset.id);
}

const visualIds = Array.isArray(allowlist.assetAllowlist) ? [...allowlist.assetAllowlist] : [];
allowlist.assetAllowlist = visualIds;
allowlist.supplementalAnimationAssetAllowlist = animationIds;
allowlist.supplementalAnimationPolicy = {
  technicalOnly: true,
  humanAcceptance: 'pending/not-recorded',
  includedInVisualApprovalGate: false,
  package: 'data/assets/animation-packages/damian.animation-package.v1.json',
};

const animationPrompt = JSON.stringify({
  styleSource: packageProvenance.styleSource,
  promptPolicy: packageProvenance.promptPolicy,
  normalization: packageProvenance.normalization,
}, null, 0);
const animationPromptHash = sha256(animationPrompt);
const generatedAt = new Date(packageProvenance.generatedAt).toISOString();
const animationProvenance = animationAssets.map((asset) => ({
  assetId: asset.id,
  runtimePath: asset.path,
  source: 'generated',
  origin: 'Generated from the retained adult Damián animation session with OpenAI built-in image generation, then normalized into a transparent four-frame strip by the RPGCreatorAI animation pipeline.',
  license: 'No standalone copyright license or unrestricted public-redistribution right is asserted. Prompts, source masters, normalization metadata, hashes, and human-acceptance status are retained for project-local packaging.',
  review: {
    state: 'frozen',
    reviewer: 'Codex automated technical sprite review (delegated by project creator)',
    decidedAt: generatedAt,
  },
  generated: {
    providerId: 'openai-built-in-image-generation',
    providerDisplayName: 'OpenAI built-in image generation',
    modelId: 'not-disclosed',
    modelDisclosure: 'The built-in image generation session did not expose a model identifier.',
    tool: 'image_gen.imagegen + Pillow',
    operation: 'image.generate+normalize-sprite-strip',
    createdAt: generatedAt,
    generationRecordPath: 'data/assets/animation-packages/damian.provenance.v1.json',
    sourceMasterPath: 'assets/source/generated/animation/damian-v2/damian-animation-master-v2.png',
    promptSha256: animationPromptHash,
    prompt: animationPrompt,
    outputSha256: asset.sha256,
    outputSizeBytes: asset.sizeBytes,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    hasAlpha: true,
    referenceImages: ['assets/generated/runtime/characters/damian-fullbody-seed-v1.png'],
    identityConsent: {
      status: 'not-applicable',
      basis: 'No real-person identity or user-supplied reference image was used.',
    },
    sourceAssetIds: ['seed.damian.full-body'],
  },
  technicalReview: {
    state: 'generated-verified',
    verificationScript: 'scripts/dev/validate-damian-animation-v2.mjs',
    qaReport: 'data/assets/animation-packages/damian.qa.v1.json',
  },
  humanAcceptance: {
    state: 'pending',
    evidence: 'not-recorded',
  },
}));

const existingAnimationProvenance = Array.isArray(releaseProvenance.supplementalAnimation)
  ? releaseProvenance.supplementalAnimation
  : [];
if (existingAnimationProvenance.length > 0 && JSON.stringify(existingAnimationProvenance) !== JSON.stringify(animationProvenance)) {
  throw new Error('Existing supplemental animation provenance differs; refusing implicit overwrite.');
}
releaseProvenance.supplementalAnimation = animationProvenance;

approvalGate.supplementalAnimation = {
  schemaVersion: 1,
  scope: 'Technical integrity evidence for generated Damián AnimationPackage v1 strips. This section does not modify the seven visual requiredSlots or visual releaseReady derivation.',
  package: 'data/assets/animation-packages/damian.animation-package.v1.json',
  technicalReview: {
    state: 'generated-verified',
    reviewer: 'Codex automated technical sprite review (not human acceptance)',
    verificationScript: 'scripts/dev/validate-damian-animation-v2.mjs',
    qaReport: 'data/assets/animation-packages/damian.qa.v1.json',
  },
  humanAcceptance: {
    state: 'pending',
    evidence: 'not-recorded',
    note: 'No human visual playtest or release acceptance is asserted by this technical record.',
  },
  assets: animationAssets.map((asset) => ({
    assetId: asset.id,
    runtimePath: asset.path,
    mediaType: asset.mediaType,
    frameWidth: asset.frameWidth,
    frameHeight: asset.frameHeight,
    frameCount: asset.frames,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
    action: asset.generated.spriteSheet.action,
    direction: asset.generated.spriteSheet.direction,
    animationSetId: asset.generated.spriteSheet.animationSetId,
    fps: asset.generated.spriteSheet.fps,
    anchor: asset.generated.spriteSheet.anchor,
  })),
};

await writeJson(manifestPath, manifest);
await writeJson(allowlistPath, allowlist);
await writeJson(releaseProvenancePath, releaseProvenance);
await writeJson(approvalGatePath, approvalGate);

console.log(JSON.stringify({
  integrated: true,
  animationAssets: animationAssets.length,
  animationIds,
  manifestAssets: manifest.assets.length,
  visualAllowlist: visualIds.length,
  supplementalAnimationAllowlist: animationIds.length,
  supplementalAudioAllowlist: allowlist.supplementalAudioAssetAllowlist?.length ?? 0,
}, null, 2));
