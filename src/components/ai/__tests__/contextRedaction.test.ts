import { describe, it, expect } from 'vitest';
import {
  redactContextForProvider,
  ALLOWED_CONTEXT_FIELDS,
  type SafeContext,
  type ContextInput,
} from '../contextRedaction';

const SECRET_INPUTS: ContextInput = {
  projectId: 'sample',
  projectTitle: 'Sample RPG',
  apiKey: 'sk-verysecret1234567890',
  password: 'hunter2hunter2',
  secret: 'topsecretvalue',
  credential: 'creds-abc',
  filesystemPath: 'C:\\Users\\franc\\secret-project\\map.json',
  logLines: [
    'INFO: started',
    'sk-1234567890abcdefghij leaked in log',
    'Bearer eyJhbGciOiJIUzI1NiJ9.payload',
  ],
  selectedRecordIds: { actors: ['hero'] },
  recentMapIds: ['town-1'],
};

const SAFE_INPUT: ContextInput = {
  projectId: 'sample',
  projectTitle: 'Sample RPG',
  selectedRecordIds: { actors: ['hero'] },
  recentMapIds: ['town-1'],
  databaseTables: ['actors', 'skills'],
};

describe('ALLOWED_CONTEXT_FIELDS', () => {
  it('exposes a stable list of safe context fields', () => {
    expect(ALLOWED_CONTEXT_FIELDS).toContain('projectId');
    expect(ALLOWED_CONTEXT_FIELDS).toContain('projectTitle');
    expect(ALLOWED_CONTEXT_FIELDS).toContain('selectedRecordIds');
    expect(ALLOWED_CONTEXT_FIELDS).toContain('recentMapIds');
    expect(ALLOWED_CONTEXT_FIELDS).toContain('databaseTables');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('apiKey');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('password');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('secret');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('credential');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('filesystemPath');
    expect(ALLOWED_CONTEXT_FIELDS).not.toContain('logLines');
  });
});

describe('redactContextForProvider', () => {
  it('keeps only allowlisted fields and drops everything else', () => {
    const out = redactContextForProvider(SECRET_INPUTS);
    const outKeys = Object.keys(out);
    for (const key of outKeys) {
      expect(ALLOWED_CONTEXT_FIELDS).toContain(key);
    }
  });

  it('does not include any secret-like fields in the safe output', () => {
    const out = redactContextForProvider(SECRET_INPUTS);
    const json = JSON.stringify(out);
    expect(json).not.toMatch(/apiKey/);
    expect(json).not.toMatch(/password/);
    expect(json).not.toMatch(/secret/);
    expect(json).not.toMatch(/credential/);
    expect(json).not.toMatch(/sk-verysecret/);
    expect(json).not.toMatch(/hunter2/);
    expect(json).not.toMatch(/topsecretvalue/);
    expect(json).not.toMatch(/creds-abc/);
  });

  it('abbreviates filesystem paths so the full path is not sent', () => {
    const out = redactContextForProvider(SECRET_INPUTS);
    const pathInfo = (out as Record<string, unknown>).filesystemPathHint as string | undefined;
    expect(pathInfo).toBeTruthy();
    expect(pathInfo).not.toContain('franc');
    expect(pathInfo).not.toContain('secret-project');
    expect(pathInfo).toMatch(/\.\.\.|\*+/);
  });

  it('redacts secret patterns in log lines', () => {
    const out = redactContextForProvider(SECRET_INPUTS);
    const sanitizedLogs = (out as Record<string, unknown>).sanitizedLogLines as string[] | undefined;
    expect(sanitizedLogs).toBeTruthy();
    const joined = sanitizedLogs!.join('\n');
    expect(joined).not.toContain('sk-1234567890abcdefghij');
    expect(joined).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('passes through safe context unchanged', () => {
    const out = redactContextForProvider(SAFE_INPUT);
    expect(out.projectId).toBe('sample');
    expect(out.projectTitle).toBe('Sample RPG');
    expect(out.selectedRecordIds).toEqual({ actors: ['hero'] });
    expect(out.recentMapIds).toEqual(['town-1']);
    expect(out.databaseTables).toEqual(['actors', 'skills']);
  });

  it('preserves allowlisted array fields with their elements', () => {
    const out = redactContextForProvider(SAFE_INPUT);
    expect(out.recentMapIds).toEqual(['town-1']);
  });

  it('caps the size of arrays to a safe maximum', () => {
    const huge: ContextInput = {
      ...SAFE_INPUT,
      recentMapIds: Array.from({ length: 5000 }, (_, i) => `map-${i}`),
    };
    const out = redactContextForProvider(huge) as Record<string, unknown>;
    const arr = out.recentMapIds as string[];
    expect(arr.length).toBeLessThanOrEqual(100);
  });

  it('does not throw on a non-object input and returns an empty SafeContext', () => {
    const out = redactContextForProvider(null);
    expect(out).toEqual({});
  });

  it('does not throw on undefined fields and returns an empty SafeContext', () => {
    const out = redactContextForProvider(undefined);
    expect(out).toEqual({});
  });

  it('returns a SafeContext type (typed object, not arbitrary)', () => {
    const out: SafeContext = redactContextForProvider(SAFE_INPUT);
    expect(typeof out).toBe('object');
  });
});
