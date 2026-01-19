/**
 * Credential Service for AI Provider API Keys
 *
 * Provides secure storage and retrieval of API credentials using Electron's
 * safeStorage API (macOS Keychain on macOS, platform equivalents elsewhere).
 * Falls back to in-memory session storage when safeStorage is unavailable.
 *
 * @module src/main/services/ai/credential-service
 */

import { safeStorage } from 'electron';
import Store from 'electron-store';

import type { CredentialMetadata } from '../../../shared/ai/types';
import { CredentialStorageError } from '../../../shared/ai/errors';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of setting a credential.
 */
export interface CredentialSetResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Storage type used for the credential */
  storageType: 'persistent' | 'session';
  /** Metadata about the stored credential */
  metadata: CredentialMetadata;
}

/**
 * Interface for credential service operations.
 */
export interface ICredentialService {
  /** Check if secure storage is available */
  isAvailable(): boolean;
  /** Store a credential for a provider */
  setCredential(providerId: string, apiKey: string): Promise<CredentialSetResult>;
  /** Retrieve a credential for a provider */
  getCredential(providerId: string): Promise<string | null>;
  /** Check if a credential exists for a provider */
  hasCredential(providerId: string): Promise<CredentialMetadata | null>;
  /** Remove a credential for a provider */
  clearCredential(providerId: string): Promise<boolean>;
  /** Get the current storage type being used */
  getStorageType(): 'persistent' | 'session';
}

// =============================================================================
// STORAGE SCHEMA
// =============================================================================

/**
 * Schema for a single stored credential entry.
 */
interface StoredCredentialEntry {
  /** Base64-encoded encrypted credential */
  encrypted: string;
  /** Metadata about the credential */
  metadata: CredentialMetadata;
}

/**
 * Schema for the credential store.
 */
interface CredentialStoreSchema {
  credentials: Record<string, StoredCredentialEntry>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STORE_NAME = 'mdxpad-credentials';
const KEY_PREVIEW_LENGTH = 4;

// =============================================================================
// IMPLEMENTATION
// =============================================================================

/**
 * Service for secure storage and retrieval of AI provider credentials.
 *
 * Uses Electron's safeStorage API for encryption when available (macOS Keychain,
 * Windows DPAPI, Linux Secret Service). Falls back to in-memory session storage
 * when secure storage is unavailable.
 *
 * @example
 * ```typescript
 * const credentialService = new CredentialService();
 *
 * // Store a credential
 * const result = await credentialService.setCredential('openai', 'sk-...');
 *
 * // Retrieve a credential
 * const apiKey = await credentialService.getCredential('openai');
 *
 * // Check if credential exists
 * const metadata = await credentialService.hasCredential('openai');
 *
 * // Remove a credential
 * await credentialService.clearCredential('openai');
 * ```
 */
export class CredentialService implements ICredentialService {
  /** Persistent store for encrypted credentials */
  private readonly store: Store<CredentialStoreSchema>;

  /** In-memory fallback for session-only storage */
  private readonly sessionStore: Map<string, string> = new Map();

  /** In-memory metadata for session credentials */
  private readonly sessionMetadata: Map<string, CredentialMetadata> = new Map();

  /** Whether safeStorage encryption is available */
  private readonly encryptionAvailable: boolean;

  /**
   * Creates a new CredentialService instance.
   * Initializes the persistent store and checks encryption availability.
   */
  constructor() {
    this.store = new Store<CredentialStoreSchema>({
      name: STORE_NAME,
      defaults: {
        credentials: {},
      },
    });

    this.encryptionAvailable = safeStorage.isEncryptionAvailable();

    if (!this.encryptionAvailable) {
      console.warn(
        '[CredentialService] Secure storage unavailable. Using session-only storage.'
      );
    }
  }

  /**
   * Checks if secure persistent storage is available.
   * @returns True if safeStorage encryption is available
   */
  isAvailable(): boolean {
    return this.encryptionAvailable;
  }

  /**
   * Gets the current storage type being used.
   * @returns 'persistent' if secure storage available, 'session' otherwise
   */
  getStorageType(): 'persistent' | 'session' {
    return this.encryptionAvailable ? 'persistent' : 'session';
  }

  /**
   * Stores a credential for a provider.
   *
   * When secure storage is available, encrypts the key using safeStorage
   * and persists it to electron-store. Otherwise, stores in memory for
   * the current session only.
   *
   * @param providerId - Unique identifier for the provider
   * @param apiKey - The API key to store
   * @returns Result containing success status, storage type, and metadata
   * @throws CredentialStorageError if encryption fails
   */
  async setCredential(
    providerId: string,
    apiKey: string
  ): Promise<CredentialSetResult> {
    const metadata = this.createMetadata(providerId, apiKey);

    if (this.encryptionAvailable) {
      return this.setCredentialPersistent(providerId, apiKey, metadata);
    }

    return this.setCredentialSession(providerId, apiKey, metadata);
  }

  /**
   * Retrieves a credential for a provider.
   *
   * @param providerId - Unique identifier for the provider
   * @returns The decrypted API key, or null if not found
   * @throws CredentialStorageError if decryption fails
   */
  async getCredential(providerId: string): Promise<string | null> {
    if (this.encryptionAvailable) {
      return this.getCredentialPersistent(providerId);
    }

    return this.getCredentialSession(providerId);
  }

  /**
   * Checks if a credential exists for a provider.
   *
   * @param providerId - Unique identifier for the provider
   * @returns Credential metadata if exists, null otherwise
   */
  async hasCredential(providerId: string): Promise<CredentialMetadata | null> {
    if (this.encryptionAvailable) {
      const credentials = this.store.get('credentials');
      const entry = credentials[providerId];
      return entry?.metadata ?? null;
    }

    return this.sessionMetadata.get(providerId) ?? null;
  }

  /**
   * Removes a credential for a provider.
   *
   * @param providerId - Unique identifier for the provider
   * @returns True if a credential was removed, false if none existed
   */
  async clearCredential(providerId: string): Promise<boolean> {
    if (this.encryptionAvailable) {
      return this.clearCredentialPersistent(providerId);
    }

    return this.clearCredentialSession(providerId);
  }

  // ===========================================================================
  // PRIVATE: Persistent Storage Methods
  // ===========================================================================

  /**
   * Stores a credential using persistent encrypted storage.
   */
  private setCredentialPersistent(
    providerId: string,
    apiKey: string,
    metadata: CredentialMetadata
  ): CredentialSetResult {
    try {
      const encrypted = safeStorage.encryptString(apiKey);
      const encodedCredential = encrypted.toString('base64');

      const credentials = this.store.get('credentials');
      credentials[providerId] = {
        encrypted: encodedCredential,
        metadata,
      };
      this.store.set('credentials', credentials);

      return { success: true, storageType: 'persistent', metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CredentialStorageError(
        `Failed to encrypt credential: ${message}`,
        providerId
      );
    }
  }

  /**
   * Retrieves a credential from persistent encrypted storage.
   */
  private getCredentialPersistent(providerId: string): string | null {
    const credentials = this.store.get('credentials');
    const entry = credentials[providerId];

    if (!entry) {
      return null;
    }

    try {
      const encryptedBuffer = Buffer.from(entry.encrypted, 'base64');
      return safeStorage.decryptString(encryptedBuffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CredentialStorageError(
        `Failed to decrypt credential: ${message}`,
        providerId
      );
    }
  }

  /**
   * Removes a credential from persistent storage.
   */
  private clearCredentialPersistent(providerId: string): boolean {
    const credentials = this.store.get('credentials');

    if (!(providerId in credentials)) {
      return false;
    }

    delete credentials[providerId];
    this.store.set('credentials', credentials);
    return true;
  }

  // ===========================================================================
  // PRIVATE: Session Storage Methods
  // ===========================================================================

  /**
   * Stores a credential in session-only memory storage.
   */
  private setCredentialSession(
    providerId: string,
    apiKey: string,
    metadata: CredentialMetadata
  ): CredentialSetResult {
    this.sessionStore.set(providerId, apiKey);
    this.sessionMetadata.set(providerId, metadata);
    return { success: true, storageType: 'session', metadata };
  }

  /**
   * Retrieves a credential from session memory storage.
   */
  private getCredentialSession(providerId: string): string | null {
    return this.sessionStore.get(providerId) ?? null;
  }

  /**
   * Removes a credential from session memory storage.
   */
  private clearCredentialSession(providerId: string): boolean {
    const hadCredential = this.sessionStore.has(providerId);
    this.sessionStore.delete(providerId);
    this.sessionMetadata.delete(providerId);
    return hadCredential;
  }

  // ===========================================================================
  // PRIVATE: Utility Methods
  // ===========================================================================

  /**
   * Creates credential metadata from provider ID and API key.
   */
  private createMetadata(providerId: string, apiKey: string): CredentialMetadata {
    return {
      providerId,
      storageType: this.getStorageType(),
      keyPreview: this.generateKeyPreview(apiKey),
      storedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a preview of the API key showing only the last N characters.
   * Returns asterisks if the key is too short.
   */
  private generateKeyPreview(apiKey: string): string {
    if (apiKey.length <= KEY_PREVIEW_LENGTH) {
      return '*'.repeat(KEY_PREVIEW_LENGTH);
    }
    return apiKey.slice(-KEY_PREVIEW_LENGTH);
  }
}
