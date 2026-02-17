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

import React, { useEffect } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { EditorPane } from './components/shell/EditorPane';
import { PreviewPane } from './components/shell/PreviewPane';
import { StatusBar } from './components/shell/StatusBar';
import { OutlinePanel } from './components/outline';
import { FrontmatterPanel } from './components/frontmatter';
import { TemplateBrowser } from './components/template-browser/TemplateBrowser';
import { VariableDialog } from './components/template-browser/VariableDialog';
import { SaveTemplateDialog } from './components/template-browser/SaveTemplateDialog';
import { RecoveryDialog } from './components/recovery-dialog';
import { SettingsPanel } from './components/settings-panel';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { useTemplateBrowserModalStore } from './stores/template-browser-store';
import { useAppState } from './hooks/useAppState';
import { useMenuEvents } from './hooks/useMenuEvents';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum pane size as percentage (10% = ~100px at 1000px width) */
const MIN_PANE_SIZE = 10;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Main App component with split-pane layout. */
// eslint-disable-next-line max-lines-per-function
export function App(): React.ReactElement {
  // ---------------------------------------------------------------------------
  // State (all store subscriptions, refs, handlers)
  // ---------------------------------------------------------------------------
  const state = useAppState();

  // ---------------------------------------------------------------------------
  // Menu events, commands, keyboard shortcuts, file-change watcher
  // ---------------------------------------------------------------------------
  const { palette, getCommandContext } = useMenuEvents(
    state.editorRef,
    state.handleNotification,
  );

  // ---------------------------------------------------------------------------
  // Expose template browser opener for tests
  // ---------------------------------------------------------------------------
  const openTemplateBrowser = useTemplateBrowserModalStore((s) => s.openTemplateBrowser);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__mdxpadTestOpenTemplateBrowser = openTemplateBrowser;
    return () => {
      delete (window as unknown as Record<string, unknown>).__mdxpadTestOpenTemplateBrowser;
    };
  }, [openTemplateBrowser]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
        {(state.frontmatterVisible || state.outlineVisible) && (
          <div className="flex flex-col w-64 border-r bg-muted/30 overflow-hidden">
            {state.frontmatterVisible && (
              <FrontmatterPanel className="flex-shrink-0" />
            )}
            {state.outlineVisible && (
              <OutlinePanel onNavigate={state.handleOutlineNavigate} className="flex-1 min-h-0" />
            )}
          </div>
        )}

        {/* Editor and Preview panels */}
        <ResizablePanelGroup
          direction="horizontal"
          onLayout={state.handleLayout}
          className="h-full flex-1"
        >
          {/* Editor Panel */}
          <ResizablePanel
            defaultSize={state.editorSize}
            minSize={MIN_PANE_SIZE}
            className="flex flex-col"
          >
            <EditorPane
              editorRef={state.editorRef}
              onCursorChange={state.handleCursorChange}
              className="flex-1"
              theme="system"
              height="100%"
            />
          </ResizablePanel>

          {/* Only show handle and preview when preview is visible */}
          {state.previewVisible && (
            <>
              <ResizableHandle withHandle />

              {/* Preview Panel */}
              <ResizablePanel
                defaultSize={state.previewSize}
                minSize={MIN_PANE_SIZE}
                className="flex flex-col"
              >
                <PreviewPane
                  className="flex-1 h-full"
                  theme="dark"
                  onErrorClick={state.handlePreviewErrorClick}
                  onErrorsChange={state.handleErrorsChange}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Status Bar - fixed at bottom */}
      <StatusBar
        fileName={state.fileName}
        isDirty={state.isDirty}
        line={state.cursorPosition.line}
        column={state.cursorPosition.column}
        errors={state.errors}
        onErrorClick={state.handleErrorClick}
        autosave={{
          isSaving: state.autosave.isSaving,
          lastSaveAt: state.autosave.lastSaveAt,
          lastSaveResult: state.autosave.lastSaveResult,
          lastError: state.autosave.lastError,
          consecutiveFailures: state.autosave.consecutiveFailures,
          onRetry: () => { void state.autosave.saveNow(); },
          onDisable: () => { state.autosave.disable(); },
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
        {state.announcement}
      </div>

      {/* Recovery Dialog overlay (T011, T012) */}
      <RecoveryDialog
        isOpen={state.recovery.isDialogOpen}
        entries={state.recovery.entries}
        onDecision={(d) => { void state.recovery.handleDecision(d); }}
      />

      {/* Settings Panel overlay (T019) */}
      <SettingsPanel isOpen={state.settingsOpen} onClose={state.closeSettings} />

      {/* Template Browser Modal (US1: Create from Template) */}
      <TemplateBrowser
        isOpen={state.isTemplateBrowserOpen}
        onClose={state.closeTemplateBrowser}
        onSelect={state.handleTemplateSelect}
      />

      {/* Variable Dialog Modal (for templates with dynamic variables) */}
      {state.pendingTemplate && (
        <VariableDialog
          isOpen={state.isVariableDialogOpen}
          onClose={state.handleVariableCancel}
          onSubmit={state.handleVariableSubmit}
          variables={state.pendingTemplate.variables}
          templateName={state.pendingTemplate.name}
        />
      )}

      {/* Save Template Dialog Modal (US3: Create Custom Template) */}
      <SaveTemplateDialog
        isOpen={state.isSaveTemplateDialogOpen}
        onClose={state.closeSaveTemplateDialog}
        onSave={(data) => { void state.handleSaveTemplate(data); }}
        content={state.documentContent}
        isSaving={state.isSaving}
        error={state.saveError}
        existingNames={state.existingTemplateNames}
      />
    </div>
  );
}
