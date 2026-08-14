#!/usr/bin/env node

/**
 * Build a read-only G4 review packet for the Horror BL template.
 *
 * This command deliberately never writes canonical approval evidence. It only
 * re-checks the bytes referenced by the canonical inputs and emits a packet a
 * creator can inspect before making an explicit, hash-bound decision.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "../..");

function printHelp() {
  console.log(`Usage: node scripts/dev/create-g4-review-packet.mjs [options]

Options:
  --template-root <path>  Template root (default: templates/horror-bl)
  --output <path>         Packet output directory (default: output/g4-review)
  --help                  Show this help

The packet is non-canonical. All 27 resource decisions remain pending until
the creator explicitly records editor-acceptance-evidence.v1.json.`);
}

function parseArgs(argv) {
  const options = { templateRoot: "templates/horror-bl", output: "output/g4-review" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--template-root" || arg === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a path`);
      }
      options[arg === "--template-root" ? "templateRoot" : "output"] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error.message}`);
  }
}

function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  const bytes = fs.readFileSync(filePath);
  digest.update(bytes);
  return { bytes: bytes.length, sha256: digest.digest("hex"), buffer: bytes };
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function relativeRepo(repoRoot, filePath) {
  return toPosix(path.relative(repoRoot, filePath));
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolveContained(root, relativePath, label) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error(`${label} has no path`);
  }
  const candidate = path.resolve(root, relativePath);
  if (!isWithin(root, candidate)) {
    throw new Error(`${label} escapes its root: ${relativePath}`);
  }
  return candidate;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : value;
}

function getProvenanceEntries(provenance) {
  return [
    ...(provenance.assets ?? []),
    ...(provenance.supplementalAudio ?? provenance.audio ?? []),
    ...(provenance.supplementalAnimation ?? provenance.animation ?? []),
  ];
}

function getProvenanceOutput(provenanceEntry) {
  const generated = provenanceEntry?.generated ?? {};
  const generation = provenanceEntry?.generation ?? {};
  return {
    sha256: generated.outputSha256 ?? generation.outputSha256 ?? null,
    sizeBytes: generated.outputSizeBytes ?? generation.outputSizeBytes ?? null,
  };
}

function validatePng(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const errors = [];
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    errors.push("invalid PNG signature");
    return { ok: false, errors };
  }
  if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    errors.push("missing PNG IHDR");
    return { ok: false, errors };
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width === 0 || height === 0) errors.push("PNG dimensions are zero");
  return { ok: errors.length === 0, errors, width, height };
}

function validateWav(bytes) {
  const errors = [];
  if (bytes.length < 12 || bytes.subarray(0, 4).toString("ascii") !== "RIFF" || bytes.subarray(8, 12).toString("ascii") !== "WAVE") {
    return { ok: false, errors: ["invalid RIFF/WAVE header"] };
  }

  let offset = 12;
  let fmt = null;
  let dataBytes = null;
  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > bytes.length) {
      errors.push(`WAV chunk ${chunkId} exceeds file length`);
      break;
    }
    if (chunkId === "fmt " && chunkSize >= 16) {
      fmt = {
        audioFormat: bytes.readUInt16LE(chunkStart),
        channels: bytes.readUInt16LE(chunkStart + 2),
        sampleRateHz: bytes.readUInt32LE(chunkStart + 4),
        byteRate: bytes.readUInt32LE(chunkStart + 8),
        bitsPerSample: bytes.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === "data") {
      dataBytes = chunkSize;
    }
    offset = chunkEnd + (chunkSize % 2);
  }

  if (!fmt) errors.push("WAV fmt chunk is missing");
  if (dataBytes === null) errors.push("WAV data chunk is missing");
  if (fmt && (fmt.audioFormat !== 1 || fmt.channels === 0 || fmt.sampleRateHz === 0 || fmt.bitsPerSample === 0)) {
    errors.push("WAV PCM metadata is invalid");
  }
  const durationMs = fmt && dataBytes !== null && fmt.byteRate > 0 ? Math.round((dataBytes / fmt.byteRate) * 1000) : null;
  return { ok: errors.length === 0, errors, ...fmt, dataBytes, durationMs };
}

function validateMedia(asset, bytes) {
  const extension = path.extname(asset.path ?? "").toLowerCase();
  const isAudio = (asset.mediaType ?? "").startsWith("audio/") || extension === ".wav" || asset.kind === "audio";
  if (isAudio) {
    return { mediaType: "audio/wav", ...validateWav(bytes) };
  }
  const png = validatePng(bytes);
  return { mediaType: "image/png", ...png };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const repoRoot = defaultRepoRoot;
  const templateRoot = path.resolve(repoRoot, options.templateRoot);
  const outputDir = path.resolve(repoRoot, options.output);
  if (!isWithin(repoRoot, templateRoot)) throw new Error("--template-root must stay inside the repository");
  if (!isWithin(repoRoot, outputDir)) throw new Error("--output must stay inside the repository");

  const inputPaths = {
    gameBundle: path.join(templateRoot, "release-input/game-bundle.v1.json"),
    assetManifest: path.join(templateRoot, "data/assets/assets-manifest.json"),
    provenance: path.join(templateRoot, "release-input/asset-provenance.v1.json"),
    animationPackageProvenance: path.join(templateRoot, "data/assets/animation-packages/damian.provenance.v1.json"),
    allowlist: path.join(templateRoot, "release-input/asset-allowlist.json"),
    approvalGate: path.join(templateRoot, "release-input/asset-approval-gate.v1.json"),
  };
  const inputs = Object.fromEntries(Object.entries(inputPaths).map(([key, filePath]) => [key, { filePath, ...sha256File(filePath) }]));
  const bundle = readJson(inputPaths.gameBundle);
  const manifest = readJson(inputPaths.assetManifest);
  const provenance = readJson(inputPaths.provenance);
  const allowlist = readJson(inputPaths.allowlist);
  const approvalGate = readJson(inputPaths.approvalGate);

  const bundleAssets = bundle?.assets?.assets;
  const manifestAssets = manifest?.assets;
  if (!Array.isArray(bundleAssets) || !Array.isArray(manifestAssets)) throw new Error("Bundle or asset manifest has no assets array");
  const blockers = [];
  const expectedAssetCount = 27;
  if (bundleAssets.length !== expectedAssetCount) blockers.push(`expected ${expectedAssetCount} bundle assets, found ${bundleAssets.length}`);
  const bundleIds = new Set();
  for (const asset of bundleAssets) {
    if (bundleIds.has(asset.id)) blockers.push(`duplicate bundle asset id: ${asset.id}`);
    bundleIds.add(asset.id);
  }
  const manifestById = new Map(manifestAssets.map((asset) => [asset.id, asset]));
  const provenanceById = new Map(getProvenanceEntries(provenance).map((asset) => [asset.assetId, asset]));
  const allowlistedIds = new Set([
    ...(allowlist.assetAllowlist ?? []),
    ...(allowlist.supplementalAudioAssetAllowlist ?? []),
    ...(allowlist.supplementalAnimationAssetAllowlist ?? []),
  ]);

  const resources = bundleAssets.map((bundleAsset, index) => {
    const resourceBlockers = [];
    const manifestAsset = manifestById.get(bundleAsset.id);
    const provenanceAsset = provenanceById.get(bundleAsset.id);
    if (!manifestAsset) resourceBlockers.push("missing from asset manifest");
    if (!provenanceAsset) resourceBlockers.push("missing from asset provenance");
    if (!allowlistedIds.has(bundleAsset.id)) resourceBlockers.push("missing from release allowlist");

    const bundlePath = normalizePath(bundleAsset.path);
    const manifestPath = normalizePath(manifestAsset?.path);
    const provenancePath = normalizePath(provenanceAsset?.runtimePath);
    if (bundlePath !== manifestPath) resourceBlockers.push("bundle path differs from manifest path");
    if (bundlePath !== provenancePath) resourceBlockers.push("bundle path differs from provenance runtimePath");

    let actualPath = null;
    let fileInfo = null;
    let technical = null;
    if (bundlePath) {
      try {
        actualPath = resolveContained(templateRoot, bundlePath, `asset ${bundleAsset.id}`);
        if (!fs.existsSync(actualPath)) {
          resourceBlockers.push("runtime file does not exist");
        } else {
          fileInfo = sha256File(actualPath);
          technical = validateMedia({ ...bundleAsset, ...manifestAsset }, fileInfo.buffer);
          if (!technical.ok) resourceBlockers.push(...technical.errors);
          if (manifestAsset?.sizeBytes !== undefined && manifestAsset.sizeBytes !== fileInfo.bytes) resourceBlockers.push("manifest sizeBytes differs from runtime bytes");
          if (manifestAsset?.sha256 && manifestAsset.sha256 !== fileInfo.sha256) resourceBlockers.push("manifest sha256 differs from runtime bytes");
          const provenanceOutput = getProvenanceOutput(provenanceAsset);
          if (provenanceOutput.sizeBytes !== null && provenanceOutput.sizeBytes !== fileInfo.bytes) resourceBlockers.push("provenance outputSizeBytes differs from runtime bytes");
          if (provenanceOutput.sha256 && provenanceOutput.sha256 !== fileInfo.sha256) resourceBlockers.push("provenance outputSha256 differs from runtime bytes");
        }
      } catch (error) {
        resourceBlockers.push(error.message);
      }
    }
    if (manifestAsset && manifestAsset.runtimeCompatible !== true) resourceBlockers.push("manifest marks asset runtime-incompatible");
    if (manifestAsset && manifestAsset.releaseEligible !== true) resourceBlockers.push("manifest marks asset release-ineligible");

    const kind = (manifestAsset?.kind ?? bundleAsset.kind ?? "asset");
    const isAudio = (manifestAsset?.mediaType ?? "").startsWith("audio/") || path.extname(bundlePath ?? "").toLowerCase() === ".wav";
    const mediaType = technical?.mediaType ?? manifestAsset?.mediaType ?? (isAudio ? "audio/wav" : "image/png");
    return {
      order: index,
      resourceId: bundleAsset.id,
      name: bundleAsset.name ?? manifestAsset?.name ?? bundleAsset.id,
      kind,
      mediaType,
      runtimePath: bundlePath,
      sourcePath: provenanceAsset?.generated?.sourceMasterPath ?? null,
      bytes: fileInfo?.bytes ?? null,
      sha256: fileInfo?.sha256 ?? null,
      dimensions: technical?.width ? { width: technical.width, height: technical.height } : null,
      technical: {
        manifestStatus: manifestAsset?.status ?? "missing",
        releaseEligible: manifestAsset?.releaseEligible === true,
        runtimeCompatible: manifestAsset?.runtimeCompatible === true,
        provenanceReviewState: provenanceAsset?.review?.state ?? "missing",
        technicalReviewState: provenanceAsset?.technicalReview?.state ?? "not-recorded",
        validation: technical?.ok === true ? "pass" : "blocked",
        validationDetails: technical?.errors ?? [],
      },
      humanAcceptance: { status: "pending", evidence: "not-recorded", notes: "Creator decision required; no automatic approval is recorded." },
      preview: { type: isAudio ? "audio" : "image", path: actualPath ? toPosix(path.relative(outputDir, actualPath)) : null },
      animation: manifestAsset?.generated?.spriteSheet ? {
        frameWidth: Number(manifestAsset.generated.spriteSheet.frameWidth),
        frameHeight: Number(manifestAsset.generated.spriteSheet.frameHeight),
        frames: Number(manifestAsset.generated.spriteSheet.frameCount),
        fps: Number(manifestAsset.generated.spriteSheet.fps),
        action: manifestAsset.generated.spriteSheet.action ?? null,
        direction: manifestAsset.generated.spriteSheet.direction ?? null,
      } : null,
      blockers: resourceBlockers,
    };
  });

  for (const resource of resources) {
    if (resource.blockers.length > 0) blockers.push(`${resource.resourceId}: ${resource.blockers.join("; ")}`);
  }
  if (new Set(manifestAssets.map((asset) => asset.id)).size !== manifestAssets.length) blockers.push("asset manifest contains duplicate ids");
  if (approvalGate?.releaseReady !== true) blockers.push("approval gate releaseReady is not true");

  fs.mkdirSync(outputDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const draft = {
    schemaVersion: 1,
    kind: "rpgcreatorai.g4-review-packet",
    generatedAt,
    status: "pending",
    projectId: approvalGate?.templateId ?? "horror-bl",
    chapterId: approvalGate?.chapterId ?? null,
    source: Object.fromEntries(Object.entries(inputs).map(([key, info]) => [key, {
      path: relativeRepo(repoRoot, info.filePath),
      bytes: info.bytes,
      sha256: info.sha256,
    }])),
    summary: {
      expectedAssetCount,
      assetCount: resources.length,
      visualCount: resources.filter((resource) => resource.preview.type === "image").length,
      audioCount: resources.filter((resource) => resource.preview.type === "audio").length,
      idsUnique: new Set(resources.map((resource) => resource.resourceId)).size === resources.length,
      validation: blockers.length === 0 ? "ready" : "blocked",
      blockers,
      humanAcceptance: "pending/not-recorded",
    },
    resources,
    instructions: [
      "Open contact-sheet.html and inspect every image/spritesheet at readable size.",
      "Listen to every WAV with the local audio controls.",
      "Record one explicit accept or reject decision per resource outside this packet.",
      "Do not edit manifests, allowlists, staging, or canonical evidence while reviewing.",
      "A changed byte invalidates this packet and requires a new hash-bound review.",
    ],
  };
  fs.writeFileSync(path.join(outputDir, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`, "utf8");

  const checklist = {
    schemaVersion: 1,
    packet: "draft.json",
    status: "pending",
    generatedAt,
    decisions: resources.map((resource) => ({
      resourceId: resource.resourceId,
      kind: "asset",
      mediaType: resource.mediaType,
      sha256: resource.sha256,
      decision: "pending",
      notes: "",
    })),
  };
  fs.writeFileSync(path.join(outputDir, "review-checklist.json"), `${JSON.stringify(checklist, null, 2)}\n`, "utf8");

  const markdownRows = resources.map((resource) => `| ${resource.resourceId} | ${resource.preview.type} | ${resource.bytes ?? "—"} | \`${resource.sha256 ?? "—"}\` | pending |`).join("\n");
  const markdown = `# G4 review checklist — ${escapeHtml(draft.projectId)}

Generated: ${generatedAt}

This is a read-only review packet. Every decision is **pending**. It does not create or modify canonical approval evidence. Inspect [contact-sheet.html](./contact-sheet.html), then record explicit decisions in a separate authorized step.

Validation: **${draft.summary.validation}** — ${draft.summary.blockers.length ? `${draft.summary.blockers.length} blocker(s)` : "all technical references and runtime bytes match"}.

| Resource | Type | Bytes | SHA-256 | Decision |
|---|---:|---:|---|---|
${markdownRows}

## Human review

- [ ] I inspected all 19 image/spritesheet resources.
- [ ] I listened to all 8 WAV resources.
- [ ] I recorded an explicit decision for every resource.
- [ ] I understand that changing any source byte requires a new packet.

When every row in 'review-checklist.json' is explicitly changed to 'accepted',
run the guarded apply command (the exact confirmation phrase is intentional):

~~~powershell
node scripts/dev/apply-g4-review-decisions.mjs --reviewer-kind human --reviewer-label "Tu nombre o identidad de revisión" --confirm "Acepto los 27 recursos"
~~~

For an explicitly delegated review, use 'delegated-by-creator' and the
delegation confirmation phrase documented by the command's help output.
`;
  fs.writeFileSync(path.join(outputDir, "review-checklist.md"), markdown, "utf8");

  const visualResources = resources.filter((resource) => resource.preview.type === "image");
  const audioResources = resources.filter((resource) => resource.preview.type === "audio");
  const renderPreview = (resource) => {
    const source = resource.preview.path ? escapeHtml(resource.preview.path) : "";
    const technical = resource.dimensions ? `${resource.dimensions.width}×${resource.dimensions.height}` : resource.technical.validation;
    const animation = resource.animation && Number.isFinite(resource.animation.frameWidth) && Number.isFinite(resource.animation.frames)
      ? `<div class="sprite-preview" role="img" aria-label="Animated preview of ${escapeHtml(resource.name)}" style="--frame-width:${resource.animation.frameWidth}px;--frame-height:${resource.animation.frameHeight}px;--frames:${resource.animation.frames};--duration:${Math.max(0.1, resource.animation.frames / Math.max(1, resource.animation.fps || 8))}s;background-image:url('${source}')"></div><p class="meta">${escapeHtml(resource.animation.action ?? "animation")} · ${escapeHtml(resource.animation.direction ?? "")} · ${escapeHtml(String(resource.animation.fps || 8))} fps</p>`
      : (source ? `<img loading="lazy" src="${source}" alt="${escapeHtml(resource.name)}">` : "<p>Preview unavailable</p>");
    return `<article class="card" data-resource-id="${escapeHtml(resource.resourceId)}" data-kind="image" data-status="pending"><div class="card-head"><h2>${escapeHtml(resource.resourceId)}</h2><span class="badge">image</span></div><p>${escapeHtml(resource.name)} · ${escapeHtml(technical)}</p><p class="hash">${escapeHtml(resource.sha256 ?? "hash unavailable")}</p>${animation}<div class="review-controls"><label>Decision <select class="decision"><option value="pending" selected>pending</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="needs-edit">needs-edit</option></select></label><label>Notes <textarea class="notes" rows="2" placeholder="Optional review note"></textarea></label></div></article>`;
  };
  const renderAudio = (resource) => {
    const source = resource.preview.path ? escapeHtml(resource.preview.path) : "";
    return `<article class="audio-row" data-resource-id="${escapeHtml(resource.resourceId)}" data-kind="audio" data-status="pending"><div><div class="card-head"><h2>${escapeHtml(resource.resourceId)}</h2><span class="badge">audio</span></div><p>${escapeHtml(resource.name)}</p><p class="hash">${escapeHtml(resource.sha256 ?? "hash unavailable")}</p></div>${source ? `<audio controls preload="none" src="${source}"></audio>` : "<span>Preview unavailable</span>"}<div class="review-controls"><label>Decision <select class="decision"><option value="pending" selected>pending</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="needs-edit">needs-edit</option></select></label><label>Notes <textarea class="notes" rows="2" placeholder="Optional review note"></textarea></label></div></article>`;
  };
  const packetData = JSON.stringify({
    schemaVersion: 1,
    packet: "draft.json",
    generatedAt,
    source: draft.source,
    resources: resources.map((resource) => ({ resourceId: resource.resourceId, kind: "asset", mediaType: resource.mediaType, sha256: resource.sha256 })),
  }).replaceAll("</", "<\\/");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G4 review packet</title>
<style>body{margin:0;background:#10131a;color:#e8edf4;font:15px/1.45 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:28px}h1{letter-spacing:.03em}h2{font-size:16px;margin:.2rem 0}.notice{border:1px solid #b77d3b;background:#251b12;padding:14px;border-radius:8px}.toolbar{position:sticky;top:0;z-index:2;background:#10131a;padding:12px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.toolbar button,.toolbar select{background:#202b3b;color:#e8edf4;border:1px solid #485b75;border-radius:6px;padding:8px 10px}.toolbar .count{margin-left:auto;font-weight:700;color:#9ee6b3}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}.card,.audio-row{background:#181e29;border:1px solid #2b3546;border-radius:8px;padding:12px}.card img{display:block;width:100%;max-height:360px;object-fit:contain;background:#262d38;margin:10px 0}.sprite-preview{width:min(var(--frame-width),100%);height:min(var(--frame-height),360px);max-width:100%;background-color:#262d38;background-repeat:no-repeat;background-size:calc(var(--frame-width) * var(--frames)) var(--frame-height);image-rendering:auto;animation:frames var(--duration) steps(var(--frames)) infinite;margin:10px auto}@keyframes frames{from{background-position:0 0}to{background-position:calc(-1 * var(--frame-width) * var(--frames)) 0}}.hash{font:11px ui-monospace,monospace;color:#9eabc0;word-break:break-all}.meta{font-size:12px;color:#9eabc0}.badge{font-size:11px;border:1px solid #43536a;border-radius:999px;padding:2px 7px;color:#b7c5d8}.card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.review-controls{display:grid;gap:8px;margin-top:10px;border-top:1px solid #2b3546;padding-top:10px}.review-controls label{display:grid;gap:4px;color:#b7c5d8;font-size:12px}.review-controls select,.review-controls textarea{font:inherit;background:#111722;color:#e8edf4;border:1px solid #39475b;border-radius:5px;padding:6px}.audio{display:grid;gap:10px}.audio-row{display:grid;grid-template-columns:minmax(220px,1fr) minmax(240px,1fr) minmax(180px,240px);align-items:center;gap:12px}.audio-row audio{width:100%}.audio-row .review-controls{margin:0;border:0;padding:0}@media(max-width:720px){.audio-row{grid-template-columns:1fr}.toolbar .count{margin-left:0}}</style></head>
<body><main><h1>G4 resource review packet</h1><p>Project: <strong>${escapeHtml(draft.projectId)}</strong> · ${escapeHtml(draft.chapterId ?? "")}</p><div class="notice"><strong>Revisión manual, no canónica:</strong> los ${resources.length} recursos empiezan en pending. Esta página guarda una copia auxiliar local y exporta un checklist; nunca escribe evidencia canónica ni modifica assets. Si cambia un byte, regenerá el packet.</div>
<div class="toolbar"><label>Filter <select id="filter"><option value="all">all</option><option value="pending">pending</option><option value="accepted">accepted</option><option value="rejected">rejected</option><option value="needs-edit">needs-edit</option></select></label><button id="import">Import checklist</button><button id="export">Export checklist</button><input id="file" type="file" accept="application/json" hidden><span class="count" id="count"></span></div>
<h2>Images and spritesheets (${visualResources.length})</h2><section class="grid">${visualResources.map(renderPreview).join("\n")}</section>
<h2>Audio (${audioResources.length})</h2><section class="audio">${audioResources.map(renderAudio).join("\n")}</section>
<p>Technical validation: <strong>${escapeHtml(draft.summary.validation)}</strong>. Read <a href="./review-checklist.md">review-checklist.md</a> for the guarded apply command.</p></main><script type="application/json" id="packet-data">${packetData}</script><script>
(() => { const packet = JSON.parse(document.getElementById('packet-data').textContent); const key = 'rpgcreatorai:g4-review:' + (packet.source?.gameBundle?.sha256 || packet.generatedAt); const allowed = new Set(['pending','accepted','rejected','needs-edit']); const rows = [...document.querySelectorAll('[data-resource-id]')]; const filter = document.getElementById('filter'); const count = document.getElementById('count'); const file = document.getElementById('file'); const read = () => { try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return value && typeof value === 'object' ? value : {}; } catch { return {}; } }; const write = () => { const decisions = {}; rows.forEach(row => { decisions[row.dataset.resourceId] = { decision: row.querySelector('.decision').value, notes: row.querySelector('.notes').value }; }); localStorage.setItem(key, JSON.stringify(decisions)); }; const apply = (input) => { const incoming = input?.decisions; if (!Array.isArray(incoming) || incoming.length !== packet.resources.length) throw new Error('Checklist must contain exactly ' + packet.resources.length + ' decisions.'); const expected = new Map(packet.resources.map(resource => [resource.resourceId, resource])); const seen = new Set(); incoming.forEach(item => { const resource = expected.get(item?.resourceId); if (!resource || seen.has(item.resourceId) || item.sha256 !== resource.sha256 || !allowed.has(item.decision)) throw new Error('Checklist ID, hash, or decision is invalid for ' + (item?.resourceId || 'unknown')); seen.add(item.resourceId); }); if (seen.size !== expected.size) throw new Error('Checklist resources do not match this packet.'); const values = {}; incoming.forEach(item => { values[item.resourceId] = { decision: item.decision, notes: typeof item.notes === 'string' ? item.notes : '' }; }); rows.forEach(row => { const value = values[row.dataset.resourceId]; if (!value) return; row.querySelector('.decision').value = value.decision; row.querySelector('.notes').value = value.notes; }); write(); render(); }; const render = () => { const wanted = filter.value; let reviewed = 0; rows.forEach(row => { const status = row.querySelector('.decision').value; row.dataset.status = status; if (status !== 'pending') reviewed += 1; row.hidden = wanted !== 'all' && wanted !== status; }); count.textContent = reviewed + ' / ' + rows.length + ' reviewed'; }; rows.forEach(row => { row.querySelector('.decision').addEventListener('change', () => { if (row.querySelector('.decision').value === 'needs-edit' && !row.querySelector('.notes').value.trim()) row.querySelector('.notes').value = 'Needs edit: describe the required change.'; write(); render(); }); row.querySelector('.notes').addEventListener('input', write); }); const restored = read(); rows.forEach(row => { const value = restored[row.dataset.resourceId]; if (!value || !allowed.has(value.decision)) return; row.querySelector('.decision').value = value.decision; row.querySelector('.notes').value = value.notes || ''; }); filter.addEventListener('change', render); document.getElementById('import').addEventListener('click', () => file.click()); file.addEventListener('change', () => { const selected = file.files?.[0]; if (!selected) return; const reader = new FileReader(); reader.onload = () => { try { apply(JSON.parse(reader.result)); } catch (error) { alert(error.message); } file.value = ''; }; reader.readAsText(selected); }); document.getElementById('export').addEventListener('click', () => { const data = { schemaVersion: 1, packet: 'draft.json', status: 'pending', generatedAt: packet.generatedAt, decisions: packet.resources.map(resource => { const row = document.querySelector('[data-resource-id="' + CSS.escape(resource.resourceId) + '"]'); return { ...resource, decision: row.querySelector('.decision').value, notes: row.querySelector('.notes').value }; }) }; const blob = new Blob([JSON.stringify(data, null, 2) + '\\n'], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'review-checklist.json'; anchor.click(); URL.revokeObjectURL(url); }); render(); })();
</script></body></html>`;
  fs.writeFileSync(path.join(outputDir, "contact-sheet.html"), html, "utf8");

  console.log(JSON.stringify({
    packet: relativeRepo(repoRoot, path.join(outputDir, "draft.json")),
    preview: relativeRepo(repoRoot, path.join(outputDir, "contact-sheet.html")),
    checklist: relativeRepo(repoRoot, path.join(outputDir, "review-checklist.md")),
    status: draft.status,
    validation: draft.summary.validation,
    assetCount: draft.summary.assetCount,
    visualCount: draft.summary.visualCount,
    audioCount: draft.summary.audioCount,
    blockers: blockers.length,
  }, null, 2));
  if (blockers.length > 0) process.exitCode = 2;
}

try {
  main();
} catch (error) {
  console.error(`G4 review packet failed: ${error.message}`);
  process.exitCode = 1;
}
