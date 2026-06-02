import type { CredentialStatus, CredentialWriteResult } from './types';
import { redactSecrets } from '../security/redaction';

export interface CredentialStoreAdapter {
  isAvailable(): boolean;
  getUnavailableReason(): string | null;
  getStatus(providerId: string): Promise<CredentialStatus>;
  list(): Promise<CredentialStatus[]>;
  setCredential(providerId: string, secret: string): Promise<CredentialWriteResult>;
  deleteCredential(providerId: string): Promise<CredentialStatus>;
}

const UNAVAILABLE_REASON = 'Credential storage is only available in the desktop shell.';

export class BrowserCredentialStoreAdapter implements CredentialStoreAdapter {
  isAvailable(): boolean {
    return false;
  }

  getUnavailableReason(): string {
    return UNAVAILABLE_REASON;
  }

  async getStatus(providerId: string): Promise<CredentialStatus> {
    return {
      providerId,
      configured: false,
      storage: 'unavailable',
      error: UNAVAILABLE_REASON,
    };
  }

  async list(): Promise<CredentialStatus[]> {
    return [];
  }

  async setCredential(_providerId: string, secret: string): Promise<CredentialWriteResult> {
    return {
      success: false,
      error: redactSecrets(UNAVAILABLE_REASON, [secret]),
    };
  }

  async deleteCredential(providerId: string): Promise<CredentialStatus> {
    return this.getStatus(providerId);
  }
}

export class DesktopCredentialStoreAdapter implements CredentialStoreAdapter {
  isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.rpgBridge?.credentials;
  }

  getUnavailableReason(): string | null {
    return this.isAvailable() ? null : UNAVAILABLE_REASON;
  }

  async getStatus(providerId: string): Promise<CredentialStatus> {
    if (!this.isAvailable()) return new BrowserCredentialStoreAdapter().getStatus(providerId);
    try {
      return await window.rpgBridge!.credentials!.getStatus(providerId);
    } catch (error) {
      return {
        providerId,
        configured: false,
        storage: 'unavailable',
        error: redactSecrets((error as Error).message),
      };
    }
  }

  async list(): Promise<CredentialStatus[]> {
    if (!this.isAvailable()) return [];
    try {
      return await window.rpgBridge!.credentials!.list();
    } catch {
      return [];
    }
  }

  async setCredential(providerId: string, secret: string): Promise<CredentialWriteResult> {
    if (!this.isAvailable()) return new BrowserCredentialStoreAdapter().setCredential(providerId, secret);
    try {
      const result = await window.rpgBridge!.credentials!.set(providerId, secret);
      return {
        ...result,
        error: redactSecrets(result.error, [secret]),
      };
    } catch (error) {
      return {
        success: false,
        error: redactSecrets((error as Error).message, [secret]),
      };
    }
  }

  async deleteCredential(providerId: string): Promise<CredentialStatus> {
    if (!this.isAvailable()) return new BrowserCredentialStoreAdapter().deleteCredential(providerId);
    try {
      return await window.rpgBridge!.credentials!.delete(providerId);
    } catch (error) {
      return {
        providerId,
        configured: false,
        storage: 'unavailable',
        error: redactSecrets((error as Error).message),
      };
    }
  }
}

export function getCredentialStoreAdapter(): CredentialStoreAdapter {
  return typeof window !== 'undefined' && !!window.rpgBridge?.credentials
    ? new DesktopCredentialStoreAdapter()
    : new BrowserCredentialStoreAdapter();
}
