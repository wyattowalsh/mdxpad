/**
 * Root application component.
 * Implements the main split-pane layout with EditorPane and PreviewPane.
 *
 * Layout Structure:
 * ```
 * +-------------------------------------+
 * | Title Bar (drag region)             |
 * +---------------+-----+---------------+
 * |               |     |               |
 * |  EditorPane   |  H  |  PreviewPane  |  <- Resizable
 * |               |     |               |
 * +---------------+-----+---------------+
 * | StatusBar                           |  <- Fixed
 * +-------------------------------------+
 * ```
 *
 * @module renderer/App
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import { CommandPalette } from './components/CommandPalette';
import { useCommandPalette, buildCommandContext } from './hooks/useCommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useScrollSync } from './hooks/useScrollSync';
import { useCommandRegistry } from './stores/command-registry-store';
import { useUILayoutStore, selectPreviewVisible, selectSplitRatio, selectOutlineVisible, selectFrontmatterVisible } from './stores/ui-layout-store';
import { useDocumentStore, selectFileName, selectIsDirty, selectContent } from './stores/document-store';
import {
  useTemplateBrowserModalStore,
  selectIsTemplateBrowserOpen,
  selectIsVariableDialogOpen,
  selectPendingTemplate,
  selectIsSaveTemplateDialogOpen,
  selectIsSaving,
  selectSaveError,
} from './stores/template-browser-store';
import { useTemplateStore, selectTemplates } from './stores/template-store';
import { registerAllCommands } from './commands';
import { EditorPane, type CursorPosition } from './components/shell/EditorPane';
import { PreviewPane } from './components/shell/PreviewPane';
import { StatusBar } from './components/shell/StatusBar';
import { OutlinePanel } from './components/outline';
import { FrontmatterPanel } from './components/frontmatter';
import { TemplateBrowser } from './components/template-browser/TemplateBrowser';
import { VariableDialog } from './components/template-browser/VariableDialog';
import { SaveTemplateDialog } from './components/template-browser/SaveTemplateDialog';
import type { SaveTemplateFormData } from './components/template-browser/SaveTemplateDialog';
import { useOutlineSync } from './hooks/useOutlineSync';
import { useOutlineNavigation } from './hooks/useOutlineNavigation';
import { useAutosave } from './hooks/use-autosave';
import { useRecoveryCheck } from './hooks/use-recovery-check';
import { useRecoveryRestore } from './hooks/use-recovery-restore';
import { useRecoveryCleanup } from './hooks/use-recovery-cleanup';
import { RecoveryDialog } from './components/recovery-dialog';
import { SettingsPanel } from './components/settings-panel';
import { useSettingsStore } from './stores/settings-store';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { substituteVariables, buildVariableValues } from './lib/template-variables';
import type { CommandContext, CommandId, NormalizedShortcut, NotificationInput } from '@shared/types/commands';
import type { CompilationError } from './components/shell/StatusBar/types';
import type { OutlineItem } from '@shared/types/outline';
import type { ScrollReportSignal } from '@shared/types/preview-iframe';
import type { Template } from '@shared/contracts/template-schemas';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum pane size as percentage (10% = ~100px at 1000px width) */
const MIN_PANE_SIZE = 10;

/** Default split ratio (50% editor / 50% preview) */
const DEFAULT_SPLIT_RATIO = 0.5;

// =============================================================================
// HELPERS
// =============================================================================

/** Get mdxpad API with fallback for non-Electron environments */
function getMdxpadApi() {
  return window.mdxpad ?? {
    getVersion: async () => 'dev',
    getSecurityInfo: async () => ({ contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }),
    openFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    saveFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    saveFileAs: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    readFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    writeFile: async () => ({ ok: false, error: { code: 'UNKNOWN' as const, message: 'Not in Electron' } }),
    closeWindow: async () => {},
    minimizeWindow: async () => {},
    maximizeWindow: async () => {},
    signalReady: async () => {},
    onFileChange: () => () => {},
    onMenuCommandPalette: () => () => {},
    onMenuNewFile: () => () => {},
    onMenuOpenFileDialog: () => () => {},
    onMenuOpenFile: () => () => {},
    onMenuSaveFile: () => () => {},
    onMenuSaveFileAs: () => () => {},
    platform: { os: 'browser' as const, arch: 'unknown' as const },
  };
}

/** Convert split ratio (0-1) to panel size percentage */
function ratioToSize(ratio: number): number {
  return ratio * 100;
}

/** Convert panel sizes array to split ratio */
function sizesToRatio(sizes: number[]): number {
  // First panel size / total gives us the ratio
  return (sizes[0] ?? 50) / 100;
}

// =============================================================================
// HOOKS
// =============================================================================

/** Hook for registering built-in commands */
function useBuiltInCommands(toggle: () => void): void {
  useEffect(() => {
    const { register } = useCommandRegistry.getState();
    register({
      id: 'command-palette.toggle' as CommandId,
      name: 'Toggle Command Palette',
      category: 'view',
      shortcut: { key: 'p', modifiers: ['Mod', 'Shift'] },
      execute: () => { toggle(); return { ok: true }; },
    });
    const unregister = registerAllCommands();
    return () => { unregister(); };
  }, [toggle]);
}

/** Hook for app version and menu events */
function useAppEvents(toggle: () => void): { version: string; platform: { os: string; arch: string } } {
  const mdxpad = getMdxpadApi();
  const [version, setVersion] = useState<string>('...');
  useEffect(() => {
    void mdxpad.getVersion().then(setVersion);
    const unsub = mdxpad.onMenuCommandPalette(() => { toggle(); });
    return () => { unsub(); };
  }, [toggle, mdxpad]);
  return { version, platform: mdxpad.platform };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Main App component with split-pane layout. */
export function App(): React.ReactElement {
  // Ref to the CodeMirror EditorView for navigation
  const editorRef = useRef<EditorView | null>(null);

  // Ref to the preview iframe for scroll synchronization
  // Feature: 008-bidirectional-sync
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Command palette state
  const palette = useCommandPalette();
  const { isOpen, toggle, executeCommand } = palette;
  useAppEvents(toggle);
  useBuiltInCommands(toggle);

  // Autosave hook for automatic document saving (T008, T029, T030)
  const autosave = useAutosave();

  // Recovery restore hook for loading recovered documents (T013)
  const { restoreDocuments } = useRecoveryRestore();

  // Recovery check hook for startup recovery detection (T012)
  const recovery = useRecoveryCheck({
    onRestore: restoreDocuments,
  });

  // Recovery cleanup hook for cleaning up after manual saves (T014)
  useRecoveryCleanup();

  // Settings panel state (T019)
  const settingsOpen = useSettingsStore((s) => s.isOpen);
  const closeSettings = useSettingsStore((s) => s.close);

  // Sync outline store with preview AST
  useOutlineSync();

  // Outline navigation hook for click-to-navigate
  const { navigateToItem } = useOutlineNavigation({ editorRef });

  // Bidirectional scroll synchronization between editor and preview
  // Feature: 008-bidirectional-sync
  const { syncEditorToPreview } = useScrollSync({
    editorRef,
    previewRef: previewIframeRef,
  });

  // UI layout state from store
  const previewVisible = useUILayoutStore(selectPreviewVisible);
  const outlineVisible = useUILayoutStore(selectOutlineVisible);
  const frontmatterVisible = useUILayoutStore(selectFrontmatterVisible);
  const splitRatio = useUILayoutStore(selectSplitRatio);
  const setSplitRatio = useUILayoutStore((s) => s.setSplitRatio);

  // Document state for StatusBar
  const fileName = useDocumentStore(selectFileName);
  const isDirty = useDocumentStore(selectIsDirty);
  const setContent = useDocumentStore((s) => s.setContent);
  const newDocument = useDocumentStore((s) => s.newDocument);

  // Template browser modal state
  const isTemplateBrowserOpen = useTemplateBrowserModalStore(selectIsTemplateBrowserOpen);
  const isVariableDialogOpen = useTemplateBrowserModalStore(selectIsVariableDialogOpen);
  const pendingTemplate = useTemplateBrowserModalStore(selectPendingTemplate);
  const openTemplateBrowser = useTemplateBrowserModalStore((s) => s.openTemplateBrowser);
  const closeTemplateBrowser = useTemplateBrowserModalStore((s) => s.closeTemplateBrowser);
  const startVariableDialog = useTemplateBrowserModalStore((s) => s.startVariableDialog);
  const closeVariableDialog = useTemplateBrowserModalStore((s) => s.closeVariableDialog);
  const clearPendingTemplate = useTemplateBrowserModalStore((s) => s.clearPendingTemplate);

  // Save template dialog state
  const isSaveTemplateDialogOpen = useTemplateBrowserModalStore(selectIsSaveTemplateDialogOpen);
  const isSaving = useTemplateBrowserModalStore(selectIsSaving);
  const saveError = useTemplateBrowserModalStore(selectSaveError);
  const openSaveTemplateDialog = useTemplateBrowserModalStore((s) => s.openSaveTemplateDialog);
  const closeSaveTemplateDialog = useTemplateBrowserModalStore((s) => s.closeSaveTemplateDialog);
  const setSaving = useTemplateBrowserModalStore((s) => s.setSaving);
  const setSaveError = useTemplateBrowserModalStore((s) => s.setSaveError);

  // Template store for saving and getting existing names
  const templates = useTemplateStore(selectTemplates);
  const saveTemplate = useTemplateStore((s) => s.saveTemplate);

  // Get current document content for saving as template
  const documentContent = useDocumentStore(selectContent);

  // Local state for cursor position and errors
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({ line: 1, column: 1 });
  const [errors, setErrors] = useState<readonly CompilationError[]>([]);

  // T027: Screen reader announcement state for accessibility
  const [announcement, setAnnouncement] = useState<string>('');

  // Handle resize - update split ratio in store (debounced via store)
  const handleLayout = useCallback(
    (sizes: number[]): void => {
      const newRatio = sizesToRatio(sizes);
      setSplitRatio(newRatio);
    },
    [setSplitRatio]
  );

  // Handle cursor position change from editor
  const handleCursorChange = useCallback((position: CursorPosition): void => {
    setCursorPosition(position);
  }, []);

  // Handle errors change from preview
  const handleErrorsChange = useCallback((newErrors: readonly CompilationError[]): void => {
    setErrors(newErrors);
  }, []);

  // Handle error click - navigate to error location in editor
  const handleErrorClick = useCallback((error: CompilationError): void => {
    // TODO: Implement editor navigation to error location
    console.log('Navigate to error:', error.line, error.column);
  }, []);

  // Handle error click from preview
  const handlePreviewErrorClick = useCallback((line: number, column?: number): void => {
    // TODO: Implement editor navigation to error location
    console.log('Navigate to error from preview:', line, column);
  }, []);

  // Handle outline item navigation (FR-020, FR-021, FR-022, FR-024)
  const handleOutlineNavigate = useCallback((item: OutlineItem): void => {
    navigateToItem(item);
  }, [navigateToItem]);

  // Handle scroll report from preview iframe for preview-to-editor sync
  // Feature: 008-bidirectional-sync
  const handleScrollReport = useCallback(
    (report: Omit<ScrollReportSignal, 'type'>): void => {
      // The useScrollSync hook handles this via its internal message listener
      // This callback is provided for additional processing if needed
      void report; // Currently handled internally by useScrollSync
    },
    []
  );

  // ==========================================================================
  // Template Browser Handlers (US1: Create from Template)
  // ==========================================================================

  /**
   * Check if a template requires variable input from the user.
   * Returns false if template has no variables or all variables have defaults.
   */
  const templateNeedsVariables = useCallback((template: Template): boolean => {
    const { variables } = template;
    if (!variables || variables.length === 0) {
      return false;
    }
    // Check if all variables have defaults (and required ones have defaults too)
    return variables.some(
      (v) => v.required && (v.default === undefined || v.default === '')
    );
  }, []);

  /**
   * Create a new document from a template with the given variable values.
   */
  const createDocumentFromTemplate = useCallback(
    (template: Template, variableValues: Record<string, string>): void => {
      // Build complete variable values with defaults applied
      const completeValues = buildVariableValues(template.variables ?? [], variableValues);

      // Substitute variables in the template content
      const substitutedContent = substituteVariables(template.content, completeValues);

      // Create a new document and set its content
      newDocument();
      setContent(substitutedContent);

      // Clear the pending template
      clearPendingTemplate();

      console.log(`Created new document from template: ${template.name}`);
    },
    [newDocument, setContent, clearPendingTemplate]
  );

  /**
   * Handle template selection from the browser.
   * Opens variable dialog if needed, otherwise creates document directly.
   */
  const handleTemplateSelect = useCallback(
    (template: Template): void => {
      if (templateNeedsVariables(template)) {
        // Template has required variables without defaults - show dialog
        startVariableDialog(template);
      } else {
        // No variables needed - create document directly
        createDocumentFromTemplate(template, {});
        closeTemplateBrowser();
      }
    },
    [templateNeedsVariables, startVariableDialog, createDocumentFromTemplate, closeTemplateBrowser]
  );

  /**
   * Handle variable dialog submission.
   */
  const handleVariableSubmit = useCallback(
    (values: Record<string, string>): void => {
      if (pendingTemplate) {
        createDocumentFromTemplate(pendingTemplate, values);
        closeVariableDialog();
      }
    },
    [pendingTemplate, createDocumentFromTemplate, closeVariableDialog]
  );

  /**
   * Handle variable dialog cancel.
   */
  const handleVariableCancel = useCallback((): void => {
    closeVariableDialog();
    clearPendingTemplate();
    // Re-open template browser so user can pick another template
    openTemplateBrowser();
  }, [closeVariableDialog, clearPendingTemplate, openTemplateBrowser]);

  // ==========================================================================
  // Save Template Dialog Handlers (US3: Create Custom Template)
  // ==========================================================================

  /**
   * Get existing template names for duplicate detection.
   */
  const existingTemplateNames = useMemo(
    () => templates.map((t) => t.name.toLowerCase()),
    [templates]
  );

  /**
   * Handle save template form submission.
   * Validates MDX content and saves the template via IPC.
   */
  const handleSaveTemplate = useCallback(
    async (data: SaveTemplateFormData): Promise<void> => {
      setSaving(true);
      setSaveError(null);

      try {
        await saveTemplate(
          {
            name: data.name,
            description: data.description,
            category: data.category,
            tags: data.tags,
            variables: data.variables,
            content: data.content,
          },
          false // Don't replace existing
        );

        // Success - close dialog
        closeSaveTemplateDialog();
        console.log(`Saved template: ${data.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
        setSaveError(errorMessage);
      }
    },
    [saveTemplate, setSaving, setSaveError, closeSaveTemplateDialog]
  );

  // Build command context
  // T027: Notification callback announces to screen readers via aria-live region
  const handleNotification = useCallback((n: NotificationInput) => {
    console.log(`[${n.type}] ${n.message}`);
    // Update aria-live region for screen readers
    setAnnouncement(n.message);
    // Clear announcement after duration (or 3 seconds default) to allow future announcements
    setTimeout(() => setAnnouncement(''), n.duration ?? 3000);
  }, []);

  const getCommandContext = useCallback((): CommandContext => buildCommandContext(
    null, getMdxpadApi(),
    { fileId: null, filePath: null, content: '', isDirty: false },
    handleNotification
  ), [handleNotification]);

  // Handle keyboard shortcuts
  const handleShortcut = useCallback(
    (_: NormalizedShortcut, cmdId: string) => {
      void executeCommand(cmdId as CommandId, getCommandContext());
    },
    [executeCommand, getCommandContext]
  );

  useKeyboardShortcuts({ enabled: !isOpen, onShortcutExecuted: handleShortcut });

  // Calculate panel sizes based on split ratio and preview visibility
  const editorSize = useMemo(() => {
    if (!previewVisible) return 100;
    return ratioToSize(splitRatio);
  }, [previewVisible, splitRatio]);

  const previewSize = useMemo(() => {
    if (!previewVisible) return 0;
    return ratioToSize(1 - splitRatio);
  }, [previewVisible, splitRatio]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Title bar drag region */}
      <div
        className="h-8 w-full flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Main content area with split panes */}
      <main className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left Sidebar - Frontmatter and Outline Panels */}
        {(frontmatterVisible || outlineVisible) && (
          <div className="flex flex-col w-64 border-r bg-muted/30 overflow-hidden">
            {/* Frontmatter Panel */}
            {frontmatterVisible && (
              <FrontmatterPanel className="flex-shrink-0" />
            )}
            {/* Outline Panel */}
            {outlineVisible && (
              <OutlinePanel onNavigate={handleOutlineNavigate} className="flex-1 min-h-0" />
            )}
          </div>
        )}

        {/* Editor and Preview panels */}
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={handleLayout}
          className="h-full flex-1"
        >
          {/* Editor Panel */}
          <ResizablePanel
            defaultSize={editorSize}
            minSize={MIN_PANE_SIZE}
            className="flex flex-col"
          >
            <EditorPane
              editorRef={editorRef}
              onCursorChange={handleCursorChange}
              className="flex-1"
              theme="system"
              height="100%"
            />
          </ResizablePanel>

          {/* Only show handle and preview when preview is visible */}
          {previewVisible && (
            <>
              <ResizableHandle withHandle />

              {/* Preview Panel */}
              <ResizablePanel
                defaultSize={previewSize}
                minSize={MIN_PANE_SIZE}
                className="flex flex-col"
              >
                <PreviewPane
                  className="flex-1 h-full"
                  theme="dark"
                  onErrorClick={handlePreviewErrorClick}
                  onErrorsChange={handleErrorsChange}
                  onScrollReport={handleScrollReport}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Status Bar - fixed at bottom */}
      <StatusBar
        fileName={fileName}
        isDirty={isDirty}
        line={cursorPosition.line}
        column={cursorPosition.column}
        errors={errors}
        onErrorClick={handleErrorClick}
        autosave={{
          isSaving: autosave.isSaving,
          lastSaveAt: autosave.lastSaveAt,
          lastSaveResult: autosave.lastSaveResult,
          lastError: autosave.lastError,
          consecutiveFailures: autosave.consecutiveFailures,
          onRetry: autosave.saveNow,
          onDisable: autosave.disable,
        }}
      />

      {/* Command Palette overlay */}
      <CommandPalette getContext={getCommandContext} palette={palette} />

      {/* T027: Screen reader announcement region for accessibility */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Recovery Dialog overlay (T011, T012) */}
      <RecoveryDialog
        isOpen={recovery.isDialogOpen}
        entries={recovery.entries}
        onDecision={recovery.handleDecision}
      />

      {/* Settings Panel overlay (T019) */}
      <SettingsPanel isOpen={settingsOpen} onClose={closeSettings} />

      {/* Template Browser Modal (US1: Create from Template) */}
      <TemplateBrowser
        isOpen={isTemplateBrowserOpen}
        onClose={closeTemplateBrowser}
        onSelect={handleTemplateSelect}
      />

      {/* Variable Dialog Modal (for templates with dynamic variables) */}
      {pendingTemplate && (
        <VariableDialog
          isOpen={isVariableDialogOpen}
          onClose={handleVariableCancel}
          onSubmit={handleVariableSubmit}
          variables={pendingTemplate.variables ?? []}
          templateName={pendingTemplate.name}
        />
      )}

      {/* Save Template Dialog Modal (US3: Create Custom Template) */}
      <SaveTemplateDialog
        isOpen={isSaveTemplateDialogOpen}
        onClose={closeSaveTemplateDialog}
        onSave={handleSaveTemplate}
        content={documentContent}
        isSaving={isSaving}
        error={saveError}
        existingNames={existingTemplateNames}
      />
    </div>
  );
}
