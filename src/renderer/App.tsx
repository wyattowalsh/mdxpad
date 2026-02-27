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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { EditorPane } from './components/shell/EditorPane';
import { PreviewPane } from './components/shell/PreviewPane';
import { StatusBar } from './components/shell/StatusBar';
import { OutlinePanel } from './components/outline';
import { FrontmatterPanel } from './components/frontmatter';
import { FileTreeFilter, FilterHighlight } from './components/file-explorer';
import { TemplateBrowser } from './components/template-browser/TemplateBrowser';
import { VariableDialog } from './components/template-browser/VariableDialog';
import { SaveTemplateDialog } from './components/template-browser/SaveTemplateDialog';
import { RecoveryDialog } from './components/recovery-dialog';
import { ConflictDialog } from './components/conflict-dialog';
import { SettingsPanel } from './components/settings-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { useTemplateBrowserModalStore } from './stores/template-browser-store';
import { useUILayoutStore, selectSidebarVisible } from './stores/ui-layout-store';
import { useFeatureFlagsStore, selectFeatureFlag } from './stores/feature-flags-store';
import {
  useFileExplorerStore,
  selectFilterQuery,
  selectIsFilterActive,
  selectIsFiltering,
  selectMatchResults,
} from './stores/file-explorer-store';
import { useDocumentStore } from './stores/document-store';
import { useFrontmatterStore } from './stores/frontmatter-store';
import { useAppState } from './hooks/useAppState';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useFilterDebounce, type FileEntry } from './hooks/useFilterDebounce';
import { replaceFrontmatter } from './lib/frontmatter';
import { ProviderSettings } from './features/ai-provider/components';
import { useAIProviderStore } from './features/ai-provider/store';
import type {
  RecoveryDecision,
  ConflictResolution,
  FileConflict,
} from '@shared/contracts/autosave-schemas';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum pane size as percentage (10% = ~100px at 1000px width) */
const MIN_PANE_SIZE = 10;
const FRONTMATTER_SYNC_DELAY_MS = 150;

function buildExplorerEntries(filePath: string | null, fileName: string): readonly FileEntry[] {
  if (!filePath) {
    return [{ id: 'untitled', path: fileName, name: fileName }];
  }

  const lastSlash = filePath.lastIndexOf('/');
  const parentPath = lastSlash > 0 ? filePath.slice(0, lastSlash) : '';
  const parentName = parentPath.includes('/')
    ? parentPath.slice(parentPath.lastIndexOf('/') + 1)
    : parentPath;

  const entries: FileEntry[] = [];
  if (parentPath && parentName) {
    entries.push({
      id: parentPath,
      path: parentPath,
      name: parentName,
    });
  }

  entries.push({
    id: filePath,
    path: filePath,
    name: fileName,
  });

  return entries;
}

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
  const sidebarVisible = useUILayoutStore(selectSidebarVisible);
  const aiFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('ai'));
  const authoringFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('authoring'));
  const aiProviderSettingsOpen = useAIProviderStore((s) => s.settingsOpen);
  const closeAiProviderSettings = useAIProviderStore((s) => s.closeSettings);
  const filterQuery = useFileExplorerStore(selectFilterQuery);
  const isFilterActive = useFileExplorerStore(selectIsFilterActive);
  const isFiltering = useFileExplorerStore(selectIsFiltering);
  const matchResults = useFileExplorerStore(selectMatchResults);
  const matchResultCount = matchResults.size;
  const isFilterQueryActive = filterQuery.trim().length > 0;
  const [activeConflict, setActiveConflict] = useState<FileConflict | null>(null);
  const isMountedRef = useRef(true);
  const frontmatterSyncTokenRef = useRef(0);

  const explorerEntries = useMemo(
    () => buildExplorerEntries(state.filePath, state.fileName),
    [state.filePath, state.fileName]
  );
  useFilterDebounce({
    query: filterQuery,
    files: explorerEntries,
    enabled: sidebarVisible && isFilterQueryActive,
  });

  const visibleExplorerEntries = useMemo(() => {
    if (!isFilterActive) {
      return explorerEntries;
    }
    return explorerEntries.filter((entry) => matchResults.has(entry.id));
  }, [explorerEntries, isFilterActive, matchResults]);

  useEffect(() => {
    if (isFilterQueryActive) {
      return;
    }
    if (!isFilterActive && matchResultCount === 0 && !isFiltering) {
      return;
    }
    useFileExplorerStore.getState().applyFilterResults(new Map(), 0);
  }, [isFilterQueryActive, isFilterActive, isFiltering, matchResultCount]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    frontmatterSyncTokenRef.current += 1;
    const syncToken = frontmatterSyncTokenRef.current;
    const contentSnapshot = state.documentContent;
    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current || frontmatterSyncTokenRef.current !== syncToken) {
        return;
      }
      const frontmatterStore = useFrontmatterStore.getState();
      if (frontmatterStore.lastChangeSource !== 'panel') {
        frontmatterStore.parseFromDocument(contentSnapshot);
      }
    }, FRONTMATTER_SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [state.documentContent]);

  useEffect(() => {
    const unsubscribe = useFrontmatterStore.subscribe((frontmatterState) => {
      if (!isMountedRef.current) {
        return;
      }
      if (
        frontmatterState.lastChangeSource !== 'panel' ||
        !frontmatterState.isDirty ||
        frontmatterState.mode !== 'visual'
      ) {
        return;
      }

      const currentContent = useDocumentStore.getState().content;
      const nextContent = replaceFrontmatter(currentContent, frontmatterState.serializeToYaml());

      if (nextContent !== currentContent) {
        useDocumentStore.getState().setContent(nextContent);
      }

      useFrontmatterStore.getState().setChangeSource('document');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddFrontmatter = useCallback(() => {
    useFrontmatterStore.getState().addField('title', 'text');
  }, []);

  const handleApplyAutoFix = useCallback((fixedContent: string) => {
    useDocumentStore.getState().setContent(fixedContent);
    useFrontmatterStore.getState().parseFromDocument(fixedContent);
  }, []);

  const handleRecoveryDecision = useCallback(
    async (decision: RecoveryDecision) => {
      if (decision.action !== 'accept' || decision.selectedIds.length !== 1) {
        await state.recovery.handleDecision(decision);
        return;
      }

      const selectedId = decision.selectedIds[0];
      if (selectedId === undefined) {
        await state.recovery.handleDecision(decision);
        return;
      }
      const selectedEntry = state.recovery.entries.find((entry) => entry.documentId === selectedId);

      if (!selectedEntry?.hasConflict) {
        await state.recovery.handleDecision(decision);
        return;
      }

      const preview = await window.mdxpad.recoveryPreview({ documentId: selectedId });
      if (!isMountedRef.current) {
        return;
      }
      if (preview.ok && preview.conflict) {
        setActiveConflict(preview.conflict);
        return;
      }

      await state.recovery.handleDecision(decision);
    },
    [state]
  );

  const handleConflictResolve = useCallback(
    async (resolution: ConflictResolution) => {
      if (resolution.choice === 'save-as') {
        state.handleNotification({
          type: 'warning',
          message: 'Save As conflict resolution is not supported yet',
        });
        return;
      }

      if (resolution.choice === 'recovery') {
        await state.recovery.handleDecision({
          action: 'accept',
          selectedIds: [resolution.documentId],
        });
      } else {
        await state.recovery.handleDecision({ action: 'decline' });
      }

      if (isMountedRef.current) {
        setActiveConflict(null);
      }
    },
    [state]
  );

  const handleConflictCancel = useCallback(() => {
    if (isMountedRef.current) {
      setActiveConflict(null);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Menu events, commands, keyboard shortcuts, file-change watcher
  // ---------------------------------------------------------------------------
  const { palette, getCommandContext } = useMenuEvents(state.editorRef, state.handleNotification);

  // ---------------------------------------------------------------------------
  // Expose template browser opener for tests
  // ---------------------------------------------------------------------------
  const openTemplateBrowser = useTemplateBrowserModalStore((s) => s.openTemplateBrowser);
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__mdxpadTestOpenTemplateBrowser =
      openTemplateBrowser;
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
        {/* Left Sidebar - Explorer, Frontmatter, and Outline Panels */}
        {sidebarVisible && (
          <div className="flex flex-col w-64 border-r bg-muted/30 overflow-hidden">
            <div className="flex-shrink-0 border-b">
              <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Explorer
              </div>
              <div className="px-2 pb-2">
                <FileTreeFilter />
              </div>
              <div className="max-h-40 overflow-y-auto px-2 pb-2">
                <ul className="space-y-1" data-testid="file-explorer-list">
                  {visibleExplorerEntries.map((entry) => {
                    const match = matchResults.get(entry.id);
                    return (
                      <li key={entry.id} className="rounded px-2 py-1 text-xs hover:bg-muted/60">
                        <FilterHighlight
                          text={entry.name}
                          positions={match?.positions ?? null}
                          highlightClassName="font-semibold text-foreground underline"
                          className="block truncate text-foreground"
                        />
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {entry.path}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {authoringFeatureEnabled && state.frontmatterVisible && (
              <FrontmatterPanel
                className="flex-shrink-0"
                onAddFrontmatter={handleAddFrontmatter}
                onApplyAutoFix={handleApplyAutoFix}
              />
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
          onRetry: () => {
            void state.autosave.saveNow();
          },
          onDisable: () => {
            state.autosave.disable();
          },
        }}
      />

      {/* Command Palette overlay */}
      <CommandPalette getContext={getCommandContext} palette={palette} />

      {/* T027: Screen reader announcement region for accessibility */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {state.announcement}
      </div>

      {/* Recovery Dialog overlay (T011, T012) */}
      <RecoveryDialog
        isOpen={state.recovery.isDialogOpen && activeConflict === null}
        entries={state.recovery.entries}
        onDecision={(d) => {
          void handleRecoveryDecision(d);
        }}
      />

      {/* Conflict dialog overlay (FR-016) */}
      <ConflictDialog
        isOpen={activeConflict !== null}
        conflict={activeConflict}
        onResolve={(resolution) => {
          void handleConflictResolve(resolution);
        }}
        onCancel={handleConflictCancel}
      />

      {/* Settings Panel overlay (T019) */}
      <SettingsPanel isOpen={state.settingsOpen} onClose={state.closeSettings} />

      {/* AI Provider Settings overlay */}
      {aiFeatureEnabled && (
        <Dialog
          open={aiProviderSettingsOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeAiProviderSettings();
            }
          }}
        >
          <DialogContent
            className="max-w-4xl h-[80vh] p-0 overflow-hidden"
            data-testid="ai-provider-settings-dialog"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>AI Provider Settings</DialogTitle>
              <DialogDescription>
                Manage configured AI providers and usage settings.
              </DialogDescription>
            </DialogHeader>
            <ProviderSettings />
          </DialogContent>
        </Dialog>
      )}

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
        onSave={(data) => {
          void state.handleSaveTemplate(data);
        }}
        content={state.documentContent}
        isSaving={state.isSaving}
        error={state.saveError}
        existingNames={state.existingTemplateNames}
      />
    </div>
  );
}
