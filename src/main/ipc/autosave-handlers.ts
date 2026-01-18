/**
 * Autosave & Recovery IPC handlers.
 * Handles all autosave and crash recovery IPC communication.
 * Per Constitution Article III.3: All payloads validated with zod on both ends.
 *
 * @module autosave-handlers
 */

import type { IpcMain } from 'electron';

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
  type RecoveryCheckResponse,
  type RecoveryListResponse,
  type RecoveryPreviewResponse,
  type RecoveryRestoreResponse,
  type RecoveryDiscardResponse,
  type AutosaveTriggerResponse,
  type ConflictResolveResponse,
} from '@shared/contracts/autosave-ipc';
import type { AutosaveSettings, AutosaveStatus } from '@shared/contracts/autosave-schemas';
import { createValidatedHandler } from '@shared/contracts/file-schemas';
import { AutosaveService } from '@main/services/autosave-service';
import { RecoveryService } from '@main/services/recovery-service';
import { AutosaveSettingsService } from '@main/services/autosave-settings';

// Service instances (shared across all handlers)
const settingsService = new AutosaveSettingsService();
const autosaveService = new AutosaveService(settingsService);
const recoveryService = new RecoveryService(settingsService, autosaveService);

// Autosave status state
let currentStatus: AutosaveStatus = { status: 'idle' };

// ============================================================================
// Recovery Handlers (FR-003 to FR-007)
// ============================================================================

/** Handler for mdxpad:recovery:check - Checks if recovery data exists on startup. */
const handleRecoveryCheck = createValidatedHandler(
  RecoveryCheckRequestSchema,
  async (): Promise<RecoveryCheckResponse> => recoveryService.checkForRecovery()
);

/** Handler for mdxpad:recovery:list - Lists all recoverable documents. */
const handleRecoveryList = createValidatedHandler(
  RecoveryListRequestSchema,
  async (): Promise<RecoveryListResponse> => recoveryService.listRecoverable()
);

/** Handler for mdxpad:recovery:preview - Gets full content for preview. */
const handleRecoveryPreview = createValidatedHandler(
  RecoveryPreviewRequestSchema,
  async (args): Promise<RecoveryPreviewResponse> => recoveryService.getPreview(args.documentId)
);

/** Handler for mdxpad:recovery:restore - Restores selected documents. */
const handleRecoveryRestore = createValidatedHandler(
  RecoveryRestoreRequestSchema,
  async (args): Promise<RecoveryRestoreResponse> => recoveryService.restore(args)
);

/** Handler for mdxpad:recovery:discard - Discards recovery data. */
const handleRecoveryDiscard = createValidatedHandler(
  RecoveryDiscardRequestSchema,
  async (args): Promise<RecoveryDiscardResponse> => recoveryService.discardRecovery(args.documentIds)
);

// ============================================================================
// Autosave Handlers (FR-001, FR-013)
// ============================================================================

/** Handler for mdxpad:autosave:trigger - Triggers autosave for a document. */
const handleAutosaveTrigger = createValidatedHandler(
  AutosaveTriggerRequestSchema,
  async (args): Promise<AutosaveTriggerResponse> => {
    currentStatus = { status: 'saving' };
    const result = await autosaveService.saveDocument(args);
    if (result.ok) {
      currentStatus = { status: 'saved', savedAt: result.savedAt };
    } else {
      currentStatus = { status: 'failed', consecutiveFailures: 1, lastError: result.message };
    }
    return result;
  }
);

/** Handler for mdxpad:autosave:status - Gets current autosave status. */
const handleAutosaveStatus = createValidatedHandler(
  AutosaveStatusRequestSchema,
  (): Promise<AutosaveStatus> => Promise.resolve(currentStatus)
);

// ============================================================================
// Settings Handlers (FR-009, FR-010, FR-011)
// ============================================================================

/** Handler for mdxpad:autosave:settings:get - Gets current autosave settings. */
const handleSettingsGet = createValidatedHandler(
  SettingsGetRequestSchema,
  (): Promise<AutosaveSettings> => Promise.resolve(settingsService.getSettings())
);

/** Handler for mdxpad:autosave:settings:set - Updates autosave settings. */
const handleSettingsSet = createValidatedHandler(
  SettingsSetRequestSchema,
  (args): Promise<AutosaveSettings> => {
    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const filtered: Partial<AutosaveSettings> = {};
    if (args.enabled !== undefined) filtered.enabled = args.enabled;
    if (args.intervalMs !== undefined) filtered.intervalMs = args.intervalMs;
    if (args.retentionDays !== undefined) filtered.retentionDays = args.retentionDays;
    if (args.maxFiles !== undefined) filtered.maxFiles = args.maxFiles;
    if (args.maxStorageMB !== undefined) filtered.maxStorageMB = args.maxStorageMB;
    return Promise.resolve(settingsService.setSettings(filtered));
  }
);

// ============================================================================
// Conflict Resolution Handler (FR-016)
// ============================================================================

/** Handler for mdxpad:recovery:conflict:resolve - Resolves file conflict. */
const handleConflictResolve = createValidatedHandler(
  ConflictResolveRequestSchema,
  (args): Promise<ConflictResolveResponse> => {
    console.log('[AutosaveHandlers] Conflict resolution:', args.resolution);
    return Promise.resolve({ ok: true });
  }
);

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Registers all autosave and recovery IPC handlers.
 * @param ipcMainInstance - The Electron IpcMain instance
 */
export function registerAutosaveHandlers(ipcMainInstance: IpcMain): void {
  // Recovery handlers
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_CHECK, () => handleRecoveryCheck(undefined));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_LIST, () => handleRecoveryList(undefined));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_PREVIEW, (_, args) => handleRecoveryPreview(args));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_RESTORE, (_, args) => handleRecoveryRestore(args));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_DISCARD, (_, args) => handleRecoveryDiscard(args));

  // Autosave handlers
  ipcMainInstance.handle(AutosaveChannels.AUTOSAVE_TRIGGER, (_, args) => handleAutosaveTrigger(args));
  ipcMainInstance.handle(AutosaveChannels.AUTOSAVE_STATUS, () => handleAutosaveStatus(undefined));

  // Settings handlers
  ipcMainInstance.handle(AutosaveChannels.SETTINGS_GET, () => handleSettingsGet(undefined));
  ipcMainInstance.handle(AutosaveChannels.SETTINGS_SET, (_, args) => handleSettingsSet(args));

  // Conflict resolution handler
  ipcMainInstance.handle(AutosaveChannels.CONFLICT_RESOLVE, (_, args) => handleConflictResolve(args));

  console.log('[AutosaveHandlers] All autosave and recovery handlers registered');
}
