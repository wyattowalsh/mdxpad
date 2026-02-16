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
import type { AutosaveService } from '@main/services/autosave-service';
import type { RecoveryService } from '@main/services/recovery-service';
import type { AutosaveSettingsService } from '@main/services/autosave-settings';

/**
 * Services container for dependency injection.
 * Holds instances of services required by autosave handlers.
 */
interface AutosaveHandlerServices {
  readonly settingsService: AutosaveSettingsService;
  readonly autosaveService: AutosaveService;
  readonly recoveryService: RecoveryService;
}

/**
 * Autosave status state.
 * Tracks the current status across handler invocations.
 */
let currentStatus: AutosaveStatus = { status: 'idle' };

// ============================================================================
// Recovery Handlers (FR-003 to FR-007)
// ============================================================================

/**
 * Creates recovery handlers with injected services.
 * @param services - Service container with required dependencies
 * @returns Object containing all recovery handler functions
 */
function createRecoveryHandlers(services: AutosaveHandlerServices) {
  return {
    handleRecoveryCheck: createValidatedHandler(
      RecoveryCheckRequestSchema,
      async (): Promise<RecoveryCheckResponse> => services.recoveryService.checkForRecovery()
    ),

    handleRecoveryList: createValidatedHandler(
      RecoveryListRequestSchema,
      async (): Promise<RecoveryListResponse> => services.recoveryService.listRecoverable()
    ),

    handleRecoveryPreview: createValidatedHandler(
      RecoveryPreviewRequestSchema,
      async (args): Promise<RecoveryPreviewResponse> => services.recoveryService.getPreview(args.documentId)
    ),

    handleRecoveryRestore: createValidatedHandler(
      RecoveryRestoreRequestSchema,
      async (args): Promise<RecoveryRestoreResponse> => services.recoveryService.restore(args)
    ),

    handleRecoveryDiscard: createValidatedHandler(
      RecoveryDiscardRequestSchema,
      async (args): Promise<RecoveryDiscardResponse> => services.recoveryService.discardRecovery(args.documentIds)
    ),
  };
}

// ============================================================================
// Autosave Handlers (FR-001, FR-013)
// ============================================================================

/**
 * Creates autosave handlers with injected services.
 * @param services - Service container with required dependencies
 * @returns Object containing all autosave handler functions
 */
function createAutosaveHandlers(services: AutosaveHandlerServices) {
  return {
    handleAutosaveTrigger: createValidatedHandler(
      AutosaveTriggerRequestSchema,
      async (args): Promise<AutosaveTriggerResponse> => {
        currentStatus = { status: 'saving' };
        const result = await services.autosaveService.saveDocument(args);
        if (result.ok) {
          currentStatus = { status: 'saved', savedAt: result.savedAt };
        } else {
          currentStatus = { status: 'failed', consecutiveFailures: 1, lastError: result.message };
        }
        return result;
      }
    ),

    handleAutosaveStatus: createValidatedHandler(
      AutosaveStatusRequestSchema,
      (): Promise<AutosaveStatus> => Promise.resolve(currentStatus)
    ),
  };
}

// ============================================================================
// Settings Handlers (FR-009, FR-010, FR-011)
// ============================================================================

/**
 * Creates settings handlers with injected services.
 * @param services - Service container with required dependencies
 * @returns Object containing all settings handler functions
 */
function createSettingsHandlers(services: AutosaveHandlerServices) {
  return {
    handleSettingsGet: createValidatedHandler(
      SettingsGetRequestSchema,
      (): Promise<AutosaveSettings> => Promise.resolve(services.settingsService.getSettings())
    ),

    handleSettingsSet: createValidatedHandler(
      SettingsSetRequestSchema,
      (args): Promise<AutosaveSettings> => {
        // Filter out undefined values for exactOptionalPropertyTypes compatibility
        const filtered: Partial<AutosaveSettings> = {};
        if (args.enabled !== undefined) filtered.enabled = args.enabled;
        if (args.intervalMs !== undefined) filtered.intervalMs = args.intervalMs;
        if (args.retentionDays !== undefined) filtered.retentionDays = args.retentionDays;
        if (args.maxFiles !== undefined) filtered.maxFiles = args.maxFiles;
        if (args.maxStorageMB !== undefined) filtered.maxStorageMB = args.maxStorageMB;
        return Promise.resolve(services.settingsService.setSettings(filtered));
      }
    ),
  };
}

// ============================================================================
// Conflict Resolution Handler (FR-016)
// ============================================================================

/**
 * Creates conflict resolution handler.
 * @returns Conflict resolution handler function
 */
function createConflictHandler() {
  return {
    handleConflictResolve: createValidatedHandler(
      ConflictResolveRequestSchema,
      (args): Promise<ConflictResolveResponse> => {
        console.log('[AutosaveHandlers] Conflict resolution:', args.resolution);
        return Promise.resolve({ ok: true });
      }
    ),
  };
}

// ============================================================================
// Handler Registration
// ============================================================================

/**
 * Registers all autosave and recovery IPC handlers with dependency injection.
 *
 * @param ipcMainInstance - The Electron IpcMain instance
 * @param services - Service container with required dependencies
 */
export function registerAutosaveHandlers(
  ipcMainInstance: IpcMain,
  services: AutosaveHandlerServices
): void {
  // Create handlers with injected services
  const recoveryHandlers = createRecoveryHandlers(services);
  const autosaveHandlers = createAutosaveHandlers(services);
  const settingsHandlers = createSettingsHandlers(services);
  const conflictHandler = createConflictHandler();

  // Recovery handlers
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_CHECK, () => recoveryHandlers.handleRecoveryCheck(undefined));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_LIST, () => recoveryHandlers.handleRecoveryList(undefined));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_PREVIEW, (_, args) => recoveryHandlers.handleRecoveryPreview(args));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_RESTORE, (_, args) => recoveryHandlers.handleRecoveryRestore(args));
  ipcMainInstance.handle(AutosaveChannels.RECOVERY_DISCARD, (_, args) => recoveryHandlers.handleRecoveryDiscard(args));

  // Autosave handlers
  ipcMainInstance.handle(AutosaveChannels.AUTOSAVE_TRIGGER, (_, args) => autosaveHandlers.handleAutosaveTrigger(args));
  ipcMainInstance.handle(AutosaveChannels.AUTOSAVE_STATUS, () => autosaveHandlers.handleAutosaveStatus(undefined));

  // Settings handlers
  ipcMainInstance.handle(AutosaveChannels.SETTINGS_GET, () => settingsHandlers.handleSettingsGet(undefined));
  ipcMainInstance.handle(AutosaveChannels.SETTINGS_SET, (_, args) => settingsHandlers.handleSettingsSet(args));

  // Conflict resolution handler
  ipcMainInstance.handle(AutosaveChannels.CONFLICT_RESOLVE, (_, args) => conflictHandler.handleConflictResolve(args));

  console.log('[AutosaveHandlers] All autosave and recovery handlers registered');
}

/**
 * Export AutosaveHandlerServices interface for use by callers.
 */
export type { AutosaveHandlerServices };
