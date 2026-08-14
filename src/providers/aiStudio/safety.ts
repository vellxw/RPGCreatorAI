import { REDACTED_SECRET, redactSecrets } from '../../security/redaction';

export const AI_STUDIO_MAX_PROMPT_LENGTH = 24_000;
const MAX_STRING_LENGTH = 32_000;
const MAX_OUTPUT_STRING_LENGTH = 32 * 1024 * 1024;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_DEPTH = 8;
const SECRET_KEY_PATTERN = /(api[-_]?key|authorization|token|secret|credential|password)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeValue(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  maxStringLength: number,
): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value).slice(0, maxStringLength);
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return typeof value === 'number' && !Number.isFinite(value) ? null : value;
  }
  if (depth >= MAX_OBJECT_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    if (ancestors.has(value)) return '[circular]';
    ancestors.add(value);
    const sanitized = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map(item => sanitizeValue(item, depth + 1, ancestors, maxStringLength));
    ancestors.delete(value);
    return sanitized;
  }
  if (!isRecord(value)) return undefined;
  if (ancestors.has(value)) return '[circular]';

  ancestors.add(value);
  const sanitized = Object.keys(value).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = SECRET_KEY_PATTERN.test(key)
      ? REDACTED_SECRET
      : sanitizeValue(value[key], depth + 1, ancestors, maxStringLength);
    return result;
  }, {});
  ancestors.delete(value);
  return sanitized;
}

export function sanitizeAiStudioPrompt(prompt: string): string {
  return redactSecrets(prompt).trim().slice(0, AI_STUDIO_MAX_PROMPT_LENGTH);
}

export function sanitizeAiStudioRecord(
  input: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  if (!input) return {};
  return sanitizeValue(input, 0, new Set(), MAX_STRING_LENGTH) as Record<string, unknown>;
}

export function sanitizeAiStudioOutputRecord(
  output: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> {
  if (!output) return {};
  return sanitizeValue(output, 0, new Set(), MAX_OUTPUT_STRING_LENGTH) as Record<string, unknown>;
}
