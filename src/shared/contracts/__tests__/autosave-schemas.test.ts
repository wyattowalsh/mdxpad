/**
 * Tests for autosave-schemas Zod validation.
 *
 * Tests DocumentId, AutosaveSettings, RecoveryFile, Manifest,
 * RecoveryDialog types, ConflictResolution, AutosaveStatus,
 * and exported constants.
 */

import { describe, it, expect } from 'vitest';

const uuidv4 = () => crypto.randomUUID();
import {
  DocumentIdSchema,
  AutosaveSettingsSchema,
  DEFAULT_AUTOSAVE_SETTINGS,
  RecoveryFileSchema,
  ManifestEntrySchema,
  RecoveryManifestSchema,
  EMPTY_RECOVERY_MANIFEST,
  RecoveryDialogEntrySchema,
  RecoveryDecisionSchema,
  FileConflictSchema,
  ConflictResolutionSchema,
  AutosaveStatusSchema,
  FAILURE_TOAST_THRESHOLD,
} from '../autosave-schemas';

// =============================================================================
// BASE TYPES
// =============================================================================

describe('DocumentIdSchema', () => {
  it('should accept valid UUID v4', () => {
    expect(DocumentIdSchema.safeParse(uuidv4()).success).toBe(true);
  });

  it('should reject non-UUID', () => {
    expect(DocumentIdSchema.safeParse('not-uuid').success).toBe(false);
  });
});

// =============================================================================
// AUTOSAVE SETTINGS
// =============================================================================

describe('AutosaveSettingsSchema', () => {
  it('should accept default settings', () => {
    expect(AutosaveSettingsSchema.safeParse(DEFAULT_AUTOSAVE_SETTINGS).success).toBe(true);
  });

  it('should accept minimum interval (5000ms)', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, intervalMs: 5000 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('should accept maximum interval (600000ms)', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, intervalMs: 600000 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it('should reject interval below minimum', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, intervalMs: 4999 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('should reject interval above maximum', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, intervalMs: 600001 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('should reject non-integer interval', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, intervalMs: 5000.5 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('should reject retention days below 1', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, retentionDays: 0 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('should reject max files below 5', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, maxFiles: 4 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('should reject max storage below 10MB', () => {
    const settings = { ...DEFAULT_AUTOSAVE_SETTINGS, maxStorageMB: 9 };
    expect(AutosaveSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe('DEFAULT_AUTOSAVE_SETTINGS', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_AUTOSAVE_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_AUTOSAVE_SETTINGS.intervalMs).toBe(30000);
    expect(DEFAULT_AUTOSAVE_SETTINGS.retentionDays).toBe(30);
    expect(DEFAULT_AUTOSAVE_SETTINGS.maxFiles).toBe(50);
    expect(DEFAULT_AUTOSAVE_SETTINGS.maxStorageMB).toBe(100);
  });
});

// =============================================================================
// RECOVERY FILE
// =============================================================================

describe('RecoveryFileSchema', () => {
  const validRecoveryFile = {
    version: 1 as const,
    documentId: uuidv4(),
    filePath: '/test.mdx',
    fileName: 'test.mdx',
    content: '# Hello',
    savedAt: Date.now(),
    checksum: 'a'.repeat(64),
  };

  it('should accept valid recovery file', () => {
    expect(RecoveryFileSchema.safeParse(validRecoveryFile).success).toBe(true);
  });

  it('should accept null file path for untitled', () => {
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, filePath: null }).success).toBe(
      true
    );
  });

  it('should reject wrong version', () => {
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, version: 2 }).success).toBe(false);
  });

  it('should reject empty fileName', () => {
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, fileName: '' }).success).toBe(
      false
    );
  });

  it('should reject checksum with wrong length', () => {
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, checksum: 'short' }).success).toBe(
      false
    );
  });

  it('should reject non-positive savedAt', () => {
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, savedAt: 0 }).success).toBe(false);
    expect(RecoveryFileSchema.safeParse({ ...validRecoveryFile, savedAt: -1 }).success).toBe(false);
  });
});

// =============================================================================
// MANIFEST
// =============================================================================

describe('ManifestEntrySchema', () => {
  it('should accept valid entry', () => {
    const result = ManifestEntrySchema.safeParse({
      documentId: uuidv4(),
      filePath: '/test.mdx',
      fileName: 'test.mdx',
      savedAt: Date.now(),
      recoveryFilePath: 'abc123.json',
    });
    expect(result.success).toBe(true);
  });
});

describe('RecoveryManifestSchema', () => {
  it('should accept empty manifest', () => {
    expect(RecoveryManifestSchema.safeParse(EMPTY_RECOVERY_MANIFEST).success).toBe(true);
  });

  it('should accept manifest with entries', () => {
    const docId = uuidv4();
    const manifest = {
      version: 1 as const,
      entries: {
        [docId]: {
          documentId: docId,
          filePath: '/test.mdx',
          fileName: 'test.mdx',
          savedAt: Date.now(),
          recoveryFilePath: `${docId}.json`,
        },
      },
    };
    expect(RecoveryManifestSchema.safeParse(manifest).success).toBe(true);
  });
});

describe('EMPTY_RECOVERY_MANIFEST', () => {
  it('should have version 1 and empty entries', () => {
    expect(EMPTY_RECOVERY_MANIFEST.version).toBe(1);
    expect(EMPTY_RECOVERY_MANIFEST.entries).toEqual({});
  });
});

// =============================================================================
// RECOVERY DIALOG
// =============================================================================

describe('RecoveryDialogEntrySchema', () => {
  it('should accept valid entry', () => {
    const result = RecoveryDialogEntrySchema.safeParse({
      documentId: uuidv4(),
      fileName: 'test.mdx',
      filePath: '/test.mdx',
      savedAt: Date.now(),
      contentPreview: '# Hello World',
      isValid: true,
      hasConflict: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('RecoveryDecisionSchema', () => {
  it('should accept "accept" with selected IDs', () => {
    const result = RecoveryDecisionSchema.safeParse({
      action: 'accept',
      selectedIds: [uuidv4()],
    });
    expect(result.success).toBe(true);
  });

  it('should accept "decline"', () => {
    expect(RecoveryDecisionSchema.safeParse({ action: 'decline' }).success).toBe(true);
  });

  it('should accept "dismiss"', () => {
    expect(RecoveryDecisionSchema.safeParse({ action: 'dismiss' }).success).toBe(true);
  });

  it('should reject unknown action', () => {
    expect(RecoveryDecisionSchema.safeParse({ action: 'unknown' }).success).toBe(false);
  });
});

// =============================================================================
// CONFLICT RESOLUTION
// =============================================================================

describe('FileConflictSchema', () => {
  it('should accept valid conflict', () => {
    const result = FileConflictSchema.safeParse({
      documentId: uuidv4(),
      filePath: '/test.mdx',
      recoveryContent: '# Recovery',
      diskContent: '# Disk',
      recoveryTimestamp: Date.now() - 1000,
      diskModifiedAt: Date.now(),
    });
    expect(result.success).toBe(true);
  });
});

describe('ConflictResolutionSchema', () => {
  it('should accept "recovery" choice', () => {
    const result = ConflictResolutionSchema.safeParse({
      choice: 'recovery',
      documentId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept "disk" choice', () => {
    const result = ConflictResolutionSchema.safeParse({
      choice: 'disk',
      documentId: uuidv4(),
    });
    expect(result.success).toBe(true);
  });

  it('should accept "save-as" choice with newPath', () => {
    const result = ConflictResolutionSchema.safeParse({
      choice: 'save-as',
      documentId: uuidv4(),
      newPath: '/test-recovered.mdx',
    });
    expect(result.success).toBe(true);
  });

  it('should reject "save-as" without newPath', () => {
    const result = ConflictResolutionSchema.safeParse({
      choice: 'save-as',
      documentId: uuidv4(),
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// AUTOSAVE STATUS
// =============================================================================

describe('AutosaveStatusSchema', () => {
  it('should accept idle status', () => {
    expect(AutosaveStatusSchema.safeParse({ status: 'idle' }).success).toBe(true);
  });

  it('should accept saving status', () => {
    expect(AutosaveStatusSchema.safeParse({ status: 'saving' }).success).toBe(true);
  });

  it('should accept saved status with timestamp', () => {
    expect(AutosaveStatusSchema.safeParse({ status: 'saved', savedAt: Date.now() }).success).toBe(
      true
    );
  });

  it('should reject saved status without timestamp', () => {
    expect(AutosaveStatusSchema.safeParse({ status: 'saved' }).success).toBe(false);
  });

  it('should accept failed status', () => {
    const result = AutosaveStatusSchema.safeParse({
      status: 'failed',
      consecutiveFailures: 3,
      lastError: 'Disk full',
    });
    expect(result.success).toBe(true);
  });

  it('should reject failed status with 0 failures', () => {
    const result = AutosaveStatusSchema.safeParse({
      status: 'failed',
      consecutiveFailures: 0,
      lastError: 'Error',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// CONSTANTS
// =============================================================================

describe('FAILURE_TOAST_THRESHOLD', () => {
  it('should be 3', () => {
    expect(FAILURE_TOAST_THRESHOLD).toBe(3);
  });
});
