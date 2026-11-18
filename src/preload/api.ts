/**
 * MdxpadAPI - Interface exposed to renderer via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 */

import type { AgentApi } from './agent-api';
import type { MarketplaceApi } from './marketplace-api';
import type { HistoryApi } from './history-api';
import type { NotificationApi } from './notification-api';
import type { ShareApi } from './share-api';
import type { SecurityInfo } from '@shared/lib/ipc';
import type { FileHandle, FileResult } from '@shared/types/file';
import type {
  ExportFormat,
  FileExportResult,
  FileListDirectoryResponse,
} from '@shared/contracts/file-schemas';
import type {
  CloudSyncProviderId,
  CloudSyncListProvidersResponse,
  CloudSyncConnectResponse,
  CloudSyncStatus,
  CloudSyncPushRequest,
  CloudSyncPushResponse,
  CloudSyncPullRequest,
  CloudSyncPullResponse,
  CollaborationListRequest,
  CollaborationListResponse,
  CollaborationAddCommentRequest,
  CollaborationAddCommentResponse,
  CollaborationResolveThreadRequest,
  CollaborationResolveThreadResponse,
  CollaborationAddSuggestionRequest,
  CollaborationAddSuggestionResponse,
  CollaborationApplySuggestionRequest,
  CollaborationApplySuggestionResponse,
  ExtensionListResponse,
  ExtensionInstallRequest,
  ExtensionInstallResponse,
  ExtensionSetPermissionRequest,
  ExtensionSetPermissionResponse,
  PublishRequest,
  PublishResponse,
  PublishListProvenanceRequest,
  PublishListProvenanceResponse,
  PublishBacklinksResponse,
} from '@shared/contracts/platform-schemas';
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
import type {
  ExportCliInvokeRequest,
  ExportCliInvokeResponse,
  ExportJobLifecycleRequest,
  ExportJobLifecycleResponse,
  ExportPresetCrudRequest,
  ExportPresetCrudResponse,
  LlmsGenerationRequest,
  LlmsGenerationResponse,
} from '@shared/contracts/export-schemas';
import type { AIApi } from './ai-api';
import type { WorkspaceApi } from './workspace-api';
import type { gitApi } from './git-api';
import type { searchApi } from './search-api';
import type { importApi } from './import-api';
import type { citationApi } from './citation-api';
import type { SemanticSearchApi } from './semantic-search-api';
import type {
  PluginDisableResponse,
  PluginEnableResponse,
  PluginInstallResponse,
  PluginListResponse,
  PluginUninstallResponse,
} from '@shared/contracts/plugin-schemas';
import type {
  TemplateMetadata,
  Template,
  TemplateSource,
  TemplateCategory,
  TemplateVariable,
  VariableValues,
} from '@shared/contracts/template-schemas';

export type { AgentApi };

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

/** Plugin system API shape */
export interface PluginApi {
  list(): Promise<PluginListResponse>;
  install(pluginPath: string): Promise<PluginInstallResponse>;
  uninstall(pluginId: string): Promise<PluginUninstallResponse>;
  enable(pluginId: string): Promise<PluginEnableResponse>;
  disable(pluginId: string): Promise<PluginDisableResponse>;
}

export interface ExportOperationsApi {
  jobLifecycle(request: ExportJobLifecycleRequest): Promise<ExportJobLifecycleResponse>;
  presetCrud(request: ExportPresetCrudRequest): Promise<ExportPresetCrudResponse>;
  cliInvoke(request: ExportCliInvokeRequest): Promise<ExportCliInvokeResponse>;
  llmsGenerate(request: LlmsGenerationRequest): Promise<LlmsGenerationResponse>;
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
   * List document files in a folder the user has opened.
   * @param directory - Absolute directory path
   */
  listDirectory(directory: string): Promise<FileListDirectoryResponse>;

  /**
   * Embed pictures beside an open document so preview can show them.
   * Returns the original content when that file is not open.
   */
  readonly inlinePreviewImages?: (content: string, sourcePath: string) => Promise<string>;

  /**
   * Write content to path.
   * @param path - Absolute file path
   * @param content - Content to write
   * @returns void on success, error on failure
   */
  writeFile(path: string, content: string): Promise<FileResult<void>>;

  /**
   * Export current document content to a selected format/path.
   * Supports html/markdown/mdx and returns explicit unsupported-format errors for others.
   */
  exportFile(
    content: string,
    options?: { sourcePath?: string | null; format?: ExportFormat }
  ): Promise<FileExportResult>;

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
   * Subscribe to export file menu event.
   * @param callback - Called when export is requested from menu
   * @returns Unsubscribe function
   */
  onMenuExportFile(callback: () => void): () => void;

  /**
   * Subscribe to main-process dirty-state queries.
   * Used by close-window flow to determine whether unsaved changes exist.
   * Optional for compatibility in non-Electron test environments.
   *
   * @param callback - Returns true when current document is dirty
   * @returns Unsubscribe function
   */
  onEditorDirtyCheck?(callback: () => boolean): () => void;

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
   * Canonical settings namespace.
   * Backward-compatible facade over autosave settings operations.
   */
  settings: {
    /**
     * Get current settings.
     */
    get(): Promise<AutosaveSettings>;
    /**
     * Persist updated settings.
     */
    set(settings: Partial<AutosaveSettings>): Promise<AutosaveSettings>;
    /**
     * Subscribe to settings changes.
     */
    onChange(callback: (settings: AutosaveSettings) => void): () => void;
  };

  /**
   * AI Provider API (Spec 028).
   * Provides access to AI provider configuration, generation, and usage tracking.
   */
  ai: AIApi;

  /**
   * Workspace graph and metadata collection operations.
   */
  workspace?: WorkspaceApi;

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
    showSaveDialog(
      defaultName?: string
    ): Promise<TemplateResult<{ path: string | null; canceled: boolean }>>;
  };

  /**
   * Cloud sync API (Fleet Wave 3).
   * Optional for backward compatibility with existing mocks/tests.
   */
  sync?: {
    listProviders(): Promise<CloudSyncListProvidersResponse>;
    connectProvider(providerId: CloudSyncProviderId): Promise<CloudSyncConnectResponse>;
    status(providerId: CloudSyncProviderId): Promise<CloudSyncStatus>;
    pushDocument(request: CloudSyncPushRequest): Promise<CloudSyncPushResponse>;
    pullDocument(request: CloudSyncPullRequest): Promise<CloudSyncPullResponse>;
  };

  /**
   * Collaboration primitives API (Fleet Wave 3).
   * Optional for backward compatibility with existing mocks/tests.
   */
  share?: ShareApi;
  history?: HistoryApi;
  notifications?: NotificationApi;

  collaboration?: {
    list(request: CollaborationListRequest): Promise<CollaborationListResponse>;
    addComment(request: CollaborationAddCommentRequest): Promise<CollaborationAddCommentResponse>;
    resolveThread(
      request: CollaborationResolveThreadRequest
    ): Promise<CollaborationResolveThreadResponse>;
    addSuggestion(
      request: CollaborationAddSuggestionRequest
    ): Promise<CollaborationAddSuggestionResponse>;
    applySuggestion(
      request: CollaborationApplySuggestionRequest
    ): Promise<CollaborationApplySuggestionResponse>;
  };

  /**
   * Extension platform API (Fleet Wave 4).
   * Optional for backward compatibility with existing mocks/tests.
   */
  extensions?: {
    list(): Promise<ExtensionListResponse>;
    install(request: ExtensionInstallRequest): Promise<ExtensionInstallResponse>;
    setPermission(request: ExtensionSetPermissionRequest): Promise<ExtensionSetPermissionResponse>;
  };

  /**
   * Publish + provenance API (Fleet Wave 4).
   * Optional for backward compatibility with existing mocks/tests.
   */
  publish?: {
    run(request: PublishRequest): Promise<PublishResponse>;
    listProvenance(request?: PublishListProvenanceRequest): Promise<PublishListProvenanceResponse>;
    getBacklinks(canonicalUrl: string): Promise<PublishBacklinksResponse>;
  };

  /**
   * Export orchestration API (jobs, presets, CLI invocation, llms generation).
   */
  export?: ExportOperationsApi;

  /**
   * Git operations API (Wave 2).
   */
  git?: typeof gitApi;

  /**
   * Full-text search API (Wave 2).
   */
  search?: typeof searchApi;

  /**
   * Content import API (Wave 2).
   */
  import?: typeof importApi;

  /**
   * Citation management API (Wave 2).
   */
  citation?: typeof citationApi;

  /**
   * Semantic search API (Wave 2).
   */
  semanticSearch?: SemanticSearchApi;

  /**
   * AI agent API (Wave 2).
   */
  agent?: AgentApi;

  /**
   * Template marketplace catalog. Install is not exposed.
   */
  marketplace?: MarketplaceApi;

  /**
   * Plugin system API (Wave 2).
   */
  plugin?: PluginApi;
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
