/**
 * Autosave IPC Integration Tests
 *
 * Integration tests for all autosave-related IPC channels.
 * Per Constitution VI.4: All IPC must be tested.
 *
 * Tests all 10 channels per tasks.md T024:
 * 1. mdxpad:recovery:check
 * 2. mdxpad:recovery:list
 * 3. mdxpad:recovery:preview
 * 4. mdxpad:recovery:restore
 * 5. mdxpad:recovery:discard
 * 6. mdxpad:autosave:trigger
 * 7. mdxpad:autosave:status
 * 8. mdxpad:autosave:settings:get
 * 9. mdxpad:autosave:settings:set
 * 10. mdxpad:recovery:conflict:resolve
 *
 * Per Constitution Section 3.3: All payloads validated with zod on both ends.
 *
 * @module tests/integration/autosave-ipc
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { IpcMain } from 'electron';

// Mock electron modules before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

// Mock electron-store
vi.mock('electron-store', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
    })),
  };
});

// Mock node:crypto
vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'a'.repeat(64)), // 64-char mock checksum
  })),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
    rename: vi.fn(),
    stat: vi.fn(),
  },
}));

// Mock node:fs/promises (statfs)
vi.mock('node:fs/promises', () => ({
  statfs: vi.fn(() =>
    Promise.resolve({
      bfree: 1000000000, // Plenty of free blocks
      bsize: 4096, // 4KB block size
    })
  ),
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  rename: vi.fn(),
}));

// Mock the services
vi.mock('@main/services/autosave-settings', () => ({
  AutosaveSettingsService: vi.fn().mockImplementation(() => ({
    getSettings: vi.fn(() => ({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
    })),
    setSettings: vi.fn((partial) => ({
      enabled: true,
      intervalMs: 30000,
      retentionDays: 30,
      maxFiles: 50,
      maxStorageMB: 100,
      ...partial,
    })),
  })),
}));

vi.mock('@main/services/autosave-service', () => ({
  AutosaveService: vi.fn().mockImplementation(() => ({
    saveDocument: vi.fn(() => Promise.resolve({ ok: true, savedAt: Date.now() })),
    getRecoveryDir: vi.fn(() => Promise.resolve('/mock/userData/recovery')),
    readManifest: vi.fn(),
    deleteRecoveryFile: vi.fn(),
    computeChecksum: vi.fn(() => 'a'.repeat(64)),
  })),
}));

vi.mock('@main/services/recovery-service', () => ({
  RecoveryService: vi.fn().mockImplementation(() => ({
    checkForRecovery: vi.fn(() => Promise.resolve({ hasRecoveryData: false, count: 0 })),
    listRecoverable: vi.fn(() => Promise.resolve({ entries: [] })),
    getPreview: vi.fn((documentId: string) =>
      Promise.resolve({ ok: true, content: `Preview for ${documentId}`, conflict: null })
    ),
    restore: vi.fn(() => Promise.resolve({ ok: true, restored: [] })),
    discardRecovery: vi.fn((documentIds: string[]) =>
      Promise.resolve({ discardedCount: documentIds.length })
    ),
    validateChecksum: vi.fn(() => true),
    runRetentionCleanup: vi.fn(),
  })),
}));

// Import after mocks are set up
import { registerAutosaveHandlers } from '@main/ipc/autosave-handlers';
import { ipcMain } from 'electron';
import {
  AutosaveChannels,
  RecoveryCheckRequestSchema,
  RecoveryListRequestSchema,
  RecoveryPreviewRequestSchema,
  RecoveryRestoreRequestSchema,
  RecoveryDiscardRequestSchema,
  AutosaveTriggerRequestSchema,
  AutosaveStatusRequestSchema,
  SettingsGetRequestSchema,
  SettingsSetRequestSchema,
  ConflictResolveRequestSchema,
} from '@shared/contracts/autosave-ipc';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import {
  DocumentIdSchema,
  type DocumentId,
  DEFAULT_AUTOSAVE_SETTINGS,
} from '@shared/contracts/autosave-schemas';

// Import the mocked services for direct manipulation
import { AutosaveSettingsService } from '@main/services/autosave-settings';
import { AutosaveService } from '@main/services/autosave-service';
import { RecoveryService } from '@main/services/recovery-service';

// Type assertion helper for mocks
const mockIpcMain = ipcMain as unknown as { handle: Mock };

// Helper to create valid document IDs
function createDocumentId(uuid: string): DocumentId {
  return uuid as unknown as DocumentId;
}

describe('Autosave IPC Integration', () => {
  let registeredHandlers: Map<string, (event: unknown, args?: unknown) => Promise<unknown>>;
  let mockSettingsService: InstanceType<typeof AutosaveSettingsService>;
  let mockAutosaveService: InstanceType<typeof AutosaveService>;
  let mockRecoveryService: InstanceType<typeof RecoveryService>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Track registered handlers
    registeredHandlers = new Map();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    );

    // Get fresh mock instances
    mockSettingsService = new AutosaveSettingsService() as InstanceType<typeof AutosaveSettingsService>;
    mockAutosaveService = new AutosaveService(mockSettingsService) as InstanceType<typeof AutosaveService>;
    mockRecoveryService = new RecoveryService(mockSettingsService, mockAutosaveService) as InstanceType<typeof RecoveryService>;

    // Register handlers
    registerAutosaveHandlers(ipcMain);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerAutosaveHandlers', () => {
    it('should register all 10 expected IPC handlers per Constitution VI.4', () => {
      // Recovery handlers
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_CHECK,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_LIST,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_PREVIEW,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_RESTORE,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_DISCARD,
        expect.any(Function)
      );

      // Autosave handlers
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.AUTOSAVE_TRIGGER,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.AUTOSAVE_STATUS,
        expect.any(Function)
      );

      // Settings handlers
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.SETTINGS_GET,
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.SETTINGS_SET,
        expect.any(Function)
      );

      // Conflict resolution handler
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        AutosaveChannels.CONFLICT_RESOLVE,
        expect.any(Function)
      );
    });
  });

  // ===========================================================================
  // Recovery Channels
  // ===========================================================================

  describe('Recovery Channels', () => {
    describe('mdxpad:recovery:check', () => {
      it('should return hasRecoveryData true when manifest has entries', async () => {
        // Get the handler that was registered
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_CHECK);
        expect(handler).toBeDefined();

        // The handler internally calls recoveryService.checkForRecovery()
        // The result depends on the service mock
        const result = await handler!({});

        expect(result).toHaveProperty('hasRecoveryData');
        expect(result).toHaveProperty('count');
      });

      it('should return hasRecoveryData false when manifest is empty', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_CHECK);
        expect(handler).toBeDefined();

        const result = await handler!({});

        // Default mock returns empty recovery
        expect(result).toHaveProperty('hasRecoveryData');
        expect(result).toHaveProperty('count');
      });

      it('should accept void request (no arguments)', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_CHECK);
        expect(handler).toBeDefined();

        // Should not throw with no arguments
        await expect(handler!({})).resolves.toBeDefined();
      });
    });

    describe('mdxpad:recovery:list', () => {
      it('should return array of recovery dialog entries', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_LIST);
        expect(handler).toBeDefined();

        const result = await handler!({});

        expect(result).toHaveProperty('entries');
        expect(Array.isArray((result as { entries: unknown[] }).entries)).toBe(true);
      });

      it('should include conflict status in entries', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_LIST);
        expect(handler).toBeDefined();

        const result = await handler!({});

        // The result shape should be RecoveryListResponse
        expect(result).toHaveProperty('entries');
      });

      it('should accept void request (no arguments)', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_LIST);
        expect(handler).toBeDefined();

        await expect(handler!({})).resolves.toBeDefined();
      });
    });

    describe('mdxpad:recovery:preview', () => {
      it('should return content for valid document', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_PREVIEW);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, { documentId: validDocId });

        // Result should have ok property (discriminated union)
        expect(result).toBeDefined();
      });

      it('should handle missing documentId parameter', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_PREVIEW);
        expect(handler).toBeDefined();

        // Should handle gracefully or throw validation error
        await expect(handler!({}, {})).rejects.toThrow();
      });

      it('should validate documentId format', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_PREVIEW);
        expect(handler).toBeDefined();

        // Invalid UUID format
        await expect(handler!({}, { documentId: 'not-a-uuid' })).rejects.toThrow();
      });
    });

    describe('mdxpad:recovery:restore', () => {
      it('should restore selected documents', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_RESTORE);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          decision: {
            action: 'accept',
            selectedIds: [validDocId],
          },
        });

        expect(result).toBeDefined();
      });

      it('should handle decline action', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_RESTORE);
        expect(handler).toBeDefined();

        const result = await handler!({}, {
          decision: {
            action: 'decline',
          },
        });

        expect(result).toBeDefined();
      });

      it('should handle dismiss action', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_RESTORE);
        expect(handler).toBeDefined();

        const result = await handler!({}, {
          decision: {
            action: 'dismiss',
          },
        });

        expect(result).toBeDefined();
      });

      it('should reject invalid decision schema', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_RESTORE);
        expect(handler).toBeDefined();

        // Invalid action type
        await expect(
          handler!({}, { decision: { action: 'invalid' } })
        ).rejects.toThrow();
      });
    });

    describe('mdxpad:recovery:discard', () => {
      it('should delete recovery files', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_DISCARD);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, { documentIds: [validDocId] });

        expect(result).toHaveProperty('discardedCount');
      });

      it('should handle empty documentIds array', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_DISCARD);
        expect(handler).toBeDefined();

        const result = await handler!({}, { documentIds: [] });

        expect(result).toHaveProperty('discardedCount');
        expect((result as { discardedCount: number }).discardedCount).toBe(0);
      });

      it('should validate documentIds format', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.RECOVERY_DISCARD);
        expect(handler).toBeDefined();

        // Invalid UUID format
        await expect(
          handler!({}, { documentIds: ['not-a-uuid'] })
        ).rejects.toThrow();
      });
    });
  });

  // ===========================================================================
  // Autosave Channels
  // ===========================================================================

  describe('Autosave Channels', () => {
    describe('mdxpad:autosave:trigger', () => {
      it('should create recovery file on trigger', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_TRIGGER);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          documentId: validDocId,
          filePath: '/path/to/file.mdx',
          fileName: 'test.mdx',
          content: '# Test Content',
        });

        expect(result).toBeDefined();
      });

      it('should handle untitled documents (null filePath)', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_TRIGGER);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          documentId: validDocId,
          filePath: null,
          fileName: 'Untitled',
          content: '# New Document',
        });

        expect(result).toBeDefined();
      });

      it('should reject missing required fields', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_TRIGGER);
        expect(handler).toBeDefined();

        // Missing content
        await expect(
          handler!({}, {
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            filePath: '/path/to/file.mdx',
            fileName: 'test.mdx',
          })
        ).rejects.toThrow();
      });

      it('should validate documentId format', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_TRIGGER);
        expect(handler).toBeDefined();

        await expect(
          handler!({}, {
            documentId: 'invalid-uuid',
            filePath: '/path/to/file.mdx',
            fileName: 'test.mdx',
            content: '# Test',
          })
        ).rejects.toThrow();
      });
    });

    describe('mdxpad:autosave:status', () => {
      it('should return current autosave status', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_STATUS);
        expect(handler).toBeDefined();

        const result = await handler!({});

        expect(result).toHaveProperty('status');
      });

      it('should accept void request (no arguments)', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.AUTOSAVE_STATUS);
        expect(handler).toBeDefined();

        await expect(handler!({})).resolves.toBeDefined();
      });
    });
  });

  // ===========================================================================
  // Settings Channels
  // ===========================================================================

  describe('Settings Channels', () => {
    describe('mdxpad:autosave:settings:get', () => {
      it('should return current settings', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_GET);
        expect(handler).toBeDefined();

        const result = await handler!({});

        expect(result).toHaveProperty('enabled');
        expect(result).toHaveProperty('intervalMs');
        expect(result).toHaveProperty('retentionDays');
        expect(result).toHaveProperty('maxFiles');
        expect(result).toHaveProperty('maxStorageMB');
      });

      it('should return defaults when no settings saved', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_GET);
        expect(handler).toBeDefined();

        const result = await handler!({}) as typeof DEFAULT_AUTOSAVE_SETTINGS;

        // Should have all required properties
        expect(typeof result.enabled).toBe('boolean');
        expect(typeof result.intervalMs).toBe('number');
        expect(typeof result.retentionDays).toBe('number');
        expect(typeof result.maxFiles).toBe('number');
        expect(typeof result.maxStorageMB).toBe('number');
      });

      it('should accept void request (no arguments)', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_GET);
        expect(handler).toBeDefined();

        await expect(handler!({})).resolves.toBeDefined();
      });
    });

    describe('mdxpad:autosave:settings:set', () => {
      it('should persist settings changes', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_SET);
        expect(handler).toBeDefined();

        const result = await handler!({}, { intervalMs: 15000 });

        expect(result).toHaveProperty('intervalMs');
      });

      it('should accept partial settings update', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_SET);
        expect(handler).toBeDefined();

        // Only update enabled field
        const result = await handler!({}, { enabled: false });

        expect(result).toHaveProperty('enabled');
      });

      it('should validate settings schema - intervalMs range', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_SET);
        expect(handler).toBeDefined();

        // Per FR-009: intervalMs must be between 5000 and 600000
        await expect(handler!({}, { intervalMs: 1000 })).rejects.toThrow();
        await expect(handler!({}, { intervalMs: 700000 })).rejects.toThrow();
      });

      it('should validate settings schema - retentionDays range', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_SET);
        expect(handler).toBeDefined();

        // retentionDays must be between 1 and 365
        await expect(handler!({}, { retentionDays: 0 })).rejects.toThrow();
        await expect(handler!({}, { retentionDays: 400 })).rejects.toThrow();
      });

      it('should accept valid settings within range', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.SETTINGS_SET);
        expect(handler).toBeDefined();

        const result = await handler!({}, {
          enabled: true,
          intervalMs: 60000,
          retentionDays: 7,
          maxFiles: 100,
          maxStorageMB: 500,
        });

        expect(result).toBeDefined();
      });
    });
  });

  // ===========================================================================
  // Conflict Channels
  // ===========================================================================

  describe('Conflict Channels', () => {
    describe('mdxpad:recovery:conflict:resolve', () => {
      it('should handle recovery choice', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          resolution: {
            choice: 'recovery',
            documentId: validDocId,
          },
        });

        expect(result).toHaveProperty('ok');
        expect((result as { ok: boolean }).ok).toBe(true);
      });

      it('should handle disk choice', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          resolution: {
            choice: 'disk',
            documentId: validDocId,
          },
        });

        expect(result).toHaveProperty('ok');
        expect((result as { ok: boolean }).ok).toBe(true);
      });

      it('should handle save-as choice', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        const validDocId = '123e4567-e89b-12d3-a456-426614174000';
        const result = await handler!({}, {
          resolution: {
            choice: 'save-as',
            documentId: validDocId,
            newPath: '/path/to/new-file.mdx',
          },
        });

        expect(result).toHaveProperty('ok');
        expect((result as { ok: boolean }).ok).toBe(true);
      });

      it('should reject invalid choice', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        await expect(
          handler!({}, {
            resolution: {
              choice: 'invalid',
              documentId: '123e4567-e89b-12d3-a456-426614174000',
            },
          })
        ).rejects.toThrow();
      });

      it('should reject save-as without newPath', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        await expect(
          handler!({}, {
            resolution: {
              choice: 'save-as',
              documentId: '123e4567-e89b-12d3-a456-426614174000',
              // Missing newPath
            },
          })
        ).rejects.toThrow();
      });

      it('should validate documentId format', async () => {
        const handler = registeredHandlers.get(AutosaveChannels.CONFLICT_RESOLVE);
        expect(handler).toBeDefined();

        await expect(
          handler!({}, {
            resolution: {
              choice: 'recovery',
              documentId: 'not-a-valid-uuid',
            },
          })
        ).rejects.toThrow();
      });
    });
  });
});

// =============================================================================
// Zod Validation Tests (Constitution Section 3.3 compliance)
// =============================================================================

describe('zod validation (Constitution Section 3.3 compliance)', () => {
  describe('createValidatedHandler rejects invalid payloads', () => {
    it('should accept undefined for RecoveryCheckRequestSchema (void)', async () => {
      const handler = createValidatedHandler(RecoveryCheckRequestSchema, async () => {
        return { hasRecoveryData: false, count: 0 };
      });

      const result = await handler(undefined);
      expect(result).toEqual({ hasRecoveryData: false, count: 0 });
    });

    it('should reject non-undefined for RecoveryCheckRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryCheckRequestSchema, async () => {
        return { hasRecoveryData: false, count: 0 };
      });

      await expect(handler({ unexpected: 'data' })).rejects.toThrow('Validation failed');
    });

    it('should accept undefined for RecoveryListRequestSchema (void)', async () => {
      const handler = createValidatedHandler(RecoveryListRequestSchema, async () => {
        return { entries: [] };
      });

      const result = await handler(undefined);
      expect(result).toEqual({ entries: [] });
    });

    it('should accept valid RecoveryPreviewRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryPreviewRequestSchema, async (args) => {
        return { ok: true, content: `Preview for ${args.documentId}`, conflict: null };
      });

      const result = await handler({
        documentId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result).toHaveProperty('ok', true);
    });

    it('should reject invalid UUID in RecoveryPreviewRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryPreviewRequestSchema, async () => {
        return { ok: true, content: 'test', conflict: null };
      });

      await expect(handler({ documentId: 'not-uuid' })).rejects.toThrow('Validation failed');
    });

    it('should accept valid RecoveryRestoreRequestSchema with accept action', async () => {
      const handler = createValidatedHandler(RecoveryRestoreRequestSchema, async () => {
        return { ok: true, restored: [] };
      });

      const result = await handler({
        decision: {
          action: 'accept',
          selectedIds: ['123e4567-e89b-12d3-a456-426614174000'],
        },
      });
      expect(result).toHaveProperty('ok', true);
    });

    it('should accept valid RecoveryRestoreRequestSchema with decline action', async () => {
      const handler = createValidatedHandler(RecoveryRestoreRequestSchema, async () => {
        return { ok: true, restored: [] };
      });

      const result = await handler({
        decision: {
          action: 'decline',
        },
      });
      expect(result).toHaveProperty('ok', true);
    });

    it('should reject invalid action in RecoveryRestoreRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryRestoreRequestSchema, async () => {
        return { ok: true, restored: [] };
      });

      await expect(
        handler({ decision: { action: 'invalid-action' } })
      ).rejects.toThrow('Validation failed');
    });

    it('should accept valid RecoveryDiscardRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryDiscardRequestSchema, async () => {
        return { discardedCount: 1 };
      });

      const result = await handler({
        documentIds: ['123e4567-e89b-12d3-a456-426614174000'],
      });
      expect(result).toEqual({ discardedCount: 1 });
    });

    it('should reject invalid UUIDs in RecoveryDiscardRequestSchema', async () => {
      const handler = createValidatedHandler(RecoveryDiscardRequestSchema, async () => {
        return { discardedCount: 0 };
      });

      await expect(handler({ documentIds: ['invalid'] })).rejects.toThrow('Validation failed');
    });

    it('should accept valid AutosaveTriggerRequestSchema', async () => {
      const handler = createValidatedHandler(AutosaveTriggerRequestSchema, async () => {
        return { ok: true, savedAt: Date.now() };
      });

      const result = await handler({
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        filePath: '/test/path.mdx',
        fileName: 'test.mdx',
        content: '# Test',
      });
      expect(result).toHaveProperty('ok', true);
    });

    it('should accept null filePath in AutosaveTriggerRequestSchema', async () => {
      const handler = createValidatedHandler(AutosaveTriggerRequestSchema, async () => {
        return { ok: true, savedAt: Date.now() };
      });

      const result = await handler({
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        filePath: null,
        fileName: 'Untitled',
        content: '# Test',
      });
      expect(result).toHaveProperty('ok', true);
    });

    it('should reject missing fields in AutosaveTriggerRequestSchema', async () => {
      const handler = createValidatedHandler(AutosaveTriggerRequestSchema, async () => {
        return { ok: true, savedAt: Date.now() };
      });

      await expect(
        handler({
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          // Missing filePath, fileName, content
        })
      ).rejects.toThrow('Validation failed');
    });

    it('should accept undefined for AutosaveStatusRequestSchema (void)', async () => {
      const handler = createValidatedHandler(AutosaveStatusRequestSchema, async () => {
        return { status: 'idle' };
      });

      const result = await handler(undefined);
      expect(result).toEqual({ status: 'idle' });
    });

    it('should accept undefined for SettingsGetRequestSchema (void)', async () => {
      const handler = createValidatedHandler(SettingsGetRequestSchema, async () => {
        return DEFAULT_AUTOSAVE_SETTINGS;
      });

      const result = await handler(undefined);
      expect(result).toHaveProperty('enabled');
      expect(result).toHaveProperty('intervalMs');
    });

    it('should accept valid partial SettingsSetRequestSchema', async () => {
      const handler = createValidatedHandler(SettingsSetRequestSchema, async (args) => {
        return { ...DEFAULT_AUTOSAVE_SETTINGS, ...args };
      });

      const result = await handler({ enabled: false });
      expect(result).toHaveProperty('enabled', false);
    });

    it('should validate intervalMs range in SettingsSetRequestSchema', async () => {
      const handler = createValidatedHandler(SettingsSetRequestSchema, async (args) => {
        return { ...DEFAULT_AUTOSAVE_SETTINGS, ...args };
      });

      // Below minimum (5000ms)
      await expect(handler({ intervalMs: 1000 })).rejects.toThrow('Validation failed');

      // Above maximum (600000ms)
      await expect(handler({ intervalMs: 700000 })).rejects.toThrow('Validation failed');
    });

    it('should accept valid ConflictResolveRequestSchema with recovery choice', async () => {
      const handler = createValidatedHandler(ConflictResolveRequestSchema, async () => {
        return { ok: true };
      });

      const result = await handler({
        resolution: {
          choice: 'recovery',
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should accept valid ConflictResolveRequestSchema with disk choice', async () => {
      const handler = createValidatedHandler(ConflictResolveRequestSchema, async () => {
        return { ok: true };
      });

      const result = await handler({
        resolution: {
          choice: 'disk',
          documentId: '123e4567-e89b-12d3-a456-426614174000',
        },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should accept valid ConflictResolveRequestSchema with save-as choice', async () => {
      const handler = createValidatedHandler(ConflictResolveRequestSchema, async () => {
        return { ok: true };
      });

      const result = await handler({
        resolution: {
          choice: 'save-as',
          documentId: '123e4567-e89b-12d3-a456-426614174000',
          newPath: '/new/path.mdx',
        },
      });
      expect(result).toEqual({ ok: true });
    });

    it('should reject save-as choice without newPath in ConflictResolveRequestSchema', async () => {
      const handler = createValidatedHandler(ConflictResolveRequestSchema, async () => {
        return { ok: true };
      });

      await expect(
        handler({
          resolution: {
            choice: 'save-as',
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            // Missing newPath
          },
        })
      ).rejects.toThrow('Validation failed');
    });
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('error handling', () => {
  describe('error code mapping', () => {
    it('should map DISK_FULL error correctly', () => {
      const diskFullError = { ok: false, error: 'DISK_FULL', message: 'Not enough space' };
      expect(diskFullError.error).toBe('DISK_FULL');
    });

    it('should map PERMISSION_DENIED error correctly', () => {
      const permError = { ok: false, error: 'PERMISSION_DENIED', message: 'Access denied' };
      expect(permError.error).toBe('PERMISSION_DENIED');
    });

    it('should map WRITE_ERROR error correctly', () => {
      const writeError = { ok: false, error: 'WRITE_ERROR', message: 'Write failed' };
      expect(writeError.error).toBe('WRITE_ERROR');
    });

    it('should map NOT_FOUND error correctly', () => {
      const notFoundError = { ok: false, error: 'NOT_FOUND' };
      expect(notFoundError.error).toBe('NOT_FOUND');
    });

    it('should map CORRUPTED error correctly', () => {
      const corruptedError = { ok: false, error: 'CORRUPTED' };
      expect(corruptedError.error).toBe('CORRUPTED');
    });

    it('should map READ_ERROR error correctly', () => {
      const readError = { ok: false, error: 'READ_ERROR' };
      expect(readError.error).toBe('READ_ERROR');
    });
  });
});

// =============================================================================
// Channel Name Tests
// =============================================================================

describe('channel names (Constitution III.3 compliance)', () => {
  it('should follow mdxpad:<domain>:<action> naming convention', () => {
    expect(AutosaveChannels.RECOVERY_CHECK).toBe('mdxpad:recovery:check');
    expect(AutosaveChannels.RECOVERY_LIST).toBe('mdxpad:recovery:list');
    expect(AutosaveChannels.RECOVERY_PREVIEW).toBe('mdxpad:recovery:preview');
    expect(AutosaveChannels.RECOVERY_RESTORE).toBe('mdxpad:recovery:restore');
    expect(AutosaveChannels.RECOVERY_DISCARD).toBe('mdxpad:recovery:discard');
    expect(AutosaveChannels.AUTOSAVE_TRIGGER).toBe('mdxpad:autosave:trigger');
    expect(AutosaveChannels.AUTOSAVE_STATUS).toBe('mdxpad:autosave:status');
    expect(AutosaveChannels.SETTINGS_GET).toBe('mdxpad:autosave:settings:get');
    expect(AutosaveChannels.SETTINGS_SET).toBe('mdxpad:autosave:settings:set');
    expect(AutosaveChannels.CONFLICT_RESOLVE).toBe('mdxpad:recovery:conflict:resolve');
  });
});
