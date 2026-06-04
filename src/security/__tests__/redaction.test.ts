import { describe, expect, it } from 'vitest';
import { REDACTED_SECRET, redactSecrets } from '../redaction';

describe('secret redaction', () => {
  it('redacts explicit provider secret values from logs and UI feedback', () => {
    const secret = 'fixture-provider-token-value';
    const text = `Credential failed: Authorization Bearer ${secret}`;

    const redacted = redactSecrets(text, [secret]);

    expect(redacted).toContain(REDACTED_SECRET);
    expect(redacted).not.toContain(secret);
  });

  it('redacts common key, token, and authorization shapes without a known value list', () => {
    const redacted = redactSecrets([
      'apiKey=fixture-provider-token-value',
      'token: fixture-provider-token-value',
      'Authorization: Bearer fixture-provider-token-value',
      'secret="fixture-provider-token-value"',
    ].join('\n'));

    expect(redacted).not.toContain('fixture-provider-token-value');
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('redacts provider-shaped secrets even when no label or known value is available', () => {
    const redacted = redactSecrets([
      'OpenAI rejected sk-test-unlabeled-provider-secret',
      'upstream returned Bearer sk-proj-freeform-provider-secret',
    ].join('\n'));

    expect(redacted).not.toContain('sk-test-unlabeled-provider-secret');
    expect(redacted).not.toContain('sk-proj-freeform-provider-secret');
    expect(redacted.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
