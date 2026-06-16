export interface ContextInput {
  projectId?: string;
  projectTitle?: string;
  selectedRecordIds?: Record<string, string[]>;
  recentMapIds?: string[];
  databaseTables?: string[];
  apiKey?: string;
  password?: string;
  secret?: string;
  credential?: string;
  filesystemPath?: string;
  logLines?: string[];
  [key: string]: unknown;
}

export interface SafeContext {
  projectId?: string;
  projectTitle?: string;
  selectedRecordIds?: Record<string, string[]>;
  recentMapIds?: string[];
  databaseTables?: string[];
  filesystemPathHint?: string;
  sanitizedLogLines?: string[];
}

export const ALLOWED_CONTEXT_FIELDS: ReadonlyArray<keyof SafeContext> = [
  'projectId',
  'projectTitle',
  'selectedRecordIds',
  'recentMapIds',
  'databaseTables',
  'filesystemPathHint',
  'sanitizedLogLines',
];

const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{6,}/g,
  /\bsk-proj-[A-Za-z0-9_-]{2,}/g,
  /\bsk_live_[A-Za-z0-9_-]{6,}/g,
  /\bAIza[0-9A-Za-z_-]{6,}/g,
  /\bghp_[A-Za-z0-9]{6,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/g,
  /\b[A-Z][A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)\s*=\s*[^\s,;]+/g,
];

const MAX_ARRAY_ITEMS = 100;

function redactString(input: string): string {
  let out = input;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[REDACTED]');
  return out;
}

function abbreviatePath(path: string): string {
  if (!path) return '';
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  return `.../${fileName}`;
}

function capArray<T>(arr: T[]): T[] {
  return arr.length > MAX_ARRAY_ITEMS ? arr.slice(0, MAX_ARRAY_ITEMS) : arr;
}

function sanitizeLogLines(lines: string[]): string[] {
  return capArray(lines.map(redactString));
}

export function redactContextForProvider(input: unknown): SafeContext {
  if (!input || typeof input !== 'object') return {};
  const src = input as ContextInput;
  const out: SafeContext = {};

  if (typeof src.projectId === 'string') out.projectId = src.projectId;
  if (typeof src.projectTitle === 'string') out.projectTitle = src.projectTitle;
  if (src.selectedRecordIds && typeof src.selectedRecordIds === 'object') {
    out.selectedRecordIds = src.selectedRecordIds;
  }
  if (Array.isArray(src.recentMapIds)) {
    out.recentMapIds = capArray(src.recentMapIds.map((s) => String(s)));
  }
  if (Array.isArray(src.databaseTables)) {
    out.databaseTables = capArray(src.databaseTables.map((s) => String(s)));
  }
  if (typeof src.filesystemPath === 'string' && src.filesystemPath.length > 0) {
    out.filesystemPathHint = abbreviatePath(src.filesystemPath);
  }
  if (Array.isArray(src.logLines)) {
    out.sanitizedLogLines = sanitizeLogLines(src.logLines.map((s) => String(s)));
  }

  return out;
}
