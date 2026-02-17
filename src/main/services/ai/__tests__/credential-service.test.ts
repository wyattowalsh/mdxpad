/**
 * CredentialService Unit Tests
 *
 * Tests for secure credential storage and retrieval using Electron's safeStorage API.
 * Covers encryption/decryption, session fallback, and key management.
 *
 * @module tests/unit/credential-service
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// =============================================================================
// Mock Setup - Use vi.hoisted for hoisted mock variables
// =============================================================================

const { mockSafeStorage, mockStoreData, mockStore, mockStoreConstructor } = vi.hoisted(() => {
  const storeData = new Map<string, unknown>();
  const store = {
    get: vi.fn((key: string, defaultValue?: unknown) => storeData.get(key) ?? defaultValue),
    set: vi.fn((key: string, value: unknown) => { storeData.set(key, value); }),
    delete: vi.fn((key: string) => { storeData.delete(key); }),
    has: vi.fn((key: string) => storeData.has(key)),
    clear: vi.fn(() => { storeData.clear(); }),
    onDidChange: vi.fn(),
  };
  return {
    mockSafeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((str: string) => Buffer.from(`encrypted:${str}`)),
      decryptString: vi.fn((buf: Buffer) => buf.toString().replace('encrypted:', '')),
    },
    mockStoreData: storeData,
    mockStore: store,
    mockStoreConstructor: vi.fn().mockImplementation(() => store),
  };
});

// Mock electron
vi.mock('electron', () => ({
  safeStorage: mockSafeStorage,
}));

// Mock electron-store
vi.mock('electron-store', () => ({
  default: mockStoreConstructor,
}));

// Import after mocks
import { CredentialService } from '../credential-service';
import { CredentialStorageError } from '../../../../shared/ai/errors';

// =============================================================================
// Test Utilities
// =============================================================================

function resetMocks(): void {
  vi.clearAllMocks();
  mockStoreData.clear();
  mockStoreData.set('credentials', {});
  mockStore.get.mockImplementation((key: string, defaultValue?: unknown) => mockStoreData.get(key) ?? defaultValue);
  mockStore.set.mockImplementation((key: string, value: unknown) => { mockStoreData.set(key, value); });
  mockStoreConstructor.mockImplementation(() => mockStore);
  mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
}

// =============================================================================
// CredentialService Tests
// =============================================================================

describe('CredentialService', () => {
  let service: CredentialService;

  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // Constructor Tests
  // ===========================================================================

  describe('constructor', () => {
    it('should initialize with encryption available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();

      expect(service.isAvailable()).toBe(true);
      expect(service.getStorageType()).toBe('persistent');
    });

    it('should initialize with encryption unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      service = new CredentialService();

      expect(service.isAvailable()).toBe(false);
      expect(service.getStorageType()).toBe('session');
    });

    it('should create electron-store with correct configuration', () => {
      service = new CredentialService();

      expect(mockStoreConstructor).toHaveBeenCalledWith({
        name: 'mdxpad-credentials',
        defaults: {
          credentials: {},
        },
      });
    });

    it('should log warning when encryption unavailable', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

      service = new CredentialService();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Secure storage unavailable')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Persistent Storage Tests
  // ===========================================================================

  describe('persistent storage (encryption available)', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();
    });

    describe('setCredential', () => {
      it('should encrypt and store credential', async () => {
        const providerId = 'openai';
        const apiKey = 'sk-test-key-1234567890';

        const result = await service.setCredential(providerId, apiKey);

        expect(result.success).toBe(true);
        expect(result.storageType).toBe('persistent');
        expect(result.metadata.providerId).toBe(providerId);
        expect(result.metadata.keyPreview).toBe('7890');
        expect(result.metadata.storageType).toBe('persistent');
        expect(result.metadata.storedAt).toBeDefined();

        expect(mockSafeStorage.encryptString).toHaveBeenCalledWith(apiKey);
        expect(mockStore.set).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({
            [providerId]: expect.objectContaining({
              encrypted: expect.any(String),
              metadata: expect.objectContaining({
                providerId,
                keyPreview: '7890',
              }),
            }),
          })
        );
      });

      it('should handle short API keys (preview masking)', async () => {
        const providerId = 'test';
        const shortKey = 'abc';

        const result = await service.setCredential(providerId, shortKey);

        expect(result.metadata.keyPreview).toBe('****');
      });

      it('should throw CredentialStorageError on encryption failure', async () => {
        mockSafeStorage.encryptString.mockImplementation(() => {
          throw new Error('Encryption failed');
        });

        await expect(service.setCredential('test', 'key')).rejects.toThrow(
          CredentialStorageError
        );
      });

      it('should update existing credential', async () => {
        const providerId = 'openai';
        mockStoreData.set('credentials', {
          [providerId]: {
            encrypted: 'old-encrypted-data',
            metadata: { providerId, keyPreview: 'old1', storedAt: '2024-01-01' },
          },
        });

        const newKey = 'sk-new-key-9999';
        const result = await service.setCredential(providerId, newKey);

        expect(result.success).toBe(true);
        expect(result.metadata.keyPreview).toBe('9999');
      });
    });

    describe('getCredential', () => {
      it('should decrypt and return credential', async () => {
        const providerId = 'openai';
        const apiKey = 'sk-test-key-1234567890';
        const encrypted = Buffer.from(`encrypted:${apiKey}`).toString('base64');

        mockStoreData.set('credentials', {
          [providerId]: {
            encrypted,
            metadata: { providerId, keyPreview: '7890' },
          },
        });

        const result = await service.getCredential(providerId);

        expect(result).toBe(apiKey);
        expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(
          Buffer.from(encrypted, 'base64')
        );
      });

      it('should return null for non-existent credential', async () => {
        mockStoreData.set('credentials', {});

        const result = await service.getCredential('non-existent');

        expect(result).toBeNull();
      });

      it('should throw CredentialStorageError on decryption failure', async () => {
        const providerId = 'test';
        mockStoreData.set('credentials', {
          [providerId]: {
            encrypted: 'corrupted-data',
            metadata: { providerId },
          },
        });

        mockSafeStorage.decryptString.mockImplementation(() => {
          throw new Error('Decryption failed');
        });

        await expect(service.getCredential(providerId)).rejects.toThrow(
          CredentialStorageError
        );
      });
    });

    describe('hasCredential', () => {
      it('should return metadata when credential exists', async () => {
        const providerId = 'openai';
        const metadata = {
          providerId,
          storageType: 'persistent' as const,
          keyPreview: '7890',
          storedAt: '2024-01-01T00:00:00.000Z',
        };

        mockStoreData.set('credentials', {
          [providerId]: {
            encrypted: 'data',
            metadata,
          },
        });

        const result = await service.hasCredential(providerId);

        expect(result).toEqual(metadata);
      });

      it('should return null when credential does not exist', async () => {
        mockStoreData.set('credentials', {});

        const result = await service.hasCredential('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('clearCredential', () => {
      it('should remove credential and return true', async () => {
        const providerId = 'openai';
        const credentials = {
          [providerId]: { encrypted: 'data', metadata: { providerId } },
          another: { encrypted: 'data2', metadata: { providerId: 'another' } },
        };

        mockStoreData.set('credentials', credentials);

        const result = await service.clearCredential(providerId);

        expect(result).toBe(true);
        expect(mockStore.set).toHaveBeenCalledWith(
          'credentials',
          expect.not.objectContaining({ [providerId]: expect.anything() })
        );
      });

      it('should return false when credential does not exist', async () => {
        mockStoreData.set('credentials', {});

        const result = await service.clearCredential('non-existent');

        expect(result).toBe(false);
        expect(mockStore.set).not.toHaveBeenCalled();
      });

      it('should preserve other credentials when clearing one', async () => {
        const credentials = {
          openai: { encrypted: 'data1', metadata: { providerId: 'openai' } },
          anthropic: { encrypted: 'data2', metadata: { providerId: 'anthropic' } },
        };

        mockStoreData.set('credentials', { ...credentials });

        await service.clearCredential('openai');

        expect(mockStore.set).toHaveBeenCalledWith(
          'credentials',
          expect.objectContaining({
            anthropic: credentials.anthropic,
          })
        );
      });
    });
  });

  // ===========================================================================
  // Session Storage Tests
  // ===========================================================================

  describe('session storage (encryption unavailable)', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      service = new CredentialService();
    });

    describe('setCredential', () => {
      it('should store in memory', async () => {
        const providerId = 'openai';
        const apiKey = 'sk-test-key';

        const result = await service.setCredential(providerId, apiKey);

        expect(result.success).toBe(true);
        expect(result.storageType).toBe('session');
        expect(mockSafeStorage.encryptString).not.toHaveBeenCalled();
        expect(mockStore.set).not.toHaveBeenCalled();
      });

      it('should retrieve credential from memory', async () => {
        const providerId = 'openai';
        const apiKey = 'sk-test-key';

        await service.setCredential(providerId, apiKey);
        const result = await service.getCredential(providerId);

        expect(result).toBe(apiKey);
        expect(mockSafeStorage.decryptString).not.toHaveBeenCalled();
      });

      it('should return null for non-existent session credential', async () => {
        const result = await service.getCredential('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('hasCredential', () => {
      it('should return metadata for session credential', async () => {
        const providerId = 'openai';
        const apiKey = 'sk-test-key-1234';

        await service.setCredential(providerId, apiKey);
        const result = await service.hasCredential(providerId);

        expect(result).toMatchObject({
          providerId,
          storageType: 'session',
          keyPreview: '1234',
        });
      });

      it('should return null for non-existent session credential', async () => {
        const result = await service.hasCredential('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('clearCredential', () => {
      it('should remove session credential and return true', async () => {
        const providerId = 'openai';
        await service.setCredential(providerId, 'sk-key');

        const result = await service.clearCredential(providerId);

        expect(result).toBe(true);

        const afterClear = await service.getCredential(providerId);
        expect(afterClear).toBeNull();
      });

      it('should return false when session credential does not exist', async () => {
        const result = await service.clearCredential('non-existent');

        expect(result).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Key Preview Tests
  // ===========================================================================

  describe('key preview generation', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();
    });

    it('should show last 4 characters for normal keys', async () => {
      const result = await service.setCredential('test', 'sk-test-key-abcd1234');

      expect(result.metadata.keyPreview).toBe('1234');
    });

    it('should mask keys shorter than 4 characters', async () => {
      const result = await service.setCredential('test', 'abc');

      expect(result.metadata.keyPreview).toBe('****');
    });

    it('should handle exactly 4 character keys', async () => {
      const result = await service.setCredential('test', 'abcd');

      expect(result.metadata.keyPreview).toBe('****');
    });

    it('should handle empty keys', async () => {
      const result = await service.setCredential('test', '');

      expect(result.metadata.keyPreview).toBe('****');
    });
  });

  // ===========================================================================
  // Metadata Tests
  // ===========================================================================

  describe('metadata', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();
    });

    it('should include correct providerId', async () => {
      const providerId = 'anthropic';
      const result = await service.setCredential(providerId, 'key');

      expect(result.metadata.providerId).toBe(providerId);
    });

    it('should include storedAt timestamp', async () => {
      const beforeStore = new Date().toISOString();
      const result = await service.setCredential('test', 'key');
      const afterStore = new Date().toISOString();

      expect(result.metadata.storedAt).toBeDefined();
      expect(result.metadata.storedAt >= beforeStore).toBe(true);
      expect(result.metadata.storedAt <= afterStore).toBe(true);
    });

    it('should include correct storage type', async () => {
      const result = await service.setCredential('test', 'key');

      expect(result.metadata.storageType).toBe('persistent');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();
    });

    it('should handle special characters in API key', async () => {
      const apiKey = 'sk-!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const result = await service.setCredential('test', apiKey);

      expect(result.success).toBe(true);

      const retrieved = await service.getCredential('test');
      expect(retrieved).toBe(apiKey);
    });

    it('should handle unicode characters in API key', async () => {
      const apiKey = 'sk-key-测试-🔑';
      const result = await service.setCredential('test', apiKey);

      expect(result.success).toBe(true);

      const retrieved = await service.getCredential('test');
      expect(retrieved).toBe(apiKey);
    });

    it('should handle very long API keys', async () => {
      const longKey = 'sk-' + 'x'.repeat(1000);
      const result = await service.setCredential('test', longKey);

      expect(result.success).toBe(true);
      expect(result.metadata.keyPreview).toBe('xxxx');
    });

    it('should handle provider IDs with special characters', async () => {
      const providerId = 'custom-provider-123_test';
      const result = await service.setCredential(providerId, 'key');

      expect(result.success).toBe(true);

      const retrieved = await service.getCredential(providerId);
      expect(retrieved).toBe('key');
    });

    it('should handle concurrent set operations', async () => {
      const promises = [
        service.setCredential('provider1', 'key1'),
        service.setCredential('provider2', 'key2'),
        service.setCredential('provider3', 'key3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.success).toBe(true));
    });

    it('should handle non-Error thrown objects', async () => {
      mockSafeStorage.encryptString.mockImplementation(() => {
        throw 'string error';
      });

      await expect(service.setCredential('test', 'key')).rejects.toThrow(
        CredentialStorageError
      );
    });
  });

  // ===========================================================================
  // Storage Type Tests
  // ===========================================================================

  describe('storage type behavior', () => {
    it('should use persistent storage when available', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
      service = new CredentialService();

      expect(service.getStorageType()).toBe('persistent');
      expect(service.isAvailable()).toBe(true);
    });

    it('should use session storage when unavailable', () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      service = new CredentialService();

      expect(service.getStorageType()).toBe('session');
      expect(service.isAvailable()).toBe(false);
    });

    it('should not persist session credentials', async () => {
      mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
      service = new CredentialService();

      await service.setCredential('test', 'key');

      expect(mockStore.set).not.toHaveBeenCalled();
    });
  });
});
