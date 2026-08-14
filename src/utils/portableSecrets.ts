/**
 * Secret-key detection shared by authoring exports and runtime bundles.
 *
 * Keys are canonicalized so spelling differences such as `api_key`,
 * `providerApiKey`, and `API-KEY` cannot bypass the offline boundary.
 */
const SENSITIVE_KEY_SUFFIXES = [
  'apisecret',
  'apikey',
  'apitoken',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'authorization',
  'bearer',
  'cookie',
  'credential',
  'credentialblob',
  'credentials',
  'connectionstring',
  'dpapiblob',
  'password',
  'passphrase',
  'privatekey',
  'clientsecret',
  'secretkey',
  'signingkey',
  'encryptionkey',
  'sessiontoken',
  'secret',
  'token',
  'webhooksecret',
] as const;

const UNSAFE_PORTABLE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SECRET_VALUE_PATTERNS = [
  /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/,
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}\b/i,
] as const;

function canonicalKey(key: string): string {
  return key.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitivePortableKey(key: string): boolean {
  const canonical = canonicalKey(key);
  if (canonical === 'secret') return true;
  return SENSITIVE_KEY_SUFFIXES.some(suffix => canonical.endsWith(suffix));
}

export function looksLikePortableSecret(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Clones a JSON-shaped value while omitting credential-bearing properties.
 * Circular structures remain invalid and fail before any partial export occurs.
 */
export function redactPortableSecrets<T>(value: T): T {
  const ancestors = new Set<object>();

  let visited = 0;
  const visit = (entry: unknown, path: string, depth = 0): unknown => {
    visited += 1;
    if (visited > 100_000 || depth > 64) {
      throw new TypeError(`Portable value exceeds structural limits at ${path}.`);
    }
    if (typeof entry === 'string' && looksLikePortableSecret(entry)) return '[REDACTED]';
    if (entry === null || typeof entry !== 'object') return entry;
    if (ancestors.has(entry)) {
      throw new TypeError(`Cannot export circular value at ${path}.`);
    }
    ancestors.add(entry);

    if (Array.isArray(entry)) {
      const result = entry.map((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      ancestors.delete(entry);
      return result;
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(entry as Record<string, unknown>)) {
      if (UNSAFE_PORTABLE_KEYS.has(key)) {
        throw new TypeError(`Unsafe metadata key at ${path}.${key}.`);
      }
      if (isSensitivePortableKey(key)) continue;
      result[key] = visit(item, `${path}.${key}`, depth + 1);
    }
    ancestors.delete(entry);
    return result;
  };

  return visit(value, '$') as T;
}
