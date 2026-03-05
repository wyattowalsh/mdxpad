/**
 * Recovery & Autosave API Module
 *
 * Provides autosave and recovery bridge functions for the renderer process.
 * All methods use validated invoke with schema validation on both ends.
 *
 * @security Uses invoke/handle pattern for all operations
 * @security All payloads validated with zod on both ends per Constitution III.3
 * @module src/preload/recovery-api
 */

import {
  AutosaveChannels,
  RecoveryCheckResponseSchema,
  RecoveryListResponseSchema,
  RecoveryPreviewRequestSchema,
  RecoveryPreviewResponseSchema,
  RecoveryRestoreRequestSchema,
  RecoveryRestoreResponseSchema,
  RecoveryDiscardRequestSchema,
  RecoveryDiscardResponseSchema,
  AutosaveTriggerRequestSchema,
  AutosaveTriggerResponseSchema,
  AutosaveStatusResponseSchema,
  SettingsGetResponseSchema,
  SettingsSetRequestSchema,
  SettingsSetResponseSchema,
  ConflictResolveRequestSchema,
  ConflictResolveResponseSchema,
} from '@shared/contracts/autosave-ipc';
import { validatedInvoke } from './validated-invoke';
import type {
  RecoveryListResponse,
  RecoveryPreviewResponse,
  RecoveryRestoreResponse,
  RecoveryPreviewRequest,
  RecoveryRestoreRequest,
  RecoveryDiscardRequest,
  AutosaveTriggerRequest,
  ConflictResolveRequest,
} from '@shared/contracts/autosave-ipc';
import type { AutosaveSettings } from '@shared/contracts/autosave-schemas';

// ============================================================================
// Recovery Operations
// ============================================================================

export const recoveryOperations = {
  recoveryCheck: () =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_CHECK,
      null,
      RecoveryCheckResponseSchema
    ),

  recoveryList: (): Promise<RecoveryListResponse> =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_LIST,
      null,
      RecoveryListResponseSchema
    ),

  recoveryPreview: (request: RecoveryPreviewRequest): Promise<RecoveryPreviewResponse> =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_PREVIEW,
      RecoveryPreviewRequestSchema,
      RecoveryPreviewResponseSchema,
      request
    ),

  recoveryRestore: (request: RecoveryRestoreRequest): Promise<RecoveryRestoreResponse> =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_RESTORE,
      RecoveryRestoreRequestSchema,
      RecoveryRestoreResponseSchema,
      request
    ),

  recoveryDiscard: (request: RecoveryDiscardRequest) =>
    validatedInvoke(
      AutosaveChannels.RECOVERY_DISCARD,
      RecoveryDiscardRequestSchema,
      RecoveryDiscardResponseSchema,
      request
    ),
};

// ============================================================================
// Autosave Operations
// ============================================================================

export const autosaveOperations = {
  autosaveTrigger: (request: AutosaveTriggerRequest) =>
    validatedInvoke(
      AutosaveChannels.AUTOSAVE_TRIGGER,
      AutosaveTriggerRequestSchema,
      AutosaveTriggerResponseSchema,
      request
    ),

  autosaveStatus: () =>
    validatedInvoke(
      AutosaveChannels.AUTOSAVE_STATUS,
      null,
      AutosaveStatusResponseSchema
    ),

  conflictResolve: (request: ConflictResolveRequest) =>
    validatedInvoke(
      AutosaveChannels.CONFLICT_RESOLVE,
      ConflictResolveRequestSchema,
      ConflictResolveResponseSchema,
      request
    ),
};

// ============================================================================
// Settings Operations
// ============================================================================

export const settingsOperations = {
  autosaveSettingsGet: () =>
    validatedInvoke(
      AutosaveChannels.SETTINGS_GET,
      null,
      SettingsGetResponseSchema
    ),

  autosaveSettingsSet: (settings: AutosaveSettings) =>
    validatedInvoke(
      AutosaveChannels.SETTINGS_SET,
      SettingsSetRequestSchema,
      SettingsSetResponseSchema,
      settings
    ),

};
