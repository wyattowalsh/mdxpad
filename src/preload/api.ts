/**
 * MdxpadAPI - Interface exposed to renderer via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 */

import type { SecurityInfo } from '@shared/lib/ipc';
import type { FileHandle, FileResult } from '@shared/types/file';
import type {
  RecoveryCheckResponse,
  RecoveryListResponse,
  RecoveryPreviewRequest,
  RecoveryPreviewResponse,
  RecoveryRestoreRequest,
  RecoveryRestoreResponse,
  RecoveryDiscardRequest,
  RecoveryDiscardResponse,
  AutosaveTriggerRequest,
  AutosaveTriggerResponse,
  ConflictResolveRequest,
  ConflictResolveResponse,
} from '@shared/contracts/autosave-ipc';
import type { AutosaveSettings, AutosaveStatus } from '@shared/contracts/autosave-schemas';
import type { AIApi } from './ai-api';
import type {
  TemplateMetadata,
  Template,
  TemplateSource,
  TemplateCategory,
  TemplateVariable,
  VariableValues,
} from '@shared/contracts/template-schemas';

/** File change event received from main process */
export interface FileChangeEvent {
  fileId: string;
  path: string;
  type: 'change' | 'unlink';
}

/** Menu file open event data */
export interface MenuFileOpenEvent {
  handle: import('@shared/types/file').FileHandle;
  content: string;
}

/**
 * API surface exposed to renderer process via contextBridge.
 *
 * @security All methods use invoke/handle pattern.
 * @security All responses should be validated before use.
 */
export interface MdxpadAPI {
  // === App Info ===
  /**
   * Get application version.
   * @returns Semantic version string (e.g., "0.1.0")
   */
  getVersion(): Promise<string>;

  /**
   * Get current security configuration.
   * Used by verify-security script and debug info.
   * @returns Security settings object
   */
  getSecurityInfo(): Promise<SecurityInfo>;

  // === File Operations ===
  /**
   * Open a file using native dialog.
   * @returns FileHandle on success, error on cancel/failure
   */
  openFile(): Promise<FileResult<FileHandle>>;

  /**
   * Save content to existing file.
   * @param handle - File handle with path
   * @param content - Content to save
   * @returns void on success, error on failure
   */
  saveFile(handle: FileHandle, content: string): Promise<FileResult<void>>;

  /**
   * Save content to new location using native dialog.
   * @param content - Content to save
   * @returns New FileHandle on success, error on cancel/failure
   */
  saveFileAs(content: string): Promise<FileResult<FileHandle>>;

  /**
   * Read file content from path.
   * @param path - Absolute file path
   * @returns File content on success, error on failure
   */
  readFile(path: string): Promise<FileResult<string>>;

  /**
   * Write content to path.
   * @param path - Absolute file path
   * @param content - Content to write
   * @returns void on success, error on failure
   */
  writeFile(path: string, content: string): Promise<FileResult<void>>;

  // === Window Operations ===
  /**
   * Close the current window.
   * May show confirmation dialog if document is dirty.
   */
  closeWindow(): Promise<void>;

  /**
   * Minimize the current window.
   */
  minimizeWindow(): Promise<void>;

  /**
   * Maximize or restore the current window.
   */
  maximizeWindow(): Promise<void>;

  // === App Lifecycle ===
  /**
   * Signal that renderer is ready.
   */
  signalReady(): Promise<void>;

  // === Events ===
  /**
   * Subscribe to file change events from main process.
   * @param callback - Called when an open file changes externally
   * @returns Unsubscribe function
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void;

  // === Menu Events ===
  /**
   * Subscribe to command palette toggle from menu.
   * @param callback - Called when command palette should toggle
   * @returns Unsubscribe function
   */
  onMenuCommandPalette(callback: () => void): () => void;

  /**
   * Subscribe to new file menu event.
   * @param callback - Called when new file is requested from menu
   * @returns Unsubscribe function
   */
  onMenuNewFile(callback: () => void): () => void;

  /**
   * Subscribe to open file dialog menu event.
   * @param callback - Called when open dialog is requested from menu
   * @returns Unsubscribe function
   */
  onMenuOpenFileDialog(callback: () => void): () => void;

  /**
   * Subscribe to open file menu event (file already selected).
   * @param callback - Called with file data when opening from recent files
   * @returns Unsubscribe function
   */
  onMenuOpenFile(callback: (event: MenuFileOpenEvent) => void): () => void;

  /**
   * Subscribe to save file menu event.
   * @param callback - Called when save is requested from menu
   * @returns Unsubscribe function
   */
  onMenuSaveFile(callback: () => void): () => void;

  /**
   * Subscribe to save file as menu event.
   * @param callback - Called when save as is requested from menu
   * @returns Unsubscribe function
   */
  onMenuSaveFileAs(callback: () => void): () => void;

  /**
   * Platform information.
   */
  platform: {
    os: 'darwin'; // macOS only per constitution
    arch: 'arm64' | 'x64';
  };

  // === Autosave & Recovery (Spec 011) ===

  /**
   * Check if recovery data exists on startup.
   * Per FR-003: detect recoverable documents.
   */
  recoveryCheck(): Promise<RecoveryCheckResponse>;

  /**
   * List all recoverable documents for recovery dialog.
   * Per FR-004, FR-005: display list with previews.
   */
  recoveryList(): Promise<RecoveryListResponse>;

  /**
   * Get full content preview for a recoverable document.
   * Per FR-005: preview content before recovery.
   */
  recoveryPreview(request: RecoveryPreviewRequest): Promise<RecoveryPreviewResponse>;

  /**
   * Restore selected documents based on user decision.
   * Per FR-006: restore chosen documents to editor.
   */
  recoveryRestore(request: RecoveryRestoreRequest): Promise<RecoveryRestoreResponse>;

  /**
   * Discard recovery files for specified documents.
   * Per FR-007, FR-008: explicit decline or post-save cleanup.
   */
  recoveryDiscard(request: RecoveryDiscardRequest): Promise<RecoveryDiscardResponse>;

  /**
   * Trigger autosave for a document.
   * Per FR-001: save content to recovery location.
   */
  autosaveTrigger(request: AutosaveTriggerRequest): Promise<AutosaveTriggerResponse>;

  /**
   * Get current autosave status.
   * Per FR-013: status for UI indicator.
   */
  autosaveStatus(): Promise<AutosaveStatus>;

  /**
   * Get current autosave settings.
   * Per FR-009, FR-010, FR-011: user-configurable settings.
   */
  autosaveSettingsGet(): Promise<AutosaveSettings>;

  /**
   * Update autosave settings.
   * Per FR-009, FR-010, FR-011: persist and apply immediately.
   */
  autosaveSettingsSet(settings: Partial<AutosaveSettings>): Promise<AutosaveSettings>;

  /**
   * Resolve a file conflict during recovery.
   * Per FR-016: handle disk vs recovery version conflicts.
   */
  conflictResolve(request: ConflictResolveRequest): Promise<ConflictResolveResponse>;

  /**
   * Subscribe to autosave settings changes.
   * @param callback - Called when settings are updated
   * @returns Unsubscribe function
   */
  onAutosaveSettingsChange(callback: (settings: AutosaveSettings) => void): () => void;

  /**
   * AI Provider API (Spec 028).
   * Provides access to AI provider configuration, generation, and usage tracking.
   */
  ai: AIApi;

  // === Template Operations (Spec 016) ===
  /**
   * Template API namespace.
   * All template operations are grouped here.
   */
  template: {
    /**
     * List available templates.
     * @param source - Filter by source: 'all', 'builtin', or 'custom'
     * @returns Array of template metadata
     */
    list(source?: TemplateSource): Promise<TemplateResult<TemplateMetadata[]>>;

    /**
     * Get a single template by ID.
     * @param id - Template identifier
     * @returns Full template including content
     */
    get(id: string): Promise<TemplateResult<Template>>;

    /**
     * Save a new or update an existing template.
     * @param template - Template data to save
     * @param replace - If true, replace existing template with same name
     * @returns Saved template metadata
     */
    save(
      template: {
        id?: string;
        name: string;
        description: string;
        category: TemplateCategory;
        tags?: string[];
        variables?: TemplateVariable[];
        content: string;
      },
      replace?: boolean
    ): Promise<TemplateResult<TemplateMetadata>>;

    /**
     * Delete a custom template.
     * @param id - Template identifier
     * @returns Deleted template ID
     */
    delete(id: string): Promise<TemplateResult<{ id: string }>>;

    /**
     * Import a template from a .mdxt file.
     * @param path - Absolute path to .mdxt file
     * @param replace - If true, replace existing template with same name
     * @returns Imported template metadata
     */
    import(path: string, replace?: boolean): Promise<TemplateResult<TemplateMetadata>>;

    /**
     * Export a template to a .mdxt file.
     * @param id - Template identifier
     * @param path - Absolute path to save .mdxt file
     * @returns Export file path
     */
    export(id: string, path: string): Promise<TemplateResult<{ path: string }>>;

    /**
     * Validate template content (MDX syntax check).
     * @param content - Template content to validate
     * @returns Validation result with any errors
     */
    validate(content: string): Promise<TemplateResult<{ valid: boolean; errors: string[] }>>;

    /**
     * Create a new document from a template.
     * @param templateId - Template identifier
     * @param variables - Variable values for substitution
     * @param savePath - Optional path to save the document
     * @returns Generated content and optional save path
     */
    createFromTemplate(
      templateId: string,
      variables: VariableValues,
      savePath?: string
    ): Promise<TemplateResult<{ content: string; path?: string }>>;

    /**
     * Show native file open dialog for importing .mdxt files.
     * @returns Selected file path or null if canceled
     */
    showOpenDialog(): Promise<TemplateResult<{ path: string | null; canceled: boolean }>>;

    /**
     * Show native file save dialog for exporting .mdxt files.
     * @param defaultName - Suggested file name (without extension)
     * @returns Selected file path or null if canceled
     */
    showSaveDialog(defaultName?: string): Promise<TemplateResult<{ path: string | null; canceled: boolean }>>;
  };
}

/**
 * Template operation result type.
 * All template operations return this discriminated union.
 */
export type TemplateResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: TemplateErrorCode };

/**
 * Template error codes.
 */
export type TemplateErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'VALIDATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'FILE_ERROR'
  | 'PARSE_ERROR';
