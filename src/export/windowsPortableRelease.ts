import {
  isSafeBundlePath,
  normalizeBundlePath,
} from '../runtime-core/gameBundleCompiler';
import { GAME_BUNDLE_SCHEMA_VERSION } from '../runtime-core/contracts';
import { redactSecrets } from '../security/redaction';
import {
  isExternalReference,
  isExternalReferenceField,
  isUnsafePortableMetadataKey,
  validateRuntimeAssetMetadata,
} from '../utils/packageSecurity';
import { isSensitivePortableKey } from '../utils/portableSecrets';

export const WINDOWS_PORTABLE_RELEASE_SCHEMA_VERSION = 1 as const;
export const WINDOWS_PORTABLE_PROVENANCE_SCHEMA_VERSION = 1 as const;
export const WINDOWS_PORTABLE_NATIVE_PROJECT_PATH = 'data/project.json' as const;
export const WINDOWS_PORTABLE_GAME_BUNDLE_PATH = 'data/game-bundle.v1.json' as const;
export const WINDOWS_PORTABLE_PROVENANCE_PATH = 'data/asset-provenance.v1.json' as const;
export const WINDOWS_PORTABLE_RELEASE_CONTRACT_PATH = 'data/game-release.v1.json' as const;
export const WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH = 'data/editor-acceptance-evidence.v1.json' as const;

export const WINDOWS_PORTABLE_CHECK_IDS = [
  'WP-001-contract-schema',
  'WP-002-target-platform',
  'WP-003-game-bundle-schema',
  'WP-004-game-bundle-json',
  'WP-005-compiler-secret-redaction',
  'WP-006-native-project-schema',
  'WP-010-asset-allowlist',
  'WP-011-bundle-assets-allowlisted',
  'WP-012-asset-runtime-compatibility',
  'WP-013-asset-files',
  'WP-014-asset-paths',
  'WP-015-native-data-allowlist',
  'WP-020-provenance-coverage',
  'WP-021-provenance-consistency',
  'WP-022-generated-provenance',
  'WP-030-sensitive-property-names',
  'WP-031-secret-value-patterns',
  'WP-032-external-runtime-references',
  'WP-040-release-file-inventory',
  'WP-041-required-runtime-files',
  'WP-042-windows-path-safety',
  'WP-043-file-integrity',
  'WP-044-forbidden-release-content',
  'WP-045-release-size-limits',
] as const;

export type WindowsPortableCheckId = typeof WINDOWS_PORTABLE_CHECK_IDS[number];
export type WindowsPortableArchitecture = 'x64' | 'arm64';
export type WindowsPortableArtifactKind = 'portable-directory' | 'portable-zip';
export type WindowsPortableFileRole =
  | 'launcher'
  | 'runtime'
  | 'runtime-library'
  | 'native-project'
  | 'native-map'
  | 'native-database'
  | 'game-bundle'
  | 'release-contract'
  | 'asset'
  | 'provenance'
  | 'acceptance-evidence'
  | 'license'
  | 'readme'
  | 'support';
export type WindowsPortableAssetSource = 'local' | 'imported' | 'generated';

export interface WindowsPortableReleaseFileV1 {
  path: string;
  role: WindowsPortableFileRole;
  sizeBytes: number;
  /** Lower-case SHA-256 of the exact bytes placed in the portable tree. */
  sha256: string;
  /** Required only when role is `asset`. */
  assetId?: string;
}

export interface WindowsPortableReleaseManifestV1 {
  schemaVersion: typeof WINDOWS_PORTABLE_RELEASE_SCHEMA_VERSION;
  target: 'windows-portable';
  artifact: {
    kind: WindowsPortableArtifactKind;
    name: string;
    version: string;
    architecture: WindowsPortableArchitecture;
    entryExecutable: string;
    runtimeExecutable: string;
    nativeProjectPath: typeof WINDOWS_PORTABLE_NATIVE_PROJECT_PATH;
    gameBundlePath: typeof WINDOWS_PORTABLE_GAME_BUNDLE_PATH;
    provenancePath: typeof WINDOWS_PORTABLE_PROVENANCE_PATH;
    /** Present only in a strict, human-accepted release export. */
    releaseContractPath?: typeof WINDOWS_PORTABLE_RELEASE_CONTRACT_PATH;
    /** Present only in a strict, human-accepted release export. */
    acceptanceEvidencePath?: typeof WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH;
  };
  /** Exact, exhaustive set of runtime asset ids; order is release-significant. */
  assetAllowlist: string[];
  /**
   * Optional subset of assetAllowlist whose release evidence is technical
   * provenance only. These entries are deliberately not treated as visual
   * approval-gate decisions.
   */
  supplementalAudioAssetAllowlist?: string[];
  /** Optional subset of assetAllowlist containing generated AnimationPackage strips. */
  supplementalAnimationAssetAllowlist?: string[];
  /** Exact ordered set of native JSON files referenced by data/project.json. */
  nativeDataAllowlist: string[];
  /** Exhaustive inventory of the extracted portable tree. */
  files: WindowsPortableReleaseFileV1[];
}

export interface WindowsPortableGeneratedProvenanceV1 {
  providerId: string;
  modelId: string;
  operation: string;
  createdAt: string;
  /** Binds provenance to the exported asset bytes. */
  outputSha256: string;
  /** Optional rich provenance retained from the image-generation session. */
  providerDisplayName?: string;
  modelDisclosure?: string;
  tool?: string;
  generationRecordPath?: string;
  sourceMasterPath?: string;
  promptSha256?: string;
  prompt?: string;
  outputSizeBytes?: number;
  mediaType?: string;
  width?: number;
  height?: number;
  hasAlpha?: boolean;
  referenceImages?: string[];
  identityConsent?: { status: string; basis: string };
  requestId?: string;
  promptHash?: string;
  promptTemplateId?: string;
  promptTemplateVersion?: number;
  sourceAssetIds?: string[];
  consent?: string;
}

export interface WindowsPortableAssetProvenanceEntryV1 {
  assetId: string;
  runtimePath: string;
  source: WindowsPortableAssetSource;
  /** Human-auditable origin, without absolute local paths or raw provider data. */
  origin: string;
  /** User-confirmed redistribution/license note; the exporter makes no legal claim. */
  license: string;
  attribution?: string;
  review?: { state?: string; reviewer?: string; decidedAt?: string };
  generated?: WindowsPortableGeneratedProvenanceV1;
}

/**
 * A non-visual audio sidecar. It has technical byte/provenance evidence and
 * may carry a separate hash-bound human acceptance without satisfying the
 * seven-slot visual approval gate.
 */
export interface WindowsPortableSupplementalAudioProvenanceEntryV1 {
  assetId: string;
  runtimePath: string;
  source: WindowsPortableAssetSource;
  origin: string;
  license: string;
  generation: {
    tool: string;
    script: string;
    algorithm: string;
    seed: string;
    recipe: string;
    sampleRateHz: number;
    outputSha256: string;
    outputSizeBytes: number;
    durationMs: number;
  };
  technicalReview: { state: 'generated-verified'; verificationScript: string };
  humanAcceptance:
    | { state: 'pending'; evidence: 'not-recorded' }
    | { state: 'accepted'; evidence: string; evidenceSha256: string; reviewer: string; reviewedAt: string };
}

/**
 * A generated spritesheet sidecar outside the seven visual approval slots.
 * Technical evidence is explicit; human acceptance is pending until a
 * canonical hash-bound editor evidence file promotes it.
 */
export interface WindowsPortableSupplementalAnimationProvenanceEntryV1 {
  assetId: string;
  runtimePath: string;
  source: 'generated';
  origin: string;
  license: string;
  review?: { state?: string; reviewer?: string; decidedAt?: string };
  generated: WindowsPortableGeneratedProvenanceV1;
  technicalReview: { state: 'generated-verified'; verificationScript: string; qaReport?: string };
  humanAcceptance:
    | { state: 'pending'; evidence: 'not-recorded' }
    | { state: 'accepted'; evidence: string; evidenceSha256: string; reviewer: string; reviewedAt: string };
}

export interface WindowsPortableAssetProvenanceManifestV1 {
  schemaVersion: typeof WINDOWS_PORTABLE_PROVENANCE_SCHEMA_VERSION;
  assets: WindowsPortableAssetProvenanceEntryV1[];
  supplementalAudio?: WindowsPortableSupplementalAudioProvenanceEntryV1[];
  supplementalAnimation?: WindowsPortableSupplementalAnimationProvenanceEntryV1[];
}

export interface WindowsPortableReleaseValidationInput {
  manifest: unknown;
  /** Map of portable path to parsed JSON for project.json and every referenced native shard. */
  nativeData: unknown;
  gameBundle: unknown;
  provenance: unknown;
  /** Warnings returned by the successful GameBundle compiler invocation. */
  compilerWarnings: unknown;
}

export interface WindowsPortableReleaseIssue {
  checkId: WindowsPortableCheckId;
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export interface WindowsPortableReleaseValidationResult {
  ok: boolean;
  errors: WindowsPortableReleaseIssue[];
  warnings: WindowsPortableReleaseIssue[];
}

type JsonRecord = Record<string, unknown>;
type ParsedFile = WindowsPortableReleaseFileV1;
type ParsedBundleAsset = {
  id: string;
  path: string;
  source: WindowsPortableAssetSource;
  kind: string;
};
type ParsedProvenanceEntry = WindowsPortableAssetProvenanceEntryV1 & {
  supplementalAudio?: boolean;
  supplementalAnimation?: boolean;
  technicalOutputSha256?: string;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PORTABLE_ASSET_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const MAX_PORTABLE_JSON_DEPTH = 64;
const MAX_PORTABLE_JSON_NODES = 100_000;
const MAX_PORTABLE_ARRAY_ENTRIES = 50_000;
const MAX_PORTABLE_STRING_LENGTH = 1024 * 1024;
const MAX_RELEASE_FILES = 20_000;
const MAX_RELEASE_ASSETS = 10_000;
const MAX_NATIVE_DATA_FILES = 4_096;
const MAX_NATIVE_PROJECT_BYTES = 16 * 1024 * 1024;
const MAX_NATIVE_SHARD_BYTES = 64 * 1024 * 1024;
const MAX_NATIVE_DATA_BYTES = 512 * 1024 * 1024;
const MAX_RELEASE_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_RELEASE_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_COMPILER_WARNINGS = 10_000;
const FILE_ROLES = new Set<WindowsPortableFileRole>([
  'launcher', 'runtime', 'runtime-library', 'native-project', 'native-map',
  'native-database', 'game-bundle', 'release-contract', 'asset',
  'provenance', 'acceptance-evidence', 'license', 'readme', 'support',
]);
const RUNTIME_DATABASE_KEYS = [
  'items', 'actors', 'classes', 'skills', 'weapons', 'armors', 'states',
  'types', 'terms', 'enemies', 'troops', 'quests', 'shops', 'system',
  'switches', 'variables', 'commonEvents', 'animations', 'tilesets', 'audio',
] as const;
const RUNTIME_DATABASE_KEY_SET = new Set<string>(RUNTIME_DATABASE_KEYS);
const WINDOWS_RESERVED_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const FORBIDDEN_SEGMENTS = new Set([
  '.git', '.github', '.backups', 'node_modules', 'src', 'scripts', 'tests',
  'target', '__pycache__', '.cache', 'provider-credentials', 'runtime-logs', 'saves',
]);
const FORBIDDEN_BASENAMES = new Set([
  '.env', '.env.local', '.env.production', 'credentials.json', 'secrets.json',
  'id_rsa', 'id_ed25519', 'package-lock.json', 'cargo.lock', 'thumbs.db', 'desktop.ini',
]);
const FORBIDDEN_FILE_PATTERN = /(?:\.pdb|\.ilk|\.exp|\.lib|\.obj|\.o|\.a|\.pem|\.key|\.pfx|\.p12|\.ts|\.tsx|\.rs|\.cpp|\.c|\.h|\.py|\.ps1|\.bat|\.cmd|\.js\.map|\.css\.map|\.log|\.tmp|\.bak)$/i;
const EXTRA_SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const LOCAL_PATH_DISCLOSURE = /(?:\b(?:content|file):\/\/|(?:^|\s)[A-Za-z]:[\\/]|\\\\|(?:^|\s)\/(?:data|home|mnt|private|sdcard|storage|tmp|users|var)\/)/i;

function isRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(
  issues: WindowsPortableReleaseIssue[],
  checkId: WindowsPortableCheckId,
  path: string,
  message: string,
  severity: WindowsPortableReleaseIssue['severity'] = 'error',
): void {
  issues.push({ checkId, severity, path, message });
}

function validateKnownKeys(
  value: JsonRecord,
  allowed: readonly string[],
  path: string,
  checkId: WindowsPortableCheckId,
  issues: WindowsPortableReleaseIssue[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) addIssue(issues, checkId, `${path}.${key}`, `Unexpected field "${key}".`);
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim();
}

function validateHumanAcceptance(
  value: unknown,
  path: string,
  issues: WindowsPortableReleaseIssue[],
  label: string,
): void {
  if (!isRecord(value)) {
    addIssue(issues, 'WP-021-provenance-consistency', path, `${label} human acceptance must be an object.`);
    return;
  }
  if (value.state === 'pending' && value.evidence === 'not-recorded') return;
  if (value.state === 'accepted') {
    if (value.evidence !== 'release-input/editor-acceptance-evidence.v1.json') addIssue(issues, 'WP-021-provenance-consistency', `${path}.evidence`, `${label} accepted evidence must point to the canonical editor evidence file.`);
    if (!isNonBlankString(value.evidenceSha256) || !SHA256_PATTERN.test(value.evidenceSha256)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.evidenceSha256`, `${label} accepted evidence must carry a lower-case SHA-256.`);
    if (!isNonBlankString(value.reviewer)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.reviewer`, `${label} accepted evidence must identify a reviewer.`);
    if (!isNonBlankString(value.reviewedAt) || Number.isNaN(Date.parse(value.reviewedAt))) addIssue(issues, 'WP-021-provenance-consistency', `${path}.reviewedAt`, `${label} accepted evidence must carry an ISO timestamp.`);
    return;
  }
  addIssue(issues, 'WP-021-provenance-consistency', path, `${label} human acceptance must be pending/not-recorded or accepted with hash-bound evidence.`);
}

function hasLikelySecret(value: string): boolean {
  return redactSecrets(value) !== value || EXTRA_SECRET_PATTERNS.some(pattern => pattern.test(value));
}

function scanPortableValue(
  value: unknown,
  path: string,
  invalidCheck: WindowsPortableCheckId,
  issues: WindowsPortableReleaseIssue[],
  blockExternalReferences = false,
  state: {
    ancestors: Set<object>;
    nodes: number;
    structuralLimitReported: boolean;
  } = { ancestors: new Set<object>(), nodes: 0, structuralLimitReported: false },
  depth = 0,
): void {
  state.nodes += 1;
  if (depth > MAX_PORTABLE_JSON_DEPTH || state.nodes > MAX_PORTABLE_JSON_NODES) {
    if (!state.structuralLimitReported) {
      addIssue(issues, invalidCheck, path, 'Portable JSON exceeds the structural depth or node limit.');
      state.structuralLimitReported = true;
    }
    return;
  }
  if (typeof value === 'string') {
    if (value.length > MAX_PORTABLE_STRING_LENGTH) {
      addIssue(issues, invalidCheck, path, 'Portable JSON string exceeds the one-megabyte limit.');
    }
    if (hasLikelySecret(value)) {
      addIssue(issues, 'WP-031-secret-value-patterns', path, 'Likely credential material is forbidden in a release export.');
    }
    return;
  }
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) addIssue(issues, invalidCheck, path, 'Non-finite numbers are not valid portable JSON.');
    return;
  }
  if (typeof value !== 'object') {
    addIssue(issues, invalidCheck, path, `Non-JSON value of type "${typeof value}" is forbidden.`);
    return;
  }
  if (!Array.isArray(value) && !isRecord(value)) {
    addIssue(issues, invalidCheck, path, 'Portable JSON objects must have a plain or null prototype.');
    return;
  }
  if (state.ancestors.has(value)) {
    addIssue(issues, invalidCheck, path, 'Circular values are not valid portable JSON.');
    return;
  }
  state.ancestors.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_PORTABLE_ARRAY_ENTRIES) {
      addIssue(issues, invalidCheck, path, `Portable JSON arrays may contain at most ${MAX_PORTABLE_ARRAY_ENTRIES} entries.`);
    }
    value.slice(0, MAX_PORTABLE_ARRAY_ENTRIES).forEach((entry, index) => {
      scanPortableValue(entry, `${path}[${index}]`, invalidCheck, issues, blockExternalReferences, state, depth + 1);
    });
  } else {
    for (const [key, entry] of Object.entries(value as JsonRecord)) {
      const entryPath = `${path}.${key}`;
      if (isUnsafePortableMetadataKey(key)) {
        addIssue(issues, invalidCheck, entryPath, `Unsafe archive, link, or prototype field "${key}" is forbidden.`);
      }
      if (isSensitivePortableKey(key)) {
        addIssue(issues, 'WP-030-sensitive-property-names', entryPath, `Sensitive field "${key}" is forbidden in a release export.`);
      }
      if (blockExternalReferences && isExternalReferenceField(key) && isExternalReference(entry)) {
        addIssue(issues, 'WP-032-external-runtime-references', entryPath, 'Runtime data cannot load an external or network resource.');
      }
      scanPortableValue(entry, entryPath, invalidCheck, issues, blockExternalReferences, state, depth + 1);
    }
  }
  state.ancestors.delete(value);
}

/** Windows-safe, canonical, project-relative path with no device-name segments. */
export function isSafeWindowsPortablePath(value: string): boolean {
  if (!isSafeBundlePath(value) || normalizeBundlePath(value) !== value) return false;
  return value.split('/').every(segment =>
    segment !== '' && !/[. ]$/.test(segment) && !WINDOWS_RESERVED_NAMES.test(segment),
  );
}

function isUnderAssetRoot(path: string): boolean {
  return path.toLowerCase().startsWith('assets/');
}

function isForbiddenReleasePath(path: string): boolean {
  const segments = path.toLowerCase().split('/');
  const basename = segments.at(-1) ?? '';
  return segments.some(segment => FORBIDDEN_SEGMENTS.has(segment))
    || FORBIDDEN_BASENAMES.has(basename)
    || FORBIDDEN_FILE_PATTERN.test(path);
}

function validateManifest(raw: unknown, issues: WindowsPortableReleaseIssue[]): {
  artifact?: JsonRecord;
  allowlist: string[];
  supplementalAnimationAllowlist: string[];
  supplementalAudioAllowlist: string[];
  nativeDataAllowlist: string[];
  files: ParsedFile[];
} {
  if (!isRecord(raw)) {
    addIssue(issues, 'WP-001-contract-schema', '$.manifest', 'Release manifest must be an object.');
    return { allowlist: [], supplementalAnimationAllowlist: [], supplementalAudioAllowlist: [], nativeDataAllowlist: [], files: [] };
  }
  validateKnownKeys(raw, ['schemaVersion', 'target', 'artifact', 'assetAllowlist', 'supplementalAnimationAssetAllowlist', 'supplementalAudioAssetAllowlist', 'nativeDataAllowlist', 'files'], '$.manifest', 'WP-001-contract-schema', issues);
  if (raw.schemaVersion !== WINDOWS_PORTABLE_RELEASE_SCHEMA_VERSION) {
    addIssue(issues, 'WP-001-contract-schema', '$.manifest.schemaVersion', `Expected release schema ${WINDOWS_PORTABLE_RELEASE_SCHEMA_VERSION}.`);
  }
  if (raw.target !== 'windows-portable') {
    addIssue(issues, 'WP-002-target-platform', '$.manifest.target', 'Target must be "windows-portable".');
  }

  const artifact = isRecord(raw.artifact) ? raw.artifact : undefined;
  if (!artifact) {
    addIssue(issues, 'WP-001-contract-schema', '$.manifest.artifact', 'Artifact metadata must be an object.');
  } else {
    validateKnownKeys(artifact, ['kind', 'name', 'version', 'architecture', 'entryExecutable', 'runtimeExecutable', 'nativeProjectPath', 'gameBundlePath', 'provenancePath', 'releaseContractPath', 'acceptanceEvidencePath'], '$.manifest.artifact', 'WP-001-contract-schema', issues);
    if (artifact.kind !== 'portable-directory' && artifact.kind !== 'portable-zip') {
      addIssue(issues, 'WP-002-target-platform', '$.manifest.artifact.kind', 'Artifact kind must be portable-directory or portable-zip.');
    }
    if (!isNonBlankString(artifact.name)) addIssue(issues, 'WP-001-contract-schema', '$.manifest.artifact.name', 'Artifact name is required.');
    if (!isNonBlankString(artifact.version) || !SEMVER_PATTERN.test(artifact.version)) addIssue(issues, 'WP-001-contract-schema', '$.manifest.artifact.version', 'Artifact version must be semantic version text.');
    if (artifact.architecture !== 'x64' && artifact.architecture !== 'arm64') addIssue(issues, 'WP-002-target-platform', '$.manifest.artifact.architecture', 'Windows architecture must be x64 or arm64.');
    for (const key of ['entryExecutable', 'runtimeExecutable', 'nativeProjectPath', 'gameBundlePath', 'provenancePath'] as const) {
      const value = artifact[key];
      if (!isNonBlankString(value) || !isSafeWindowsPortablePath(value)) {
        addIssue(issues, 'WP-042-windows-path-safety', `$.manifest.artifact.${key}`, 'Expected a canonical Windows-safe relative path.');
      }
    }
    if (artifact.acceptanceEvidencePath !== undefined &&
        (!isNonBlankString(artifact.acceptanceEvidencePath) || !isSafeWindowsPortablePath(artifact.acceptanceEvidencePath))) {
      addIssue(issues, 'WP-042-windows-path-safety', '$.manifest.artifact.acceptanceEvidencePath', 'Expected a canonical Windows-safe relative path when acceptance evidence is declared.');
    }
    if (artifact.releaseContractPath !== undefined &&
        (!isNonBlankString(artifact.releaseContractPath) || !isSafeWindowsPortablePath(artifact.releaseContractPath))) {
      addIssue(issues, 'WP-042-windows-path-safety', '$.manifest.artifact.releaseContractPath', 'Expected a canonical Windows-safe relative path when the release contract is declared.');
    }
    if (isNonBlankString(artifact.entryExecutable) && !artifact.entryExecutable.toLowerCase().endsWith('.exe')) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.entryExecutable', 'Portable launcher must be an .exe.');
    if (isNonBlankString(artifact.runtimeExecutable) && !artifact.runtimeExecutable.toLowerCase().endsWith('.exe')) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.runtimeExecutable', 'Native runtime must be an .exe.');
    if (artifact.nativeProjectPath !== WINDOWS_PORTABLE_NATIVE_PROJECT_PATH) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.nativeProjectPath', `Canonical native project path is ${WINDOWS_PORTABLE_NATIVE_PROJECT_PATH}.`);
    if (artifact.gameBundlePath !== WINDOWS_PORTABLE_GAME_BUNDLE_PATH) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.gameBundlePath', `Canonical GameBundle path is ${WINDOWS_PORTABLE_GAME_BUNDLE_PATH}.`);
    if (artifact.provenancePath !== WINDOWS_PORTABLE_PROVENANCE_PATH) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.provenancePath', `Canonical provenance path is ${WINDOWS_PORTABLE_PROVENANCE_PATH}.`);
    if (artifact.releaseContractPath !== undefined && artifact.releaseContractPath !== WINDOWS_PORTABLE_RELEASE_CONTRACT_PATH) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.releaseContractPath', `Canonical release contract path is ${WINDOWS_PORTABLE_RELEASE_CONTRACT_PATH}.`);
    if (artifact.acceptanceEvidencePath !== undefined && artifact.acceptanceEvidencePath !== WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact.acceptanceEvidencePath', `Canonical acceptance evidence path is ${WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH}.`);
    if (isNonBlankString(artifact.entryExecutable) && isNonBlankString(artifact.runtimeExecutable)) {
      const parent = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')).toLowerCase() : '';
      if (parent(artifact.entryExecutable) !== parent(artifact.runtimeExecutable)) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.artifact', 'Launcher and native runtime must be colocated.');
    }
  }

  const allowlist: string[] = [];
  const seenIds = new Set<string>();
  if (!Array.isArray(raw.assetAllowlist)) {
    addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.assetAllowlist', 'Asset allowlist must be an array.');
  } else {
    if (raw.assetAllowlist.length > MAX_RELEASE_ASSETS) {
      addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.assetAllowlist', `Asset allowlist may contain at most ${MAX_RELEASE_ASSETS} entries.`);
    }
    raw.assetAllowlist.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
      const path = `$.manifest.assetAllowlist[${index}]`;
      if (!isNonBlankString(entry)) return addIssue(issues, 'WP-010-asset-allowlist', path, 'Asset id must be non-blank canonical text.');
      if (!PORTABLE_ASSET_ID_PATTERN.test(entry)) {
        addIssue(issues, 'WP-010-asset-allowlist', path, 'Asset id must be a portable identifier of at most 128 characters.');
      }
      const key = entry.toLowerCase();
      if (seenIds.has(key)) addIssue(issues, 'WP-010-asset-allowlist', path, `Duplicate asset id "${entry}".`);
      else { seenIds.add(key); allowlist.push(entry); }
    });
  }

  const supplementalAnimationAllowlist: string[] = [];
  const supplementalAnimationSeen = new Set<string>();
  if (raw.supplementalAnimationAssetAllowlist !== undefined) {
    if (!Array.isArray(raw.supplementalAnimationAssetAllowlist)) {
      addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.supplementalAnimationAssetAllowlist', 'Supplemental animation allowlist must be an array when present.');
    } else {
      if (raw.supplementalAnimationAssetAllowlist.length > MAX_RELEASE_ASSETS) {
        addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.supplementalAnimationAssetAllowlist', `Supplemental animation allowlist may contain at most ${MAX_RELEASE_ASSETS} entries.`);
      }
      raw.supplementalAnimationAssetAllowlist.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
        const path = `$.manifest.supplementalAnimationAssetAllowlist[${index}]`;
        if (!isNonBlankString(entry) || !PORTABLE_ASSET_ID_PATTERN.test(entry)) {
          return addIssue(issues, 'WP-010-asset-allowlist', path, 'Supplemental animation asset id must be a portable identifier of at most 128 characters.');
        }
        const key = entry.toLowerCase();
        if (supplementalAnimationSeen.has(key)) addIssue(issues, 'WP-010-asset-allowlist', path, `Duplicate supplemental animation asset id "${entry}".`);
        else if (!seenIds.has(key)) addIssue(issues, 'WP-010-asset-allowlist', path, `Supplemental animation asset "${entry}" must also occur in assetAllowlist.`);
        else { supplementalAnimationSeen.add(key); supplementalAnimationAllowlist.push(entry); }
      });
    }
  }

  const supplementalAudioAllowlist: string[] = [];
  const supplementalSeen = new Set<string>();
  if (raw.supplementalAudioAssetAllowlist !== undefined) {
    if (!Array.isArray(raw.supplementalAudioAssetAllowlist)) {
      addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.supplementalAudioAssetAllowlist', 'Supplemental audio allowlist must be an array when present.');
    } else {
      if (raw.supplementalAudioAssetAllowlist.length > MAX_RELEASE_ASSETS) {
        addIssue(issues, 'WP-010-asset-allowlist', '$.manifest.supplementalAudioAssetAllowlist', `Supplemental audio allowlist may contain at most ${MAX_RELEASE_ASSETS} entries.`);
      }
      raw.supplementalAudioAssetAllowlist.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
        const path = `$.manifest.supplementalAudioAssetAllowlist[${index}]`;
        if (!isNonBlankString(entry) || !PORTABLE_ASSET_ID_PATTERN.test(entry)) {
          return addIssue(issues, 'WP-010-asset-allowlist', path, 'Supplemental audio asset id must be a portable identifier of at most 128 characters.');
        }
        const key = entry.toLowerCase();
        if (supplementalSeen.has(key)) addIssue(issues, 'WP-010-asset-allowlist', path, `Duplicate supplemental audio asset id "${entry}".`);
        else if (!seenIds.has(key)) addIssue(issues, 'WP-010-asset-allowlist', path, `Supplemental audio asset "${entry}" must also occur in assetAllowlist.`);
        else { supplementalSeen.add(key); supplementalAudioAllowlist.push(entry); }
      });
    }
  }

  const nativeDataAllowlist: string[] = [];
  const seenNativePaths = new Set<string>();
  if (!Array.isArray(raw.nativeDataAllowlist)) {
    addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.nativeDataAllowlist', 'Native data allowlist must be an array.');
  } else {
    if (raw.nativeDataAllowlist.length > MAX_NATIVE_DATA_FILES) {
      addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.nativeDataAllowlist', `Native data allowlist may contain at most ${MAX_NATIVE_DATA_FILES} entries.`);
    }
    raw.nativeDataAllowlist.slice(0, MAX_NATIVE_DATA_FILES).forEach((entry, index) => {
      const path = `$.manifest.nativeDataAllowlist[${index}]`;
      if (!isNonBlankString(entry) || !isSafeWindowsPortablePath(entry)) {
        return addIssue(issues, 'WP-015-native-data-allowlist', path, 'Native data path must be canonical and Windows-safe.');
      }
      const key = entry.toLowerCase();
      if (seenNativePaths.has(key)) addIssue(issues, 'WP-015-native-data-allowlist', path, `Duplicate native data path "${entry}".`);
      else { seenNativePaths.add(key); nativeDataAllowlist.push(entry); }
    });
  }

  const files: ParsedFile[] = [];
  const seenPaths = new Set<string>();
  const safePathSpelling = new Map<string, string>();
  let totalReleaseBytes = 0;
  if (!Array.isArray(raw.files)) {
    addIssue(issues, 'WP-040-release-file-inventory', '$.manifest.files', 'Release file inventory must be an array.');
  } else {
    if (raw.files.length > MAX_RELEASE_FILES) {
      addIssue(issues, 'WP-045-release-size-limits', '$.manifest.files', `Portable releases may contain at most ${MAX_RELEASE_FILES} files.`);
    }
    raw.files.slice(0, MAX_RELEASE_FILES).forEach((entry, index) => {
      const path = `$.manifest.files[${index}]`;
      if (!isRecord(entry)) return addIssue(issues, 'WP-040-release-file-inventory', path, 'File entry must be an object.');
      validateKnownKeys(entry, ['path', 'role', 'sizeBytes', 'sha256', 'assetId'], path, 'WP-040-release-file-inventory', issues);
      if (!isNonBlankString(entry.path) || !isSafeWindowsPortablePath(entry.path)) addIssue(issues, 'WP-042-windows-path-safety', `${path}.path`, 'File path must be canonical and Windows-safe.');
      else {
        const key = entry.path.toLowerCase();
        if (seenPaths.has(key)) addIssue(issues, 'WP-040-release-file-inventory', `${path}.path`, `Duplicate case-insensitive file path "${entry.path}".`);
        seenPaths.add(key);
        safePathSpelling.set(key, entry.path);
        if (isForbiddenReleasePath(entry.path)) addIssue(issues, 'WP-044-forbidden-release-content', `${path}.path`, `Forbidden source, debug, credential, cache, or temporary file "${entry.path}".`);
      }
      if (typeof entry.role !== 'string' || !FILE_ROLES.has(entry.role as WindowsPortableFileRole)) addIssue(issues, 'WP-040-release-file-inventory', `${path}.role`, 'Unknown release file role.');
      if (!Number.isSafeInteger(entry.sizeBytes) || (entry.sizeBytes as number) <= 0) addIssue(issues, 'WP-043-file-integrity', `${path}.sizeBytes`, 'File size must be a positive safe integer.');
      else {
        totalReleaseBytes += entry.sizeBytes as number;
        if ((entry.sizeBytes as number) > MAX_RELEASE_FILE_BYTES) {
          addIssue(issues, 'WP-045-release-size-limits', `${path}.sizeBytes`, 'A portable release file may not exceed two gigabytes.');
        }
      }
      if (typeof entry.sha256 !== 'string' || !SHA256_PATTERN.test(entry.sha256)) addIssue(issues, 'WP-043-file-integrity', `${path}.sha256`, 'File hash must be lower-case SHA-256.');
      if (entry.role === 'asset') {
        if (!isNonBlankString(entry.assetId)) addIssue(issues, 'WP-013-asset-files', `${path}.assetId`, 'Asset files require an assetId.');
        else if (!PORTABLE_ASSET_ID_PATTERN.test(entry.assetId)) addIssue(issues, 'WP-013-asset-files', `${path}.assetId`, 'Asset file id is not portable.');
        if (isNonBlankString(entry.path) && !isUnderAssetRoot(entry.path)) addIssue(issues, 'WP-014-asset-paths', `${path}.path`, 'Asset files must be below assets/.');
      } else if (entry.assetId !== undefined) addIssue(issues, 'WP-013-asset-files', `${path}.assetId`, 'Only asset files may declare assetId.');
      if (isNonBlankString(entry.path) && isUnderAssetRoot(entry.path) && entry.role !== 'asset') addIssue(issues, 'WP-013-asset-files', `${path}.role`, 'Every file below assets/ must be an allowlisted asset file.');
      if (isNonBlankString(entry.path) && typeof entry.role === 'string' && Number.isSafeInteger(entry.sizeBytes) && typeof entry.sha256 === 'string') {
        files.push(entry as unknown as ParsedFile);
      }
    });
    if (totalReleaseBytes > MAX_RELEASE_TOTAL_BYTES) {
      addIssue(issues, 'WP-045-release-size-limits', '$.manifest.files', 'Portable release inventory exceeds eight gigabytes.');
    }
    for (const [canonicalPath, originalPath] of safePathSpelling) {
      const segments = canonicalPath.split('/');
      for (let index = 1; index < segments.length; index += 1) {
        const ancestor = segments.slice(0, index).join('/');
        if (safePathSpelling.has(ancestor)) {
          addIssue(issues, 'WP-040-release-file-inventory', '$.manifest.files', `File "${safePathSpelling.get(ancestor)}" cannot also contain descendant "${originalPath}".`);
          break;
        }
      }
    }
  }
  return { artifact, allowlist, supplementalAnimationAllowlist, supplementalAudioAllowlist, nativeDataAllowlist, files };
}

interface ParsedNativeData {
  expectedPaths: string[];
  rolesByPath: Map<string, WindowsPortableFileRole>;
}

function isCanonicalNativeJsonPath(value: unknown, prefix: 'data/maps/' | 'data/database/'): value is string {
  return isNonBlankString(value)
    && isSafeWindowsPortablePath(value)
    && value.startsWith(prefix)
    && value.endsWith('.json');
}

function validateNativeData(raw: unknown, issues: WindowsPortableReleaseIssue[]): ParsedNativeData {
  // Keep this collection mutable: map/database references are discovered from
  // the canonical project document below, so the inferred literal tuple type
  // would otherwise reject valid native shard paths.
  const expectedPaths: string[] = [WINDOWS_PORTABLE_NATIVE_PROJECT_PATH];
  const rolesByPath = new Map<string, WindowsPortableFileRole>([
    [WINDOWS_PORTABLE_NATIVE_PROJECT_PATH, 'native-project'],
  ]);
  if (!isRecord(raw)) {
    addIssue(issues, 'WP-006-native-project-schema', '$.nativeData', 'Native data must map canonical release paths to parsed JSON documents.');
    return { expectedPaths, rolesByPath };
  }
  if (Object.keys(raw).length > MAX_NATIVE_DATA_FILES) {
    addIssue(issues, 'WP-015-native-data-allowlist', '$.nativeData', `Native data may contain at most ${MAX_NATIVE_DATA_FILES} JSON files.`);
  }

  const project = raw[WINDOWS_PORTABLE_NATIVE_PROJECT_PATH];
  if (!isRecord(project)) {
    addIssue(issues, 'WP-006-native-project-schema', `$.nativeData["${WINDOWS_PORTABLE_NATIVE_PROJECT_PATH}"]`, 'Canonical native project JSON is required.');
    return { expectedPaths, rolesByPath };
  }
  validateKnownKeys(
    project,
    ['schemaVersion', 'title', 'startMapId', 'startPosition', 'maps', 'database', 'assetCatalog', 'visualProfile', 'generationHistory'],
    `$.nativeData["${WINDOWS_PORTABLE_NATIVE_PROJECT_PATH}"]`,
    'WP-006-native-project-schema',
    issues,
  );
  if (project.schemaVersion !== 1) addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].schemaVersion', 'Native project schemaVersion must be 1.');
  if (!isNonBlankString(project.title)) addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].title', 'Native project title is required.');
  if (!isNonBlankString(project.startMapId)) addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].startMapId', 'Native project startMapId is required.');
  if (!isRecord(project.startPosition)) addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].startPosition', 'Native project startPosition must be an object.');

  const seenPaths = new Set<string>([WINDOWS_PORTABLE_NATIVE_PROJECT_PATH]);
  const mapIds = new Set<string>();
  if (!Array.isArray(project.maps) || project.maps.length === 0) {
    addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].maps', 'Native project maps must be a non-empty array.');
  } else {
    if (project.maps.length >= MAX_NATIVE_DATA_FILES) {
      addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].maps', `Native project may reference fewer than ${MAX_NATIVE_DATA_FILES} maps.`);
    }
    project.maps.slice(0, MAX_NATIVE_DATA_FILES).forEach((mapReference, index) => {
      const path = `$.nativeData["data/project.json"].maps[${index}]`;
      if (!isRecord(mapReference)) return addIssue(issues, 'WP-006-native-project-schema', path, 'Map reference must be an object.');
      validateKnownKeys(mapReference, ['id', 'path', 'parentId', 'order', 'expanded'], path, 'WP-006-native-project-schema', issues);
      if (!isNonBlankString(mapReference.id) || !PORTABLE_ASSET_ID_PATTERN.test(mapReference.id)) {
        addIssue(issues, 'WP-006-native-project-schema', `${path}.id`, 'Map id must be a portable identifier of at most 128 characters.');
      } else if (mapIds.has(mapReference.id.toLowerCase())) {
        addIssue(issues, 'WP-006-native-project-schema', `${path}.id`, `Duplicate map id "${mapReference.id}".`);
      } else mapIds.add(mapReference.id.toLowerCase());

      if (!isCanonicalNativeJsonPath(mapReference.path, 'data/maps/')) {
        addIssue(issues, 'WP-015-native-data-allowlist', `${path}.path`, 'Map path must be a canonical JSON file below data/maps/.');
      } else {
        const canonical = mapReference.path.toLowerCase();
        if (seenPaths.has(canonical)) addIssue(issues, 'WP-015-native-data-allowlist', `${path}.path`, `Duplicate native data path "${mapReference.path}".`);
        else {
          seenPaths.add(canonical);
          expectedPaths.push(mapReference.path);
          rolesByPath.set(mapReference.path, 'native-map');
        }
      }
    });
  }
  if (isNonBlankString(project.startMapId) && !mapIds.has(project.startMapId.toLowerCase())) {
    addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].startMapId', 'startMapId must identify one declared map.');
  }

  if (!isRecord(project.database)) {
    addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].database', 'Native project database must be an object.');
  } else {
    for (const key of Object.keys(project.database)) {
      if (!RUNTIME_DATABASE_KEY_SET.has(key)) addIssue(issues, 'WP-006-native-project-schema', `$.nativeData["data/project.json"].database.${key}`, `Database key "${key}" is unknown to the native runtime.`);
    }
    if (!Object.hasOwn(project.database, 'items')) {
      addIssue(issues, 'WP-006-native-project-schema', '$.nativeData["data/project.json"].database.items', 'Native runtime requires database.items.');
    }
    for (const key of RUNTIME_DATABASE_KEYS) {
      if (!Object.hasOwn(project.database, key)) continue;
      const value = project.database[key];
      const path = `$.nativeData["data/project.json"].database.${key}`;
      if (!isCanonicalNativeJsonPath(value, 'data/database/')) {
        addIssue(issues, 'WP-015-native-data-allowlist', path, 'Database path must be a canonical JSON file below data/database/.');
      } else {
        const canonical = value.toLowerCase();
        if (seenPaths.has(canonical)) addIssue(issues, 'WP-015-native-data-allowlist', path, `Duplicate native data path "${value}".`);
        else {
          seenPaths.add(canonical);
          expectedPaths.push(value);
          rolesByPath.set(value, 'native-database');
        }
      }
    }
  }

  if (expectedPaths.length > MAX_NATIVE_DATA_FILES) {
    addIssue(issues, 'WP-015-native-data-allowlist', '$.nativeData', `Native project references more than ${MAX_NATIVE_DATA_FILES} JSON files.`);
  }
  const expectedSet = new Set(expectedPaths);
  for (const path of expectedPaths) {
    if (!Object.hasOwn(raw, path)) addIssue(issues, 'WP-015-native-data-allowlist', '$.nativeData', `Referenced native JSON file "${path}" is missing from validation input.`);
    else if (!isRecord(raw[path])) addIssue(issues, 'WP-006-native-project-schema', `$.nativeData["${path}"]`, 'Native map and database shards must be JSON objects.');
  }
  for (const path of Object.keys(raw)) {
    if (!isSafeWindowsPortablePath(path) || !expectedSet.has(path)) {
      addIssue(issues, 'WP-015-native-data-allowlist', `$.nativeData["${path}"]`, 'Native JSON input is not referenced by the canonical native project allowlist.');
    }
  }
  return { expectedPaths, rolesByPath };
}

function validateGameBundle(raw: unknown, issues: WindowsPortableReleaseIssue[]): ParsedBundleAsset[] {
  if (!isRecord(raw)) {
    addIssue(issues, 'WP-003-game-bundle-schema', '$.gameBundle', 'GameBundle must be an object.');
    return [];
  }
  validateKnownKeys(raw, ['schemaVersion', 'project', 'maps', 'items', 'databases', 'assets', 'dialogue'], '$.gameBundle', 'WP-003-game-bundle-schema', issues);
  if (raw.schemaVersion !== GAME_BUNDLE_SCHEMA_VERSION) addIssue(issues, 'WP-003-game-bundle-schema', '$.gameBundle.schemaVersion', `Expected GameBundle schema ${GAME_BUNDLE_SCHEMA_VERSION}.`);
  for (const key of ['project', 'maps', 'items', 'databases'] as const) {
    if (!isRecord(raw[key])) addIssue(issues, 'WP-003-game-bundle-schema', `$.gameBundle.${key}`, `${key} must be an object.`);
  }
  if (raw.assets === undefined) return [];
  if (!isRecord(raw.assets) || !Array.isArray(raw.assets.assets)) {
    addIssue(issues, 'WP-003-game-bundle-schema', '$.gameBundle.assets', 'GameBundle assets must be a versioned catalog.');
    return [];
  }
  validateKnownKeys(raw.assets, ['schemaVersion', 'assets'], '$.gameBundle.assets', 'WP-003-game-bundle-schema', issues);
  if (raw.assets.schemaVersion !== 1) addIssue(issues, 'WP-003-game-bundle-schema', '$.gameBundle.assets.schemaVersion', 'Asset catalog schema must be 1.');
  const assets: ParsedBundleAsset[] = [];
  const seen = new Set<string>();
  if (raw.assets.assets.length > MAX_RELEASE_ASSETS) {
    addIssue(issues, 'WP-003-game-bundle-schema', '$.gameBundle.assets.assets', `GameBundle may contain at most ${MAX_RELEASE_ASSETS} runtime assets.`);
  }
  raw.assets.assets.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
    const path = `$.gameBundle.assets.assets[${index}]`;
    if (!isRecord(entry)) return addIssue(issues, 'WP-003-game-bundle-schema', path, 'Bundle asset must be an object.');
    validateKnownKeys(entry, ['id', 'name', 'kind', 'path', 'source', 'runtimeCompatible', 'width', 'height', 'frameWidth', 'frameHeight', 'frames', 'durationMs'], path, 'WP-003-game-bundle-schema', issues);
    for (const issue of validateRuntimeAssetMetadata(entry, path, ['assets'])) {
      const checkId: WindowsPortableCheckId = issue.code === 'secret-metadata'
        ? 'WP-030-sensitive-property-names'
        : issue.code === 'external-reference'
          ? 'WP-032-external-runtime-references'
          : issue.code === 'unsafe-path'
            ? 'WP-014-asset-paths'
            : 'WP-003-game-bundle-schema';
      addIssue(issues, checkId, issue.path, issue.message);
    }
    if (!isNonBlankString(entry.id)) return addIssue(issues, 'WP-003-game-bundle-schema', `${path}.id`, 'Bundle asset id is required.');
    if (seen.has(entry.id.toLowerCase())) addIssue(issues, 'WP-003-game-bundle-schema', `${path}.id`, `Duplicate bundle asset id "${entry.id}".`);
    seen.add(entry.id.toLowerCase());
    if (!isNonBlankString(entry.path) || !isSafeWindowsPortablePath(entry.path) || !isUnderAssetRoot(entry.path)) addIssue(issues, 'WP-014-asset-paths', `${path}.path`, 'Bundle asset path must be canonical, Windows-safe, and below assets/.');
    if (entry.source !== 'local' && entry.source !== 'imported' && entry.source !== 'generated') addIssue(issues, 'WP-003-game-bundle-schema', `${path}.source`, 'Bundle asset source is invalid.');
    if (entry.runtimeCompatible !== true) addIssue(issues, 'WP-012-asset-runtime-compatibility', `${path}.runtimeCompatible`, `Asset "${entry.id}" is not runtime compatible.`);
    if (isNonBlankString(entry.path) && (entry.source === 'local' || entry.source === 'imported' || entry.source === 'generated')) {
      assets.push({
        id: entry.id,
        path: entry.path,
        source: entry.source,
        kind: typeof entry.kind === 'string' ? entry.kind : '',
      });
    }
  });
  return assets;
}

function validateProvenance(raw: unknown, issues: WindowsPortableReleaseIssue[]): ParsedProvenanceEntry[] {
  if (!isRecord(raw) || !Array.isArray(raw.assets)) {
    addIssue(issues, 'WP-020-provenance-coverage', '$.provenance', 'Provenance must be a versioned asset manifest.');
    return [];
  }
  validateKnownKeys(raw, ['schemaVersion', 'assets', 'supplementalAnimation', 'supplementalAudio'], '$.provenance', 'WP-020-provenance-coverage', issues);
  if (raw.schemaVersion !== WINDOWS_PORTABLE_PROVENANCE_SCHEMA_VERSION) addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.schemaVersion', `Expected provenance schema ${WINDOWS_PORTABLE_PROVENANCE_SCHEMA_VERSION}.`);
  const parsed: ParsedProvenanceEntry[] = [];
  const seen = new Set<string>();
  if (raw.assets.length > MAX_RELEASE_ASSETS) {
    addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.assets', `Provenance may contain at most ${MAX_RELEASE_ASSETS} assets.`);
  }
  raw.assets.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
    const path = `$.provenance.assets[${index}]`;
    if (!isRecord(entry)) return addIssue(issues, 'WP-020-provenance-coverage', path, 'Provenance entry must be an object.');
    validateKnownKeys(entry, ['assetId', 'runtimePath', 'source', 'origin', 'license', 'attribution', 'review', 'generated'], path, 'WP-020-provenance-coverage', issues);
    if (!isNonBlankString(entry.assetId)) return addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, 'Provenance assetId is required.');
    if (seen.has(entry.assetId.toLowerCase())) addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, `Duplicate provenance for "${entry.assetId}".`);
    seen.add(entry.assetId.toLowerCase());
    if (!isNonBlankString(entry.runtimePath) || !isSafeWindowsPortablePath(entry.runtimePath) || !isUnderAssetRoot(entry.runtimePath)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.runtimePath`, 'Provenance runtimePath must identify a portable asset path.');
    if (entry.source !== 'local' && entry.source !== 'imported' && entry.source !== 'generated') addIssue(issues, 'WP-021-provenance-consistency', `${path}.source`, 'Provenance source is invalid.');
    if (!isNonBlankString(entry.origin)) addIssue(issues, 'WP-020-provenance-coverage', `${path}.origin`, 'Auditable origin is required.');
    else if (LOCAL_PATH_DISCLOSURE.test(entry.origin)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.origin`, 'Provenance must not disclose an absolute local path or content/file URI.');
    if (!isNonBlankString(entry.license)) addIssue(issues, 'WP-020-provenance-coverage', `${path}.license`, 'A user-confirmed license/redistribution note is required.');
    else if (LOCAL_PATH_DISCLOSURE.test(entry.license)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.license`, 'License notes must not disclose an absolute local path or content/file URI.');
    if (entry.attribution !== undefined && !isNonBlankString(entry.attribution)) addIssue(issues, 'WP-020-provenance-coverage', `${path}.attribution`, 'Attribution, when present, must be non-blank.');
    else if (typeof entry.attribution === 'string' && LOCAL_PATH_DISCLOSURE.test(entry.attribution)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.attribution`, 'Attribution must not disclose an absolute local path or content/file URI.');
    if (entry.source === 'generated') {
      if (!isRecord(entry.generated)) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated`, 'Generated assets require generation provenance.');
      else {
        validateKnownKeys(entry.generated, ['providerId', 'providerDisplayName', 'modelId', 'modelDisclosure', 'tool', 'operation', 'createdAt', 'generationRecordPath', 'sourceMasterPath', 'builtInArtifactName', 'sourceMaster', 'normalization', 'promptSha256', 'prompt', 'outputSha256', 'outputSizeBytes', 'mediaType', 'width', 'height', 'hasAlpha', 'referenceImages', 'identityConsent', 'requestId', 'promptHash', 'promptTemplateId', 'promptTemplateVersion', 'sourceAssetIds', 'consent'], `${path}.generated`, 'WP-022-generated-provenance', issues);
        for (const key of ['providerId', 'modelId', 'operation', 'createdAt', 'outputSha256'] as const) if (!isNonBlankString(entry.generated[key])) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.${key}`, `${key} is required for generated assets.`);
        if (isNonBlankString(entry.generated.createdAt) && Number.isNaN(Date.parse(entry.generated.createdAt))) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.createdAt`, 'createdAt must be an ISO-compatible timestamp.');
        if (isNonBlankString(entry.generated.outputSha256) && !SHA256_PATTERN.test(entry.generated.outputSha256)) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.outputSha256`, 'Generated output hash must be lower-case SHA-256.');
        if (entry.generated.promptHash !== undefined && (typeof entry.generated.promptHash !== 'string' || !SHA256_PATTERN.test(entry.generated.promptHash))) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.promptHash`, 'Prompt hash must be lower-case SHA-256 when present.');
        if (entry.generated.promptTemplateVersion !== undefined && (!Number.isSafeInteger(entry.generated.promptTemplateVersion) || (entry.generated.promptTemplateVersion as number) <= 0)) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.promptTemplateVersion`, 'Prompt template version must be a positive integer.');
      }
    } else if (entry.generated !== undefined) addIssue(issues, 'WP-021-provenance-consistency', `${path}.generated`, 'Only generated assets may contain generation provenance.');
    parsed.push(entry as unknown as ParsedProvenanceEntry);
  });

  if (raw.supplementalAnimation !== undefined) {
    if (!Array.isArray(raw.supplementalAnimation)) {
      addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.supplementalAnimation', 'Supplemental animation provenance must be an array when present.');
    } else {
      if (raw.supplementalAnimation.length > MAX_RELEASE_ASSETS) addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.supplementalAnimation', `Supplemental animation provenance may contain at most ${MAX_RELEASE_ASSETS} entries.`);
      raw.supplementalAnimation.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
        const path = `$.provenance.supplementalAnimation[${index}]`;
        if (!isRecord(entry)) return addIssue(issues, 'WP-020-provenance-coverage', path, 'Supplemental animation provenance entry must be an object.');
        validateKnownKeys(entry, ['assetId', 'runtimePath', 'source', 'origin', 'license', 'generated', 'review', 'technicalReview', 'humanAcceptance'], path, 'WP-020-provenance-coverage', issues);
        if (!isNonBlankString(entry.assetId)) return addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, 'Supplemental animation assetId is required.');
        if (seen.has(entry.assetId.toLowerCase())) addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, `Duplicate provenance for "${entry.assetId}".`);
        seen.add(entry.assetId.toLowerCase());
        if (!isNonBlankString(entry.runtimePath) || !isSafeWindowsPortablePath(entry.runtimePath) || !isUnderAssetRoot(entry.runtimePath)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.runtimePath`, 'Supplemental animation runtimePath must identify a portable asset path.');
        if (entry.source !== 'generated') addIssue(issues, 'WP-021-provenance-consistency', `${path}.source`, 'Supplemental animation must declare generated source.');
        for (const key of ['origin', 'license'] as const) {
          if (!isNonBlankString(entry[key])) addIssue(issues, 'WP-020-provenance-coverage', `${path}.${key}`, `${key} is required.`);
          else if (LOCAL_PATH_DISCLOSURE.test(entry[key])) addIssue(issues, 'WP-021-provenance-consistency', `${path}.${key}`, `${key} must not disclose an absolute local path or content/file URI.`);
        }
        if (!isRecord(entry.generated)) {
          addIssue(issues, 'WP-022-generated-provenance', `${path}.generated`, 'Supplemental animation requires generated provenance.');
        } else {
          validateKnownKeys(entry.generated, ['providerId', 'providerDisplayName', 'modelId', 'modelDisclosure', 'tool', 'operation', 'createdAt', 'generationRecordPath', 'sourceMasterPath', 'builtInArtifactName', 'sourceMaster', 'normalization', 'promptSha256', 'prompt', 'outputSha256', 'outputSizeBytes', 'mediaType', 'width', 'height', 'hasAlpha', 'referenceImages', 'identityConsent', 'requestId', 'promptHash', 'promptTemplateId', 'promptTemplateVersion', 'sourceAssetIds', 'consent'], `${path}.generated`, 'WP-022-generated-provenance', issues);
          for (const key of ['providerId', 'modelId', 'operation', 'createdAt', 'outputSha256'] as const) if (!isNonBlankString(entry.generated[key])) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.${key}`, `${key} is required for supplemental animation.`);
          if (isNonBlankString(entry.generated.createdAt) && Number.isNaN(Date.parse(entry.generated.createdAt))) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.createdAt`, 'createdAt must be an ISO-compatible timestamp.');
          if (isNonBlankString(entry.generated.outputSha256) && !SHA256_PATTERN.test(entry.generated.outputSha256)) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.outputSha256`, 'Generated output hash must be lower-case SHA-256.');
          if (!Number.isSafeInteger(entry.generated.outputSizeBytes) || (entry.generated.outputSizeBytes as number) <= 0) addIssue(issues, 'WP-022-generated-provenance', `${path}.generated.outputSizeBytes`, 'Generated output size must be a positive integer.');
        }
        if (!isRecord(entry.technicalReview) || entry.technicalReview.state !== 'generated-verified' || !isNonBlankString(entry.technicalReview.verificationScript)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.technicalReview`, 'Supplemental animation requires generated-verified technical review evidence.');
        validateHumanAcceptance(entry.humanAcceptance, `${path}.humanAcceptance`, issues, 'Supplemental animation');
        parsed.push({
          assetId: entry.assetId as string,
          runtimePath: entry.runtimePath as string,
          source: entry.source as WindowsPortableAssetSource,
          origin: entry.origin as string,
          license: entry.license as string,
          review: isRecord(entry.review) ? entry.review as { state?: string; reviewer?: string; decidedAt?: string } : undefined,
          generated: entry.generated as WindowsPortableGeneratedProvenanceV1,
          supplementalAnimation: true,
        });
      });
    }
  }

  if (raw.supplementalAudio !== undefined) {
    if (!Array.isArray(raw.supplementalAudio)) {
      addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.supplementalAudio', 'Supplemental audio provenance must be an array when present.');
    } else {
      if (raw.supplementalAudio.length > MAX_RELEASE_ASSETS) addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.supplementalAudio', `Supplemental audio provenance may contain at most ${MAX_RELEASE_ASSETS} entries.`);
      raw.supplementalAudio.slice(0, MAX_RELEASE_ASSETS).forEach((entry, index) => {
        const path = `$.provenance.supplementalAudio[${index}]`;
        if (!isRecord(entry)) return addIssue(issues, 'WP-020-provenance-coverage', path, 'Supplemental audio provenance entry must be an object.');
        validateKnownKeys(entry, ['assetId', 'runtimePath', 'source', 'origin', 'license', 'generation', 'technicalReview', 'humanAcceptance'], path, 'WP-020-provenance-coverage', issues);
        if (!isNonBlankString(entry.assetId)) return addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, 'Supplemental audio assetId is required.');
        if (seen.has(entry.assetId.toLowerCase())) addIssue(issues, 'WP-020-provenance-coverage', `${path}.assetId`, `Duplicate provenance for "${entry.assetId}".`);
        seen.add(entry.assetId.toLowerCase());
        if (!isNonBlankString(entry.runtimePath) || !isSafeWindowsPortablePath(entry.runtimePath) || !isUnderAssetRoot(entry.runtimePath)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.runtimePath`, 'Supplemental audio runtimePath must identify a portable asset path.');
        if (entry.source !== 'generated') addIssue(issues, 'WP-021-provenance-consistency', `${path}.source`, 'Supplemental audio must declare generated source.');
        for (const key of ['origin', 'license'] as const) {
          if (!isNonBlankString(entry[key])) addIssue(issues, 'WP-020-provenance-coverage', `${path}.${key}`, `${key} is required.`);
          else if (LOCAL_PATH_DISCLOSURE.test(entry[key])) addIssue(issues, 'WP-021-provenance-consistency', `${path}.${key}`, `${key} must not disclose an absolute local path or content/file URI.`);
        }
        if (!isRecord(entry.generation)) {
          addIssue(issues, 'WP-022-generated-provenance', `${path}.generation`, 'Supplemental audio requires deterministic generation provenance.');
        } else {
          validateKnownKeys(entry.generation, ['tool', 'script', 'algorithm', 'seed', 'recipe', 'sampleRateHz', 'outputSha256', 'outputSizeBytes', 'durationMs'], `${path}.generation`, 'WP-022-generated-provenance', issues);
          for (const key of ['tool', 'script', 'algorithm', 'seed', 'recipe', 'outputSha256'] as const) if (!isNonBlankString(entry.generation[key])) addIssue(issues, 'WP-022-generated-provenance', `${path}.generation.${key}`, `${key} is required.`);
          if (isNonBlankString(entry.generation.outputSha256) && !SHA256_PATTERN.test(entry.generation.outputSha256)) addIssue(issues, 'WP-022-generated-provenance', `${path}.generation.outputSha256`, 'Output hash must be lower-case SHA-256.');
          for (const key of ['sampleRateHz', 'outputSizeBytes', 'durationMs'] as const) if (!Number.isSafeInteger(entry.generation[key]) || (entry.generation[key] as number) <= 0) addIssue(issues, 'WP-022-generated-provenance', `${path}.generation.${key}`, `${key} must be a positive integer.`);
        }
        if (!isRecord(entry.technicalReview) || entry.technicalReview.state !== 'generated-verified' || !isNonBlankString(entry.technicalReview.verificationScript)) addIssue(issues, 'WP-021-provenance-consistency', `${path}.technicalReview`, 'Supplemental audio requires generated-verified technical review evidence.');
        validateHumanAcceptance(entry.humanAcceptance, `${path}.humanAcceptance`, issues, 'Supplemental audio');
        parsed.push({
          assetId: entry.assetId as string,
          runtimePath: entry.runtimePath as string,
          source: entry.source as WindowsPortableAssetSource,
          origin: entry.origin as string,
          license: entry.license as string,
          supplementalAudio: true,
          technicalOutputSha256: isRecord(entry.generation) && typeof entry.generation.outputSha256 === 'string' ? entry.generation.outputSha256 : undefined,
        });
      });
    }
  }
  return parsed;
}

/**
 * Pure fail-closed release gate. It performs no filesystem access, no network
 * access, no signing, and never mutates or redacts the candidate in place.
 */
export function validateWindowsPortableRelease(
  input: WindowsPortableReleaseValidationInput,
): WindowsPortableReleaseValidationResult {
  const issues: WindowsPortableReleaseIssue[] = [];
  scanPortableValue(input.manifest, '$.manifest', 'WP-001-contract-schema', issues, true);
  scanPortableValue(input.nativeData, '$.nativeData', 'WP-006-native-project-schema', issues, true);
  scanPortableValue(input.gameBundle, '$.gameBundle', 'WP-004-game-bundle-json', issues, true);
  scanPortableValue(input.provenance, '$.provenance', 'WP-020-provenance-coverage', issues);
  scanPortableValue(input.compilerWarnings, '$.compilerWarnings', 'WP-005-compiler-secret-redaction', issues);

  if (!Array.isArray(input.compilerWarnings)) {
    addIssue(issues, 'WP-005-compiler-secret-redaction', '$.compilerWarnings', 'GameBundle compiler warning evidence is required.');
  } else {
    if (input.compilerWarnings.length > MAX_COMPILER_WARNINGS) {
      addIssue(issues, 'WP-005-compiler-secret-redaction', '$.compilerWarnings', `Compiler evidence may contain at most ${MAX_COMPILER_WARNINGS} warnings.`);
    }
    input.compilerWarnings.slice(0, MAX_COMPILER_WARNINGS).forEach((warning, index) => {
      if (!isRecord(warning) || typeof warning.code !== 'string') {
        addIssue(issues, 'WP-005-compiler-secret-redaction', `$.compilerWarnings[${index}]`, 'Compiler warning evidence contains an invalid entry.');
      } else if (warning.code === 'secret-redacted') {
        addIssue(issues, 'WP-005-compiler-secret-redaction', `$.compilerWarnings[${index}]`, 'Release blocked because compilation had to redact a sensitive field.');
      }
    });
  }

  const { artifact, allowlist, supplementalAnimationAllowlist, supplementalAudioAllowlist, nativeDataAllowlist, files } = validateManifest(input.manifest, issues);
  const nativeData = validateNativeData(input.nativeData, issues);
  const bundleAssets = validateGameBundle(input.gameBundle, issues);
  const provenance = validateProvenance(input.provenance, issues);
  const allowSet = new Set(allowlist);
  const bundleById = new Map(bundleAssets.map(asset => [asset.id, asset]));
  const provenanceById = new Map(provenance.map(entry => [entry.assetId, entry]));
  const assetFiles = files.filter(file => file.role === 'asset');
  const assetFileById = new Map(assetFiles.filter(file => file.assetId).map(file => [file.assetId!, file]));
  const assetFileCounts = new Map<string, number>();
  for (const file of assetFiles) {
    if (!file.assetId) continue;
    assetFileCounts.set(file.assetId, (assetFileCounts.get(file.assetId) ?? 0) + 1);
  }

  const supplementalAudioSet = new Set(supplementalAudioAllowlist);
  const supplementalAnimationSet = new Set(supplementalAnimationAllowlist);
  for (const id of supplementalAnimationAllowlist) {
    const asset = bundleById.get(id);
    if (!asset) continue;
    if (asset.kind !== 'spritesheet') {
      addIssue(issues, 'WP-012-asset-runtime-compatibility', '$.manifest.supplementalAnimationAssetAllowlist', `Supplemental animation asset "${id}" must have GameBundle kind "spritesheet".`);
    }
    const sidecar = provenanceById.get(id);
    if (!sidecar || sidecar.supplementalAnimation !== true) {
      addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.supplementalAnimation', `Supplemental animation asset "${id}" requires technical-only supplementalAnimation provenance.`);
    }
    if (supplementalAudioSet.has(id)) {
      addIssue(issues, 'WP-010-asset-allowlist', '$.manifest', `Asset "${id}" cannot be both supplemental animation and supplemental audio.`);
    }
  }
  for (const id of supplementalAudioAllowlist) {
    const asset = bundleById.get(id);
    if (!asset) continue;
    if (asset.kind !== 'audio') {
      addIssue(issues, 'WP-012-asset-runtime-compatibility', '$.manifest.supplementalAudioAssetAllowlist', `Supplemental asset "${id}" must have GameBundle kind "audio".`);
    }
    const sidecar = provenanceById.get(id);
    if (!sidecar || sidecar.supplementalAudio !== true) {
      addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.assets', `Supplemental audio asset "${id}" requires technical-only supplementalAudio provenance.`);
    }
    if (supplementalAnimationSet.has(id)) {
      addIssue(issues, 'WP-010-asset-allowlist', '$.manifest', `Asset "${id}" cannot be both supplemental audio and supplemental animation.`);
    }
  }

  for (const asset of bundleAssets) if (!allowSet.has(asset.id)) addIssue(issues, 'WP-011-bundle-assets-allowlisted', '$.gameBundle.assets', `Bundle asset "${asset.id}" is not allowlisted.`);
  for (const id of allowlist) {
    const asset = bundleById.get(id);
    if (!asset) addIssue(issues, 'WP-011-bundle-assets-allowlisted', '$.manifest.assetAllowlist', `Allowlisted asset "${id}" is missing from GameBundle.`);
    const file = assetFileById.get(id);
    if (!file) addIssue(issues, 'WP-013-asset-files', '$.manifest.files', `Allowlisted asset "${id}" has no release file.`);
    else if ((assetFileCounts.get(id) ?? 0) !== 1) addIssue(issues, 'WP-013-asset-files', '$.manifest.files', `Allowlisted asset "${id}" must have exactly one release file.`);
    else if (asset && file.path !== asset.path) addIssue(issues, 'WP-013-asset-files', '$.manifest.files', `Asset file path for "${id}" does not match GameBundle.`);
    const sidecar = provenanceById.get(id);
    if (!sidecar) addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.assets', `Allowlisted asset "${id}" has no provenance.`);
    else if (asset) {
      if (sidecar.runtimePath !== asset.path || sidecar.source !== asset.source) addIssue(issues, 'WP-021-provenance-consistency', '$.provenance.assets', `Provenance for "${id}" does not match GameBundle path/source.`);
      if (asset.source === 'generated' && sidecar.generated && file && sidecar.generated.outputSha256 !== file.sha256) addIssue(issues, 'WP-022-generated-provenance', '$.provenance.assets', `Generated provenance hash for "${id}" does not match exported bytes.`);
      if (supplementalAnimationSet.has(id) && sidecar.generated && file && sidecar.generated.outputSizeBytes !== undefined && sidecar.generated.outputSizeBytes !== file.sizeBytes) {
        addIssue(issues, 'WP-022-generated-provenance', '$.provenance.assets', `Supplemental animation output size for "${id}" does not match exported bytes.`);
      }
      if (supplementalAudioSet.has(id) && sidecar.supplementalAudio === true && file && sidecar.technicalOutputSha256 !== file.sha256) {
        addIssue(issues, 'WP-021-provenance-consistency', '$.provenance.assets', `Supplemental audio content hash for "${id}" does not match exported bytes.`);
      }
      if (supplementalAnimationSet.has(id) && sidecar.supplementalAnimation !== true) {
        addIssue(issues, 'WP-021-provenance-consistency', '$.provenance.assets', `Supplemental animation asset "${id}" is missing its technical supplementalAnimation marker.`);
      }
      if (!supplementalAudioSet.has(id) && sidecar.supplementalAudio === true) {
        addIssue(issues, 'WP-021-provenance-consistency', '$.provenance.assets', `Only supplementalAudioAssetAllowlist entries may carry supplementalAudio provenance: "${id}".`);
      }
      if (!supplementalAnimationSet.has(id) && sidecar.supplementalAnimation === true) {
        addIssue(issues, 'WP-021-provenance-consistency', '$.provenance.assets', `Only supplementalAnimationAssetAllowlist entries may carry supplementalAnimation provenance: "${id}".`);
      }
    }
  }
  for (const entry of provenance) if (!allowSet.has(entry.assetId)) addIssue(issues, 'WP-020-provenance-coverage', '$.provenance.assets', `Provenance entry "${entry.assetId}" is not allowlisted.`);
  for (const file of assetFiles) if (!file.assetId || !allowSet.has(file.assetId)) addIssue(issues, 'WP-013-asset-files', '$.manifest.files', `Asset file "${file.path}" is not linked to the allowlist.`);

  for (const file of files) {
    if (file.path === WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH && file.role !== 'acceptance-evidence') {
      addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', `Acceptance evidence file must use role "acceptance-evidence".`);
    }
    if (file.role === 'acceptance-evidence' && file.path !== WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH) {
      addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', `Acceptance evidence role must use canonical path "${WINDOWS_PORTABLE_ACCEPTANCE_EVIDENCE_PATH}".`);
    }
  }

  if (nativeDataAllowlist.length !== nativeData.expectedPaths.length
    || nativeDataAllowlist.some((path, index) => path !== nativeData.expectedPaths[index])) {
    addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.nativeDataAllowlist', 'Native data allowlist must exactly match project.json references in deterministic project/maps/database order.');
  }
  const nativeFiles = files.filter(file => file.role === 'native-project' || file.role === 'native-map' || file.role === 'native-database');
  const nativeFileByPath = new Map(nativeFiles.map(file => [file.path, file]));
  const nativeDataBytes = nativeFiles.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (nativeDataBytes > MAX_NATIVE_DATA_BYTES) {
    addIssue(issues, 'WP-045-release-size-limits', '$.manifest.files', 'Native project data may not exceed 512 megabytes in total.');
  }
  for (const file of nativeFiles) {
    const limit = file.role === 'native-project' ? MAX_NATIVE_PROJECT_BYTES : MAX_NATIVE_SHARD_BYTES;
    if (file.sizeBytes > limit) {
      addIssue(issues, 'WP-045-release-size-limits', '$.manifest.files', `${file.role} file "${file.path}" exceeds its ${limit / (1024 * 1024)}-megabyte limit.`);
    }
  }
  for (const path of nativeData.expectedPaths) {
    const expectedRole = nativeData.rolesByPath.get(path)!;
    const file = nativeFileByPath.get(path);
    if (!file) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', `Missing ${expectedRole} file "${path}".`);
    else if (file.role !== expectedRole) addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.files', `Native data file "${path}" must use role "${expectedRole}".`);
  }
  const expectedNativeSet = new Set(nativeData.expectedPaths);
  for (const file of nativeFiles) {
    if (!expectedNativeSet.has(file.path)) addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.files', `Native data file "${file.path}" is not referenced by data/project.json.`);
  }
  for (const file of files) {
    const isNativeTreePath = file.path === WINDOWS_PORTABLE_NATIVE_PROJECT_PATH
      || file.path.startsWith('data/maps/')
      || file.path.startsWith('data/database/');
    if (isNativeTreePath && !nativeFiles.includes(file)) {
      addIssue(issues, 'WP-015-native-data-allowlist', '$.manifest.files', `Native tree path "${file.path}" has a non-native release role.`);
    }
  }

  if (artifact) {
    const requireFile = (artifactKey: string, role: WindowsPortableFileRole) => {
      const expected = artifact[artifactKey];
      if (typeof expected === 'string' && !files.some(file => file.path === expected && file.role === role)) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', `Missing ${role} file "${expected}".`);
    };
    requireFile('entryExecutable', 'launcher');
    requireFile('runtimeExecutable', 'runtime');
    requireFile('nativeProjectPath', 'native-project');
    requireFile('gameBundlePath', 'game-bundle');
    requireFile('provenancePath', 'provenance');
    if (artifact.releaseContractPath !== undefined) requireFile('releaseContractPath', 'release-contract');
    if (artifact.acceptanceEvidencePath !== undefined) requireFile('acceptanceEvidencePath', 'acceptance-evidence');
  }
  if (!files.some(file => file.role === 'license')) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', 'Portable release requires a license file.');
  if (!files.some(file => file.role === 'readme')) addIssue(issues, 'WP-041-required-runtime-files', '$.manifest.files', 'Portable release requires a readme file.');

  const order = new Map(WINDOWS_PORTABLE_CHECK_IDS.map((id, index) => [id, index]));
  issues.sort((a, b) => (order.get(a.checkId)! - order.get(b.checkId)!) || a.path.localeCompare(b.path) || a.message.localeCompare(b.message));
  const errors = issues.filter(issue => issue.severity === 'error');
  const warnings = issues.filter(issue => issue.severity === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}
