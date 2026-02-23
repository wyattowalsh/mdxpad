/**
 * Recovery & Autosave API Preload Bridge Tests
 *
 * Tests for recovery, autosave, and settings operations
 * exposed to the renderer process.
 *
 * @module tests/unit/preload/recovery-api
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { recoveryOperations, autosaveOperations, settingsOperations } from '../recovery-api';
import { AutosaveChannels } from '@shared/contracts/autosave-ipc';

// ============================================================================
// Tests
// ============================================================================

describe('recoveryOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recoveryCheck', () => {
    it('should invoke recovery:check with no request', async () => {
      mockValidatedInvoke.mockResolvedValue({ hasRecoveryData: false, count: 0 });

      const result = await recoveryOperations.recoveryCheck();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_CHECK,
        null,
        expect.any(Object)
      );
      expect(result).toEqual({ hasRecoveryData: false, count: 0 });
    });
  });

  describe('recoveryList', () => {
    it('should invoke recovery:list and return entries', async () => {
      const entries = { entries: [{ id: 'doc-1', displayName: 'Test' }] };
      mockValidatedInvoke.mockResolvedValue(entries);

      const result = await recoveryOperations.recoveryList();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_LIST,
        null,
        expect.any(Object)
      );
      expect(result.entries).toHaveLength(1);
    });
  });

  describe('recoveryPreview', () => {
    it('should invoke recovery:preview with document ID', async () => {
      const preview = { content: '# Hello', documentId: 'doc-1' };
      mockValidatedInvoke.mockResolvedValue(preview);

      const result = await recoveryOperations.recoveryPreview({ documentId: 'doc-1' as never });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_PREVIEW,
        expect.any(Object),
        expect.any(Object),
        { documentId: 'doc-1' }
      );
      expect(result.content).toBe('# Hello');
    });
  });

  describe('recoveryRestore', () => {
    it('should invoke recovery:restore with request', async () => {
      mockValidatedInvoke.mockResolvedValue({ ok: true });

      const result = await recoveryOperations.recoveryRestore({
        documentIds: ['doc-1'] as never[],
      });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_RESTORE,
        expect.any(Object),
        expect.any(Object),
        { documentIds: ['doc-1'] }
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('recoveryDiscard', () => {
    it('should invoke recovery:discard with request', async () => {
      mockValidatedInvoke.mockResolvedValue({ discardedCount: 2 });

      await recoveryOperations.recoveryDiscard({
        documentIds: ['doc-1', 'doc-2'] as never[],
      });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.RECOVERY_DISCARD,
        expect.any(Object),
        expect.any(Object),
        { documentIds: ['doc-1', 'doc-2'] }
      );
    });
  });
});

describe('autosaveOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autosaveTrigger', () => {
    it('should invoke autosave:trigger with request', async () => {
      mockValidatedInvoke.mockResolvedValue({ triggered: true });

      await autosaveOperations.autosaveTrigger({
        documentId: 'doc-1' as never,
        content: '# Content',
        filePath: '/path/to/file.mdx',
      });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.AUTOSAVE_TRIGGER,
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          documentId: 'doc-1',
          content: '# Content',
        })
      );
    });
  });

  describe('autosaveStatus', () => {
    it('should invoke autosave:status with no request', async () => {
      mockValidatedInvoke.mockResolvedValue({ enabled: true, activeCount: 0 });

      const result = await autosaveOperations.autosaveStatus();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.AUTOSAVE_STATUS,
        null,
        expect.any(Object)
      );
      expect(result.enabled).toBe(true);
    });
  });

  describe('conflictResolve', () => {
    it('should invoke conflict:resolve with resolution', async () => {
      mockValidatedInvoke.mockResolvedValue({ resolved: true });

      await autosaveOperations.conflictResolve({
        documentId: 'doc-1' as never,
        resolution: 'keep-local' as never,
      });

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.CONFLICT_RESOLVE,
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          documentId: 'doc-1',
          resolution: 'keep-local',
        })
      );
    });
  });
});

describe('settingsOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('autosaveSettingsGet', () => {
    it('should invoke settings:get with no request', async () => {
      const settings = {
        enabled: true,
        intervalMs: 30000,
        retentionDays: 30,
        maxFiles: 50,
        maxStorageMB: 100,
      };
      mockValidatedInvoke.mockResolvedValue(settings);

      const result = await settingsOperations.autosaveSettingsGet();

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.SETTINGS_GET,
        null,
        expect.any(Object)
      );
      expect(result).toEqual(settings);
    });
  });

  describe('autosaveSettingsSet', () => {
    it('should invoke settings:set with settings', async () => {
      const settings = {
        enabled: false,
        intervalMs: 60000,
        retentionDays: 14,
        maxFiles: 25,
        maxStorageMB: 50,
      };
      mockValidatedInvoke.mockResolvedValue(settings);

      const result = await settingsOperations.autosaveSettingsSet(settings);

      expect(mockValidatedInvoke).toHaveBeenCalledWith(
        AutosaveChannels.SETTINGS_SET,
        expect.any(Object),
        expect.any(Object),
        settings
      );
      expect(result).toEqual(settings);
    });
  });
});
