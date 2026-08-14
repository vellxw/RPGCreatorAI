#!/usr/bin/env node
/** Technical-only integrity validation for Horror BL's supplemental audio. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const readJson = relative => JSON.parse(readFileSync(resolve(root, relative), 'utf8'));
const paths = {
  manifest: 'templates/horror-bl/data/assets/assets-manifest.json',
  allowlist: 'templates/horror-bl/release-input/asset-allowlist.json',
  provenance: 'templates/horror-bl/release-input/asset-provenance.v1.json',
  gate: 'templates/horror-bl/release-input/asset-approval-gate.v1.json',
  bundle: 'templates/horror-bl/release-input/game-bundle.v1.json',
  acceptanceEvidence: 'templates/horror-bl/release-input/editor-acceptance-evidence.v1.json',
  generator: 'scripts/dev/generate-horror-bl-audio.mjs',
};
const expectedIds = [
  'audio.ambience.facility-lobby', 'audio.ambience.archive-sublevel',
  'audio.ambience.service-corridor', 'audio.stinger.ninth-witness',
  'audio.ui.confirm', 'audio.ui.cancel', 'audio.footstep.concrete',
  'audio.ending.memory-release',
];
const issues = [];
const check = (condition, message) => { if (!condition) issues.push(message); };
const sorted = values => [...values].sort().join('\n');
const exactIds = values => sorted(values) === sorted(expectedIds);

const generated = spawnSync(process.execPath, [resolve(root, paths.generator), '--verify'], {
  cwd: root, encoding: 'utf8',
});
check(generated.status === 0, `Generator bytes are not reproducible: ${generated.stdout}${generated.stderr}`);

const manifest = readJson(paths.manifest);
const allowlist = readJson(paths.allowlist);
const provenance = readJson(paths.provenance);
const gate = readJson(paths.gate);
const bundle = readJson(paths.bundle);
const acceptanceEvidence = existsSync(resolve(root, paths.acceptanceEvidence))
  ? readJson(paths.acceptanceEvidence)
  : null;
const acceptanceEvidenceReference = 'release-input/editor-acceptance-evidence.v1.json';
const acceptanceEvidenceHash = acceptanceEvidence
  ? createHash('sha256').update(readFileSync(resolve(root, paths.acceptanceEvidence))).digest('hex')
  : null;
const acceptanceResources = new Map((acceptanceEvidence?.resources ?? []).map(resource => [resource.resourceId, resource]));
const hasAcceptedEvidence = (id, sha256) => Boolean(
  acceptanceEvidence?.status === 'accepted' &&
  acceptanceEvidenceHash &&
  acceptanceResources.get(id)?.status === 'accepted' &&
  acceptanceResources.get(id)?.sha256 === sha256
);
const isPendingAcceptance = acceptance => acceptance?.state === 'pending' && acceptance?.evidence === 'not-recorded';
const isAcceptedAcceptance = acceptance => Boolean(
  acceptance?.state === 'accepted' &&
  acceptance?.evidence === acceptanceEvidenceReference &&
  acceptance?.evidenceSha256 === acceptanceEvidenceHash
);
const manifestAudio = manifest.assets.filter(asset => asset.kind === 'audio');
const manifestById = new Map(manifestAudio.map(asset => [asset.id, asset]));
const provenanceById = new Map((provenance.supplementalAudio ?? []).map(asset => [asset.assetId, asset]));
const gateAudio = gate.supplementalAudio;
const gateById = new Map((gateAudio?.assets ?? []).map(asset => [asset.assetId, asset]));

check(exactIds(manifestAudio.map(asset => asset.id)), 'Manifest supplemental audio ids must exactly match the eight required cues.');
check(exactIds(allowlist.supplementalAudioAssetAllowlist ?? []), 'Supplemental audio allowlist must exactly match the eight required cues.');
check(exactIds(provenanceById.keys()), 'Supplemental audio provenance must exactly match the eight required cues.');
check(exactIds(gateById.keys()), 'Supplemental audio gate records must exactly match the eight required cues.');
check(gate.releaseReady === true && (gate.requiredSlots ?? []).length === 7,
  'Supplemental audio must not alter the visual gate releaseReady or its seven required slots.');
check(gateAudio?.technicalReview?.state === 'generated-verified', 'Supplemental audio requires generated-verified technical review.');
check(isPendingAcceptance(gateAudio?.humanAcceptance) || isAcceptedAcceptance(gateAudio?.humanAcceptance),
  'Supplemental audio human acceptance must be pending/not-recorded or accepted with hash-bound evidence.');

for (const id of expectedIds) {
  const asset = manifestById.get(id);
  const provenanceAsset = provenanceById.get(id);
  const gateAsset = gateById.get(id);
  check(Boolean(asset && provenanceAsset && gateAsset), `${id} is missing from a supplemental audio record.`);
  if (!asset || !provenanceAsset || !gateAsset) continue;
  const assetPath = resolve(root, 'templates/horror-bl', asset.path);
  const file = existsSync(assetPath) ? readFileSync(assetPath) : null;
  const sha256 = file ? createHash('sha256').update(file).digest('hex') : '';
  check(asset.source === 'generated' && asset.status === 'frozen' && asset.releaseEligible === true && asset.runtimeCompatible === true,
    `${id} must be frozen, release-eligible, and runtime-compatible after technical byte verification.`);
  check(asset.mediaType === 'audio/wav' && Number.isInteger(asset.durationMs) && asset.durationMs > 0,
    `${id} must declare a positive WAV duration.`);
  check(Boolean(file) && asset.sha256 === sha256 && asset.sizeBytes === file.length,
    `${id} bytes do not match its manifest hash/size.`);
  check(gateAsset.runtimePath === asset.path && gateAsset.sha256 === asset.sha256 && gateAsset.sizeBytes === asset.sizeBytes && gateAsset.durationMs === asset.durationMs,
    `${id} gate metadata must match the manifest.`);
  check(provenanceAsset.runtimePath === asset.path && provenanceAsset.generation?.outputSha256 === asset.sha256 && provenanceAsset.generation?.outputSizeBytes === asset.sizeBytes && provenanceAsset.generation?.durationMs === asset.durationMs,
    `${id} provenance metadata must match the manifest.`);
  const acceptanceValid = isPendingAcceptance(provenanceAsset.humanAcceptance)
    || (isAcceptedAcceptance(provenanceAsset.humanAcceptance) && hasAcceptedEvidence(id, asset.sha256));
  check(provenanceAsset.technicalReview?.state === 'generated-verified' && acceptanceValid,
    `${id} provenance must have pending acceptance or accepted hash-bound evidence.`);
  check(bundle.assets?.assets?.some(bundleAsset => bundleAsset.id === id && bundleAsset.path === asset.path && bundleAsset.kind === 'audio'),
    `${id} must be included in GameBundle.assets with its manifest route.`);
}

const audioRoutes = bundle.databases?.system?.audio ?? {};
const routedPaths = new Set(Object.values(audioRoutes));
for (const id of expectedIds) {
  const asset = manifestById.get(id);
  if (asset) check(routedPaths.has(asset.path), `${id} must be reachable through GameBundle system.audio.`);
}
check(bundle.databases?.system?.defaultBgm === 'ambience_facility_lobby', 'GameBundle must default to the facility-lobby ambience.');
check(Object.values(audioRoutes).every(path => typeof path === 'string' && path.startsWith('assets/audio/horror-bl/')),
  'GameBundle system.audio must not route to generic town/chest fixture files.');

const report = {
  schemaVersion: 1,
  technicalPass: issues.length === 0,
  humanAcceptance: expectedIds.every(id => isAcceptedAcceptance(provenanceById.get(id)?.humanAcceptance)) ? 'accepted' : 'pending/not-recorded',
  visualReleaseReady: gate.releaseReady === true,
  audioAssetIds: expectedIds,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length) process.exitCode = 1;
