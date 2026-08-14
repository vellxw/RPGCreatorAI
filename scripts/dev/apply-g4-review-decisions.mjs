#!/usr/bin/env node

/**
 * Apply an explicitly completed G4 checklist.
 *
 * The default path is intentionally fail-closed: technical status never
 * becomes acceptance, and no canonical file is written unless every resource
 * is present exactly once, has the same current hash as the review packet, and
 * the caller supplies an explicit confirmation phrase.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parseArgs(argv) {
  const options = {
    checklist: "output/g4-review/review-checklist.json",
    templateRoot: "templates/horror-bl",
    reviewerKind: null,
    reviewerLabel: null,
    confirm: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--checklist") options.checklist = argv[++index];
    else if (arg === "--template-root") options.templateRoot = argv[++index];
    else if (arg === "--reviewer-kind") options.reviewerKind = argv[++index];
    else if (arg === "--reviewer-label") options.reviewerLabel = argv[++index];
    else if (arg === "--confirm") options.confirm = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function help() {
  console.log(`Usage:
  Optional: --template-root templates/horror-bl
  node scripts/dev/apply-g4-review-decisions.mjs \
    --reviewer-kind human|delegated-by-creator \
    --reviewer-label "..." \
    --confirm "I reviewed and accept all 27 resources"

The human confirmation may also be written as "Acepto los 27 recursos"; the
delegated confirmation may be written as "Delego explícitamente la revisión
G4 a Codex". The wording is intentionally explicit and is never inferred.

The checklist must contain one explicit "accepted" decision for each of the
27 resources. The command re-hashes the packet inputs and runtime bytes before
writing canonical editor-acceptance-evidence.v1.json and accepted provenance.
It never infers acceptance from frozen/technical statuses.`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  return { bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

function resolveRepo(relativePath, label) {
  if (typeof relativePath !== "string" || relativePath.length === 0) throw new Error(`${label} path is missing`);
  const absolute = path.resolve(repoRoot, relativePath);
  const relative = path.relative(repoRoot, absolute);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`${label} escapes the repository`);
  return absolute;
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Node can reject replacement renames on some Windows configurations.
    // The fallback still replaces only this exact canonical file.
    try {
      fs.rmSync(filePath, { force: true });
      fs.renameSync(tempPath, filePath);
    } catch (fallbackError) {
      try { fs.rmSync(tempPath, { force: true }); } catch { /* preserve original error */ }
      throw new Error(`Unable to replace ${filePath}: ${fallbackError.message}; original: ${error.message}`);
    }
  }
}

/**
 * Replace the small set of canonical G4 documents as one recoverable unit.
 * The individual writes are atomic, but a process interruption between two
 * files would otherwise leave provenance, allowlists, and the gate at
 * different review states. Backups stay beside the canonical files, never in
 * the release tree, and are removed after commit or rollback.
 */
function writeCanonicalTransaction(writes) {
  const transactionId = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  const backups = [];
  try {
    for (const { filePath } of writes) {
      const exists = fs.existsSync(filePath);
      const backupPath = `${filePath}.g4-backup-${transactionId}`;
      if (exists) fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
      backups.push({ filePath, backupPath, exists });
    }
    for (const { filePath, value } of writes) writeJsonAtomic(filePath, value);
  } catch (error) {
    for (const backup of [...backups].reverse()) {
      try {
        if (backup.exists && fs.existsSync(backup.backupPath)) {
          fs.copyFileSync(backup.backupPath, backup.filePath);
        } else if (!backup.exists) {
          fs.rmSync(backup.filePath, { force: true });
        }
      } catch (rollbackError) {
        error.message += `; rollback failed for ${backup.filePath}: ${rollbackError.message}`;
      }
    }
    for (const backup of backups) {
      try { fs.rmSync(backup.backupPath, { force: true }); } catch { /* preserve original error */ }
    }
    throw error;
  }
  for (const backup of backups) {
    try { fs.rmSync(backup.backupPath, { force: true }); } catch (error) {
      throw new Error(`G4 canonical commit succeeded but backup cleanup failed for ${backup.filePath}: ${error.message}`);
    }
  }
}

function fail(message) {
  throw new Error(message);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return help();
  if (!options.reviewerKind || !["human", "delegated-by-creator"].includes(options.reviewerKind)) fail("--reviewer-kind must be human or delegated-by-creator");
  if (!options.reviewerLabel || options.reviewerLabel.trim().length < 2) fail("--reviewer-label is required");
  const expectedConfirmations = options.reviewerKind === "human"
    ? ["I reviewed and accept all 27 resources", "Acepto los 27 recursos"]
    : ["Creator explicitly delegated G4 review to Codex", "Delego explícitamente la revisión G4 a Codex"];
  if (!expectedConfirmations.includes(options.confirm)) fail(`Explicit confirmation must exactly equal one of: ${expectedConfirmations.join(" | ")}`);

  const checklistPath = resolveRepo(options.checklist, "checklist");
  const checklist = readJson(checklistPath);
  const packetReference = checklist.packet ?? "draft.json";
  const packetPath = path.isAbsolute(packetReference)
    ? resolveRepo(packetReference, "packet")
    : resolveRepo(path.relative(repoRoot, path.resolve(path.dirname(checklistPath), packetReference)), "packet");
  const packet = readJson(packetPath);
  if (packet.kind !== "rpgcreatorai.g4-review-packet" || packet.status !== "pending") fail("Checklist packet is not a pending G4 review packet");
  if (packet.summary?.validation !== "ready") fail("Technical validation in the packet is blocked");

  const templateRoot = resolveRepo(options.templateRoot, "template root");
  const templateRelative = (relativePath, label) => {
    const absolute = path.resolve(templateRoot, relativePath);
    const relativeToTemplate = path.relative(templateRoot, absolute);
    if (relativeToTemplate === ".." || relativeToTemplate.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToTemplate)) {
      fail(`${label} escapes the template root`);
    }
    return resolveRepo(path.relative(repoRoot, absolute), label);
  };
  const bundlePath = templateRelative("release-input/game-bundle.v1.json", "GameBundle");
  const manifestPath = templateRelative("data/assets/assets-manifest.json", "asset manifest");
  const provenancePath = templateRelative("release-input/asset-provenance.v1.json", "provenance");
  const animationPackageProvenancePath = templateRelative("data/assets/animation-packages/damian.provenance.v1.json", "animation package provenance");
  const allowlistPath = templateRelative("release-input/asset-allowlist.json", "allowlist");
  const gatePath = templateRelative("release-input/asset-approval-gate.v1.json", "approval gate");
  const evidencePath = templateRelative("release-input/editor-acceptance-evidence.v1.json", "acceptance evidence");

  const sourceByKey = {
    gameBundle: bundlePath,
    assetManifest: manifestPath,
    provenance: provenancePath,
    animationPackageProvenance: animationPackageProvenancePath,
    allowlist: allowlistPath,
    approvalGate: gatePath,
  };
  for (const [key, sourcePath] of Object.entries(sourceByKey)) {
    const expected = packet.source?.[key];
    const actual = hashFile(sourcePath);
    if (!expected || expected.sha256 !== actual.sha256 || expected.bytes !== actual.bytes) fail(`${key} changed since the packet was generated`);
  }
  if (fs.existsSync(evidencePath)) fail("Canonical G4 evidence already exists; refusing to overwrite it");

  const bundle = readJson(bundlePath);
  const manifest = readJson(manifestPath);
  const provenance = readJson(provenancePath);
  const animationPackageProvenance = readJson(animationPackageProvenancePath);
  const allowlist = readJson(allowlistPath);
  const gate = readJson(gatePath);
  const bundleAssets = bundle?.assets?.assets;
  if (!Array.isArray(bundleAssets) || bundleAssets.length !== 27) fail("GameBundle must contain exactly 27 assets");
  const decisions = checklist.decisions;
  if (!Array.isArray(decisions) || decisions.length !== 27) fail("Checklist must contain exactly 27 decisions");
  const packetResourcesById = new Map((packet.resources ?? []).map((resource) => [resource.resourceId, resource]));
  if (packetResourcesById.size !== 27) fail("Review packet must contain exactly 27 unique resources");
  const decisionById = new Map();
  for (const decision of decisions) {
    if (!decision?.resourceId || decisionById.has(decision.resourceId)) fail(`Checklist contains duplicate or invalid decision: ${decision?.resourceId ?? "unknown"}`);
    const packetResource = packetResourcesById.get(decision.resourceId);
    if (!packetResource) fail(`${decision.resourceId} is not present in the review packet`);
    if (decision.kind !== "asset" || decision.mediaType !== packetResource.mediaType || decision.sha256 !== packetResource.sha256) {
      fail(`${decision.resourceId} kind, media type, or hash does not match the review packet`);
    }
    if (!["pending", "accepted", "rejected", "needs-edit"].includes(decision.decision)) {
      fail(`${decision.resourceId} has an invalid decision value: ${decision.decision ?? "missing"}`);
    }
    if (decision.decision === "needs-edit" && !String(decision.notes ?? "").trim()) {
      fail(`${decision.resourceId} needs an explanatory note when marked needs-edit`);
    }
    if (decision.decision !== "accepted") fail(`${decision.resourceId} is not explicitly accepted (found ${decision.decision ?? "missing"})`);
    decisionById.set(decision.resourceId, decision);
  }
  if (decisionById.size !== bundleAssets.length) fail("Checklist and GameBundle resource sets differ");

  const manifestById = new Map((manifest.assets ?? []).map((asset) => [asset.id, asset]));
  const provenanceEntries = [
    ...(provenance.assets ?? []),
    ...(provenance.supplementalAudio ?? []),
    ...(provenance.supplementalAnimation ?? []),
  ];
  const provenanceById = new Map(provenanceEntries.map((entry) => [entry.assetId, entry]));
  const allowlistedIds = new Set([
    ...(allowlist.assetAllowlist ?? []),
    ...(allowlist.supplementalAudioAssetAllowlist ?? []),
    ...(allowlist.supplementalAnimationAssetAllowlist ?? []),
  ]);
  const resourceEvidence = [];
  for (const bundleAsset of bundleAssets) {
    const decision = decisionById.get(bundleAsset.id);
    const manifestAsset = manifestById.get(bundleAsset.id);
    const provenanceAsset = provenanceById.get(bundleAsset.id);
    if (!manifestAsset || !provenanceAsset || !allowlistedIds.has(bundleAsset.id)) fail(`${bundleAsset.id} is missing from manifest, provenance, or allowlist`);
    if (decision.sha256 !== packet.resources.find((resource) => resource.resourceId === bundleAsset.id)?.sha256) fail(`${bundleAsset.id} decision hash does not match the packet`);
    if (manifestAsset.path !== bundleAsset.path || provenanceAsset.runtimePath !== bundleAsset.path) fail(`${bundleAsset.id} path drift detected`);
    const runtimePath = templateRelative(bundleAsset.path, `${bundleAsset.id} runtime file`);
    const actual = hashFile(runtimePath);
    if (actual.sha256 !== manifestAsset.sha256 || actual.bytes !== manifestAsset.sizeBytes || actual.sha256 !== decision.sha256) fail(`${bundleAsset.id} runtime bytes no longer match manifest/checklist`);
    resourceEvidence.push({ resourceId: bundleAsset.id, kind: "asset", status: "accepted", sha256: actual.sha256, ...(decision.notes ? { notes: String(decision.notes).slice(0, 2000) } : {}) });
  }

  const reviewedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: 1,
    projectId: packet.projectId,
    status: "accepted",
    reviewedAt,
    reviewer: { kind: options.reviewerKind, label: options.reviewerLabel.trim() },
    reviewPacketSha256: hashFile(packetPath).sha256,
    reviewChecklistSha256: hashFile(checklistPath).sha256,
    gameBundleSha256: hashFile(bundlePath).sha256,
    assetManifestSha256: hashFile(manifestPath).sha256,
    resources: resourceEvidence,
  };
  const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`;
  const evidenceSha256 = crypto.createHash("sha256").update(evidenceJson, "utf8").digest("hex");

  const acceptance = {
    state: "accepted",
    evidence: "release-input/editor-acceptance-evidence.v1.json",
    evidenceSha256,
    reviewer: options.reviewerLabel.trim(),
    reviewedAt,
  };
  const nextProvenance = structuredClone(provenance);
  for (const collectionName of ["supplementalAudio", "supplementalAnimation"]) {
    for (const entry of nextProvenance[collectionName] ?? []) {
      if (!decisionById.has(entry.assetId)) fail(`${entry.assetId} in ${collectionName} has no checklist decision`);
      entry.humanAcceptance = { ...acceptance };
    }
  }
  const nextAnimationPackageProvenance = structuredClone(animationPackageProvenance);
  nextAnimationPackageProvenance.humanAcceptance = { ...acceptance };
  const nextAllowlist = structuredClone(allowlist);
  for (const policyName of ["supplementalAudioPolicy", "supplementalAnimationPolicy"]) {
    if (!nextAllowlist[policyName]) nextAllowlist[policyName] = {};
    nextAllowlist[policyName].humanAcceptance = "accepted";
    nextAllowlist[policyName].evidence = acceptance.evidence;
    nextAllowlist[policyName].evidenceSha256 = evidenceSha256;
    nextAllowlist[policyName].reviewer = acceptance.reviewer;
    nextAllowlist[policyName].reviewedAt = reviewedAt;
  }
  const nextGate = structuredClone(gate);
  for (const collectionName of ["supplementalAudio", "supplementalAnimation"]) {
    const section = nextGate[collectionName];
    if (!section) fail(`Approval gate is missing ${collectionName}`);
    section.humanAcceptance = { ...acceptance };
  }

  // Write only after every guard passed. The transaction preserves the
  // all-or-nothing invariant across the canonical files if a later write is
  // interrupted or rejected by the filesystem.
  writeCanonicalTransaction([
    { filePath: provenancePath, value: nextProvenance },
    { filePath: animationPackageProvenancePath, value: nextAnimationPackageProvenance },
    { filePath: allowlistPath, value: nextAllowlist },
    { filePath: gatePath, value: nextGate },
    { filePath: evidencePath, value: evidence },
  ]);
  console.log(JSON.stringify({ status: "accepted", reviewer: evidence.reviewer, reviewedAt, evidence: path.relative(repoRoot, evidencePath).replaceAll(path.sep, "/"), evidenceSha256, resources: resourceEvidence.length }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`G4 apply failed: ${error.message}`);
  process.exitCode = 1;
}
