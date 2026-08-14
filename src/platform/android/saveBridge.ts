import {
  parsePortableSave,
  serializePortableSave,
  type PortableSaveV2,
} from '../../runtime-core/saveSchema';
import {
  looksLikePortableSecret,
  redactPortableSecrets,
} from '../../utils/portableSecrets';

export const ANDROID_SAVE_BRIDGE_SCHEMA_VERSION = 1 as const;
export const ANDROID_SAVE_MAX_BYTES = 1024 * 1024;

const ANDROID_SAVE_MESSAGE_MAX_LENGTH = 512;
const LOCAL_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const REQUEST_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}:[1-9][0-9]{0,15}$/;
const WINDOWS_RESERVED_BASENAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const LOCAL_PATH_OR_URI = /(?:\b(?:content|file):\/\/|(?:^|\s)\/(?:data|mnt|sdcard|storage)\/|\b[A-Za-z]:\\|\\\\)/i;

export type AndroidSaveOperation =
  | 'mirror.write'
  | 'mirror.read'
  | 'document.export'
  | 'document.import';

export type AndroidSaveStatus = 'ok' | 'cancelled' | 'error';

export type AndroidSaveErrorCode =
  | 'busy'
  | 'cancelled'
  | 'invalid-request'
  | 'invalid-response'
  | 'invalid-save'
  | 'payload-too-large'
  | 'read-failed'
  | 'write-failed'
  | 'unavailable';

export interface AndroidSaveBridgeRequest {
  schemaVersion: typeof ANDROID_SAVE_BRIDGE_SCHEMA_VERSION;
  requestId: string;
  operation: AndroidSaveOperation;
  createdAtMs: number;
  slotId?: string;
  payload?: string;
  suggestedName?: string;
}

export interface AndroidSaveBridgeResponse {
  schemaVersion: typeof ANDROID_SAVE_BRIDGE_SCHEMA_VERSION;
  requestId: string;
  operation: AndroidSaveOperation;
  status: AndroidSaveStatus;
  payload?: string;
  errorCode?: AndroidSaveErrorCode;
  message?: string;
}

export type AndroidSaveCommand =
  | { operation: 'mirror.write'; slotId: string; save: PortableSaveV2 }
  | { operation: 'mirror.read'; slotId: string }
  | { operation: 'document.export'; save: PortableSaveV2; suggestedName?: string }
  | { operation: 'document.import' };

export interface AndroidSaveBridgeResult {
  response: AndroidSaveBridgeResponse;
  save?: PortableSaveV2;
}

/**
 * Correlates asynchronous native save calls without exposing filesystem or
 * Android APIs to the runtime. Only one request may be active, preventing two
 * Storage Access Framework choosers or overlapping mirror writes.
 */
export class AndroidSaveBridgeCoordinator {
  private pending?: AndroidSaveBridgeRequest;
  private sequence = 0;

  constructor(private readonly sessionId: string) {
    assertLocalIdentifier(sessionId, 'sessionId');
  }

  begin(command: AndroidSaveCommand, createdAtMs: number): AndroidSaveBridgeRequest {
    assertTimestamp(createdAtMs);
    if (this.pending) throw new Error('Android save bridge already has a pending request.');
    if (!Number.isSafeInteger(this.sequence + 1)) {
      throw new Error('Android save bridge request sequence is exhausted.');
    }

    const request: AndroidSaveBridgeRequest = {
      schemaVersion: ANDROID_SAVE_BRIDGE_SCHEMA_VERSION,
      requestId: `${this.sessionId}:${++this.sequence}`,
      operation: command.operation,
      createdAtMs,
    };

    switch (command.operation) {
      case 'mirror.write':
        request.slotId = normalizeSlotId(command.slotId);
        request.payload = checkedPayload(serializePortableSave(command.save));
        break;
      case 'mirror.read':
        request.slotId = normalizeSlotId(command.slotId);
        break;
      case 'document.export':
        request.payload = checkedPayload(serializePortableSave(command.save));
        request.suggestedName = safeAndroidSaveName(command.suggestedName);
        break;
      case 'document.import':
        break;
    }

    this.pending = request;
    return { ...request };
  }

  getPending(): AndroidSaveBridgeRequest | undefined {
    return this.pending ? { ...this.pending } : undefined;
  }

  complete(value: unknown): AndroidSaveBridgeResult {
    if (!this.pending) throw new Error('Android save bridge has no pending request.');
    const response = parseAndroidSaveBridgeResponse(value);

    if (response.requestId !== this.pending.requestId) {
      throw new Error('Android save bridge response requestId does not match the pending request.');
    }
    if (response.operation !== this.pending.operation) {
      throw new Error('Android save bridge response operation does not match the pending request.');
    }

    let save: PortableSaveV2 | undefined;
    if (response.status === 'ok' && operationReturnsSave(response.operation)) {
      if (typeof response.payload !== 'string') {
        throw new Error('Android save bridge response is missing its save payload.');
      }
      save = parsePortableSave(checkedPayload(response.payload));
    }

    this.pending = undefined;
    return { response, save };
  }

  abandon(): AndroidSaveBridgeRequest | undefined {
    const request = this.pending;
    this.pending = undefined;
    return request ? { ...request } : undefined;
  }
}

export function parseAndroidSaveBridgeResponse(value: unknown): AndroidSaveBridgeResponse {
  if (!isRecord(value)) throw new Error('Android save bridge response must be an object.');
  assertKnownKeys(value, [
    'schemaVersion',
    'requestId',
    'operation',
    'status',
    'payload',
    'errorCode',
    'message',
  ]);
  if (value.schemaVersion !== ANDROID_SAVE_BRIDGE_SCHEMA_VERSION) {
    throw new Error('Android save bridge response schemaVersion is unsupported.');
  }
  assertRequestIdentifier(value.requestId);
  if (!isOperation(value.operation)) throw new Error('Android save bridge response operation is invalid.');
  if (!isStatus(value.status)) throw new Error('Android save bridge response status is invalid.');

  if (value.payload !== undefined && typeof value.payload !== 'string') {
    throw new Error('Android save bridge response payload must be a string.');
  }
  if (value.payload !== undefined) checkedPayload(value.payload);
  if (value.errorCode !== undefined && !isErrorCode(value.errorCode)) {
    throw new Error('Android save bridge response errorCode is invalid.');
  }
  if (value.message !== undefined && !isSafeBridgeMessage(value.message)) {
    throw new Error('Android save bridge response message is invalid or contains sensitive implementation details.');
  }

  const returnsSave = operationReturnsSave(value.operation);
  if (value.status === 'ok') {
    if (value.errorCode !== undefined) {
      throw new Error('Android save bridge ok response cannot contain an errorCode.');
    }
    if (returnsSave && value.payload === undefined) {
      throw new Error('Android save bridge ok response is missing its save payload.');
    }
    if (!returnsSave && value.payload !== undefined) {
      throw new Error('Android save bridge write response cannot contain a payload.');
    }
  } else {
    if (value.payload !== undefined) {
      throw new Error('Android save bridge non-ok response cannot contain a payload.');
    }
    if (value.status === 'error' && (value.errorCode === undefined || value.errorCode === 'cancelled')) {
      throw new Error('Android save bridge error response requires a non-cancelled errorCode.');
    }
    if (value.status === 'cancelled' && value.errorCode !== undefined && value.errorCode !== 'cancelled') {
      throw new Error('Android save bridge cancelled response has an inconsistent errorCode.');
    }
  }

  return {
    schemaVersion: ANDROID_SAVE_BRIDGE_SCHEMA_VERSION,
    requestId: value.requestId,
    operation: value.operation,
    status: value.status,
    payload: value.payload,
    errorCode: value.errorCode,
    message: value.message,
  };
}

export function safeAndroidSaveName(input?: string): string {
  const extension = '.rpgsave.json';
  const raw = ((input ?? '').trim().split(/[\\/]/).pop() ?? '').trim();
  const withoutKnownExtension = raw.toLowerCase().endsWith(extension)
    ? raw.slice(0, -extension.length)
    : raw;
  const clean = withoutKnownExtension
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .replace(/_+/g, '_')
    .slice(0, 72)
    .replace(/[._-]+$/, '');
  const basename = clean || 'rpgcreator-save';
  const portableBasename = WINDOWS_RESERVED_BASENAME.test(basename)
    ? `rpgcreator-${basename}`
    : basename;
  return `${portableBasename}${extension}`;
}

function checkedPayload(payload: string): string {
  const bytes = new TextEncoder().encode(payload).byteLength;
  if (bytes > ANDROID_SAVE_MAX_BYTES) {
    throw new Error(`Android save payload exceeds ${ANDROID_SAVE_MAX_BYTES} bytes.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error('Android save payload must be valid JSON.');
  }
  let scrubbed: unknown;
  try {
    scrubbed = redactPortableSecrets(parsed);
  } catch {
    throw new Error('Android save payload contains unsafe metadata or exceeds structural limits.');
  }
  if (JSON.stringify(scrubbed) !== JSON.stringify(parsed)) {
    throw new Error('Android save payload contains credential-like data.');
  }
  return payload;
}

function normalizeSlotId(slotId: string): string {
  const normalized = slotId.trim();
  assertLocalIdentifier(normalized, 'slotId');
  return normalized;
}

function operationReturnsSave(operation: AndroidSaveOperation): boolean {
  return operation === 'mirror.read' || operation === 'document.import';
}

function assertLocalIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !LOCAL_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Android save bridge ${field} is invalid.`);
  }
}

function assertRequestIdentifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !REQUEST_IDENTIFIER_PATTERN.test(value)) {
    throw new Error('Android save bridge requestId is invalid.');
  }
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new Error('Android save bridge createdAtMs must be a non-negative safe integer.');
  }
}

function assertKnownKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Android save bridge response contains unexpected field "${key}".`);
    }
  }
}

function isSafeBridgeMessage(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= ANDROID_SAVE_MESSAGE_MAX_LENGTH
    && value === value.trim()
    && !CONTROL_OR_BIDI.test(value)
    && !looksLikePortableSecret(value)
    && !LOCAL_PATH_OR_URI.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isOperation(value: unknown): value is AndroidSaveOperation {
  return value === 'mirror.write'
    || value === 'mirror.read'
    || value === 'document.export'
    || value === 'document.import';
}

function isStatus(value: unknown): value is AndroidSaveStatus {
  return value === 'ok' || value === 'cancelled' || value === 'error';
}

function isErrorCode(value: unknown): value is AndroidSaveErrorCode {
  return value === 'busy'
    || value === 'cancelled'
    || value === 'invalid-request'
    || value === 'invalid-response'
    || value === 'invalid-save'
    || value === 'payload-too-large'
    || value === 'read-failed'
    || value === 'write-failed'
    || value === 'unavailable';
}
