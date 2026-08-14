import { isSensitivePortableKey } from './portableSecrets';

export type PackageSecurityIssueCode =
  | 'external-reference'
  | 'secret-metadata'
  | 'unsafe-archive-entry'
  | 'unsafe-asset-metadata'
  | 'unsafe-metadata'
  | 'unsafe-path';

export interface PackageSecurityIssue {
  code: PackageSecurityIssueCode;
  path: string;
  message: string;
}

export interface PortablePathPolicy {
  allowedRoots?: readonly string[];
  allowedExtensions?: readonly string[];
  allowBackslashes?: boolean;
  allowTrailingSlash?: boolean;
  maxLength?: number;
}

const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const PORTABLE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const IMAGE_EXTENSIONS = ['.bmp', '.jpeg', '.jpg', '.png', '.webp'] as const;
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav'] as const;
const ASSET_KINDS = new Set(['image', 'spritesheet', 'tileset', 'audio', 'generated']);
const ASSET_SOURCES = new Set(['local', 'generated', 'imported']);
const EXTERNAL_REFERENCE_FIELDS = new Set([
  'baseurl', 'callbackurl', 'cdnurl', 'downloadurl', 'endpoint', 'externalurl',
  'href', 'imageurl', 'remoteurl', 'sourceurl', 'src', 'uri', 'url', 'webhookurl',
]);
const ASSET_REFERENCE_FIELDS = new Set([
  'animationasset', 'animationset', 'asset', 'assetid', 'assetkey', 'audio', 'bgm',
  'conceptassetid', 'music', 'parallax', 'portraitassetid', 'sound', 'sprite', 'tilesetid',
]);
const ARCHIVE_METADATA_FIELDS = new Set([
  'archiveentries', 'compressedsize', 'compressionmethod', 'externalattributes',
  'extrafields', 'hardlink', 'linktarget', 'symlink', 'unixmode', 'uncompressedsize',
  'zipentries',
]);
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function canonicalKey(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function normalizePortablePath(value: string): string {
  return value.trim().replace(/\\/g, '/').normalize('NFC');
}

export function portablePathViolation(
  value: unknown,
  policy: PortablePathPolicy = {},
): string | null {
  if (typeof value !== 'string' || value.length === 0) return 'Path must be a non-empty string.';
  if (value !== value.trim()) return 'Path must not have leading or trailing whitespace.';
  if (value.length > (policy.maxLength ?? 512)) return 'Path is longer than the portable limit.';
  if (CONTROL_OR_BIDI.test(value)) return 'Path contains control or bidirectional characters.';
  if (policy.allowBackslashes === false && value.includes('\\')) return 'Archive paths must use forward slashes.';
  if (value.normalize('NFC') !== value) return 'Path must use NFC Unicode normalization.';
  if (/%[0-9a-f]{2}/i.test(value)) return 'Percent-encoded path bytes are not allowed.';

  let normalized = normalizePortablePath(value);
  if (policy.allowTrailingSlash && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  if (!normalized || normalized.startsWith('/') || normalized.startsWith('//')) {
    return 'Absolute and UNC paths are not allowed.';
  }
  if (/^[A-Za-z]:/.test(normalized) || /[<>:"|?*#]/.test(normalized)) {
    return 'Drive paths and platform-reserved characters are not allowed.';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return 'URI schemes are not allowed.';

  const segments = normalized.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') return 'Empty and dot path segments are not allowed.';
    if (segment.length > 255) return 'A path segment is longer than 255 characters.';
    if (/[ .]$/.test(segment)) return 'Path segments must not end in a dot or space.';
    if (WINDOWS_RESERVED.test(segment) || segment === '~') return 'Path uses a reserved platform name.';
  }

  if (policy.allowedRoots?.length) {
    const folded = normalized.toLowerCase();
    const allowed = policy.allowedRoots.some(root => {
      const safeRoot = normalizePortablePath(root).replace(/\/$/, '').toLowerCase();
      return safeRoot.length > 0 && (folded === safeRoot || folded.startsWith(`${safeRoot}/`));
    });
    if (!allowed) return 'Path is outside the allowed package roots.';
  }
  if (policy.allowedExtensions?.length) {
    const folded = normalized.toLowerCase();
    if (!policy.allowedExtensions.some(extension => folded.endsWith(extension.toLowerCase()))) {
      return 'Path extension is not allowed for this package entry.';
    }
  }
  return null;
}

export function isSafePortablePath(value: unknown, policy: PortablePathPolicy = {}): value is string {
  return portablePathViolation(value, policy) === null;
}

export function isExternalReference(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return normalized.startsWith('//')
    || normalized.startsWith('\\\\')
    || /^www\./i.test(normalized)
    || /^[a-z][a-z0-9+.-]*:/i.test(normalized)
    || /^url\s*\(/i.test(normalized);
}

export function isExternalReferenceField(key: string): boolean {
  const canonical = canonicalKey(key);
  return EXTERNAL_REFERENCE_FIELDS.has(canonical)
    || ASSET_REFERENCE_FIELDS.has(canonical)
    || canonical.endsWith('asseturl');
}

export function isUnsafePortableMetadataKey(key: string): boolean {
  return UNSAFE_OBJECT_KEYS.has(key) || ARCHIVE_METADATA_FIELDS.has(canonicalKey(key));
}

export interface RuntimeAssetMetadata {
  id?: unknown;
  name?: unknown;
  kind?: unknown;
  path?: unknown;
  source?: unknown;
  runtimeCompatible?: unknown;
  width?: unknown;
  height?: unknown;
  frameWidth?: unknown;
  frameHeight?: unknown;
  frames?: unknown;
  durationMs?: unknown;
  [key: string]: unknown;
}

function finiteInteger(value: unknown, minimum: number, maximum: number): boolean {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

export function validateRuntimeAssetMetadata(
  value: RuntimeAssetMetadata,
  path = 'asset',
  allowedRoots: readonly string[] = ['assets'],
): PackageSecurityIssue[] {
  const issues: PackageSecurityIssue[] = [];
  const report = (code: PackageSecurityIssueCode, suffix: string, message: string) => {
    issues.push({ code, path: `${path}.${suffix}`, message });
  };

  for (const key of Object.keys(value)) {
    if (UNSAFE_OBJECT_KEYS.has(key) || ARCHIVE_METADATA_FIELDS.has(canonicalKey(key))) {
      report('unsafe-asset-metadata', key, 'Archive/link/prototype metadata is not allowed on runtime assets.');
    } else if (isSensitivePortableKey(key)) {
      report('secret-metadata', key, 'Credential-bearing metadata is not allowed on runtime assets.');
    } else if (isExternalReferenceField(key) && isExternalReference(value[key])) {
      report('external-reference', key, 'Runtime assets cannot reference external resources.');
    }
  }

  if (typeof value.id !== 'string' || !PORTABLE_ID.test(value.id)) {
    report('unsafe-asset-metadata', 'id', 'Asset id must be a portable identifier of at most 128 characters.');
  }
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 256 || CONTROL_OR_BIDI.test(value.name)) {
    report('unsafe-asset-metadata', 'name', 'Asset name is empty, too long, or contains control characters.');
  }
  if (typeof value.kind !== 'string' || !ASSET_KINDS.has(value.kind)) {
    report('unsafe-asset-metadata', 'kind', 'Asset kind is not supported.');
  }
  if (typeof value.source !== 'string' || !ASSET_SOURCES.has(value.source)) {
    report('unsafe-asset-metadata', 'source', 'Asset source is not supported.');
  }
  if (value.runtimeCompatible !== true) {
    report('unsafe-asset-metadata', 'runtimeCompatible', 'Runtime assets must be explicitly marked compatible.');
  }

  const extensions = value.kind === 'audio' ? AUDIO_EXTENSIONS : IMAGE_EXTENSIONS;
  const pathError = portablePathViolation(value.path, { allowedRoots, allowedExtensions: extensions });
  if (pathError) report('unsafe-path', 'path', pathError);

  for (const field of ['width', 'height', 'frameWidth', 'frameHeight'] as const) {
    const current = value[field];
    if (current !== undefined && !finiteInteger(current, 1, 16_384)) {
      report('unsafe-asset-metadata', field, `${field} must be a safe positive integer no greater than 16384.`);
    }
  }
  if ((value.frameWidth === undefined) !== (value.frameHeight === undefined)) {
    report('unsafe-asset-metadata', 'frameWidth', 'Frame width and height must be provided together.');
  }
  if (typeof value.width === 'number' && typeof value.height === 'number'
    && value.width * value.height > 67_108_864) {
    report('unsafe-asset-metadata', 'width', 'Decoded image dimensions exceed the 64-megapixel package limit.');
  }
  if (value.frames !== undefined && !finiteInteger(value.frames, 1, 4096)) {
    report('unsafe-asset-metadata', 'frames', 'Frame count must be between 1 and 4096.');
  }
  if (value.durationMs !== undefined && !finiteInteger(value.durationMs, 0, 86_400_000)) {
    report('unsafe-asset-metadata', 'durationMs', 'Duration must be a safe integer no greater than 24 hours.');
  }
  return issues;
}

export interface PortableArchiveEntryMetadata {
  path: string;
  kind: 'file' | 'directory' | 'symlink';
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: 'store' | 'deflate' | 0 | 8;
  encrypted?: boolean;
  linkTarget?: string;
  unixMode?: number;
  externalAttributes?: number;
  extraFieldBytes?: number;
}

export interface PortableArchiveLimits {
  maxEntries?: number;
  maxEntryBytes?: number;
  maxTotalBytes?: number;
  maxCompressionRatio?: number;
}

export function validatePortableArchiveEntries(
  entries: readonly PortableArchiveEntryMetadata[],
  limits: PortableArchiveLimits = {},
): PackageSecurityIssue[] {
  const issues: PackageSecurityIssue[] = [];
  const maxEntries = limits.maxEntries ?? 10_000;
  const maxEntryBytes = limits.maxEntryBytes ?? 128 * 1024 * 1024;
  const maxTotalBytes = limits.maxTotalBytes ?? 512 * 1024 * 1024;
  const maxRatio = limits.maxCompressionRatio ?? 100;
  const seen = new Map<string, { path: string; kind: PortableArchiveEntryMetadata['kind'] }>();
  let total = 0;

  if (entries.length > maxEntries) {
    issues.push({ code: 'unsafe-archive-entry', path: '$', message: 'Archive contains too many entries.' });
  }

  entries.forEach((entry, index) => {
    const path = `entries[${index}]`;
    const violation = portablePathViolation(entry.path, {
      allowBackslashes: false,
      allowTrailingSlash: entry.kind === 'directory',
    });
    if (violation) issues.push({ code: 'unsafe-path', path: `${path}.path`, message: violation });
    const canonical = normalizePortablePath(entry.path).replace(/\/$/, '').toLowerCase();
    const duplicate = seen.get(canonical);
    if (duplicate) {
      issues.push({ code: 'unsafe-archive-entry', path: `${path}.path`, message: `Archive entry collides with ${duplicate.path}.` });
    } else {
      seen.set(canonical, { path: entry.path, kind: entry.kind });
    }

    if (entry.kind === 'symlink' || entry.linkTarget !== undefined) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'Links are not allowed in portable archives.' });
    }
    const unixType = typeof entry.unixMode === 'number' ? entry.unixMode & 0o170000 : 0;
    const attributeType = typeof entry.externalAttributes === 'number'
      ? (entry.externalAttributes >>> 16) & 0o170000
      : 0;
    if (unixType === 0o120000 || attributeType === 0o120000) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'Symlink mode bits are not allowed.' });
    }
    if (entry.encrypted) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'Encrypted archive entries are not accepted.' });
    }
    if (![0, 8, 'store', 'deflate'].includes(entry.compressionMethod)) {
      issues.push({ code: 'unsafe-archive-entry', path: `${path}.compressionMethod`, message: 'Unsupported ZIP compression method.' });
    }
    if (!finiteInteger(entry.compressedSize, 0, maxEntryBytes)
      || !finiteInteger(entry.uncompressedSize, 0, maxEntryBytes)) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'Archive entry sizes are invalid or exceed the per-entry limit.' });
      return;
    }
    total += entry.uncompressedSize;
    const ratio = entry.uncompressedSize === 0
      ? 1
      : entry.compressedSize === 0 ? Number.POSITIVE_INFINITY : entry.uncompressedSize / entry.compressedSize;
    if (ratio > maxRatio) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'Archive entry exceeds the compression-ratio limit.' });
    }
    if ((entry.extraFieldBytes ?? 0) > 4096) {
      issues.push({ code: 'unsafe-archive-entry', path, message: 'ZIP extra fields exceed the metadata limit.' });
    }
  });

  if (total > maxTotalBytes) {
    issues.push({ code: 'unsafe-archive-entry', path: '$', message: 'Archive exceeds the total uncompressed-size limit.' });
  }
  for (const [candidate, metadata] of seen) {
    const segments = candidate.split('/');
    for (let index = 1; index < segments.length; index += 1) {
      const ancestor = seen.get(segments.slice(0, index).join('/'));
      if (ancestor?.kind === 'file') {
        issues.push({ code: 'unsafe-archive-entry', path: metadata.path, message: `File entry ${ancestor.path} cannot contain descendants.` });
        break;
      }
    }
  }
  return issues;
}
