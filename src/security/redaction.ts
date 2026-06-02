export const REDACTED_SECRET = '[REDACTED]';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactSecrets(input: string | undefined | null, knownSecrets: string[] = []): string {
  if (!input) return '';

  let out = input;
  for (const secret of knownSecrets) {
    if (secret.length < 4) continue;
    out = out.replace(new RegExp(escapeRegExp(secret), 'g'), REDACTED_SECRET);
  }

  out = out.replace(
    /(authorization\s*:\s*bearer\s+)[^\s'",;]+/gi,
    `$1${REDACTED_SECRET}`,
  );
  out = out.replace(
    /\b(api[_-]?key|token|secret|credential)\b(\s*[:=]\s*)(["']?)[^\s"',;&]+(["']?)/gi,
    (_match, label: string, separator: string, openQuote: string, closeQuote: string) =>
      `${label}${separator}${openQuote}${REDACTED_SECRET}${closeQuote}`,
  );

  return out;
}
