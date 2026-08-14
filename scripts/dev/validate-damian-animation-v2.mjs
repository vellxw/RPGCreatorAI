import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const templateRoot = join(repoRoot, 'templates', 'horror-bl');
const additionsPath = join(templateRoot, 'data', 'assets', 'animation-packages', 'damian.runtime-additions.v1.json');
const packagePath = join(templateRoot, 'data', 'assets', 'animation-packages', 'damian.animation-package.v1.json');
const provenancePath = join(templateRoot, 'data', 'assets', 'animation-packages', 'damian.provenance.v1.json');
const acceptanceEvidencePath = join(templateRoot, 'release-input', 'editor-acceptance-evidence.v1.json');

const additions = JSON.parse(await readFile(additionsPath, 'utf8'));
const animationPackage = JSON.parse(await readFile(packagePath, 'utf8'));
const animationProvenance = JSON.parse(await readFile(provenancePath, 'utf8'));
const acceptanceEvidence = existsSync(acceptanceEvidencePath)
  ? JSON.parse(await readFile(acceptanceEvidencePath, 'utf8'))
  : null;
const acceptanceEvidenceHash = acceptanceEvidence
  ? createHash('sha256').update(await readFile(acceptanceEvidencePath)).digest('hex')
  : null;
const issues = [];
const expectedClips = new Set(animationPackage.clips.map((clip) => clip.id));
const seenClips = new Set();
const humanAcceptance = animationProvenance.humanAcceptance ?? additions.humanAcceptance ?? { state: 'missing', evidence: 'missing' };
const acceptanceEvidenceReference = 'release-input/editor-acceptance-evidence.v1.json';
const evidenceById = new Map((acceptanceEvidence?.resources ?? []).map((resource) => [resource.resourceId, resource]));
const isAccepted = (assetId, sha256) => Boolean(
  acceptanceEvidence?.status === 'accepted' &&
  acceptanceEvidenceHash &&
  humanAcceptance.state === 'accepted' &&
  humanAcceptance.evidence === acceptanceEvidenceReference &&
  humanAcceptance.evidenceSha256 === acceptanceEvidenceHash &&
  evidenceById.get(assetId)?.status === 'accepted' &&
  evidenceById.get(assetId)?.sha256 === sha256
);
const isPending = humanAcceptance.state === 'pending' && humanAcceptance.evidence === 'not-recorded';

if (!isPending && !(acceptanceEvidence?.status === 'accepted' && (additions.assets ?? []).every((asset) => isAccepted(asset.id, asset.sha256)))) {
  issues.push('human acceptance must be pending/not-recorded or accepted with hash-bound evidence for every strip');
}

if (additions.schemaVersion !== 1 || !Array.isArray(additions.assets) || additions.assets.length !== 12) {
  issues.push('runtime additions must contain exactly 12 schema-v1 assets');
}
for (const asset of additions.assets ?? []) {
  const filePath = join(templateRoot, asset.path.replaceAll('/', '\\'));
  try {
    const bytes = await readFile(filePath);
    const fileInfo = await stat(filePath);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== asset.sha256) issues.push(`${asset.id}: sha256 mismatch`);
    if (fileInfo.size !== asset.sizeBytes) issues.push(`${asset.id}: size mismatch`);
    if (asset.width !== 1024 || asset.height !== 384 || asset.frameWidth !== 256 || asset.frameHeight !== 384 || asset.frames !== 4) {
      issues.push(`${asset.id}: expected 1024x384 strip with four 256x384 frames`);
    }
    if (asset.generated?.spriteSheet?.frameLayout !== 'horizontal-strip') issues.push(`${asset.id}: missing horizontal-strip metadata`);
    const clipId = `${asset.generated?.spriteSheet?.action}.${asset.generated?.spriteSheet?.direction}`;
    if (!/^sprite\.damian\.(idle|walk|interact)\.(down|left|right|up)$/.test(asset.id)) issues.push(`${asset.id}: non-canonical animation id`);
    if (asset.kind !== 'spritesheet' || asset.source !== 'generated' || asset.status !== 'frozen' || asset.releaseEligible !== true || asset.runtimeCompatible !== true || asset.mediaType !== 'image/png') {
      issues.push(`${asset.id}: invalid release metadata`);
    }
    if (!isPending && !isAccepted(asset.id, asset.sha256)) issues.push(`${asset.id}: missing accepted hash-bound evidence`);
    seenClips.add(clipId);
  } catch (error) {
    issues.push(`${asset.id}: ${error.message}`);
  }
}
for (const clip of expectedClips) if (!seenClips.has(clip)) issues.push(`missing runtime strip for ${clip}`);

const report = {
  schemaVersion: 1,
  technicalPass: issues.length === 0,
  humanAcceptance,
  assetCount: additions.assets?.length ?? 0,
  clipCount: seenClips.size,
  issues,
};
console.log(JSON.stringify(report, null, 2));
if (issues.length > 0) process.exitCode = 1;
