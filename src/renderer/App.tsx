/**
 * Root application component.
 * Implements the main split-pane layout with tabs, breadcrumbs,
 * EditorPane, and PreviewPane.
 *
 * @module renderer/App
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from './components/CommandPalette';
import { EditorPane } from './components/shell/EditorPane';
import { PreviewPane } from './components/shell/PreviewPane';
import { StatusBar } from './components/shell/StatusBar';
import { OutlinePanel } from './components/outline';
import { WorkspacePanel } from './components/workspace/WorkspacePanel';
import { FrontmatterPanel } from './components/frontmatter';
import { FileTreeFilter, FilterHighlight } from './components/file-explorer';
import { TemplateBrowser } from './components/template-browser/TemplateBrowser';
import { VariableDialog } from './components/template-browser/VariableDialog';
import { SaveTemplateDialog } from './components/template-browser/SaveTemplateDialog';
import { RecoveryDialog } from './components/recovery-dialog';
import { ConflictDialog } from './components/conflict-dialog';
import { SettingsPanel } from './components/settings-panel';
import { TabBar } from './components/tabs';
import { Breadcrumb } from './components/breadcrumb';
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
import { useEditorPreferencesStore } from './stores/editor-preferences-store';
import { applySavedCustomCss } from './features/plugins/custom-css-storage';
import { initThemeManager } from './features/plugins/theme-manager';
import { openFileFromPath } from './lib/open-file-from-path';
import { MountedUtilityPanels } from './components/shell/MountedUtilityPanels';
import { CommentPersistence } from './components/comments/CommentWorkspace';
import { AiWriteSidebar } from './components/ai/AiWriteSidebar';
import { useAppState } from './hooks/useAppState';
import { useAppDialogs } from './hooks/useAppDialogs';
import { useMenuEvents } from './hooks/useMenuEvents';
import { useFilterDebounce, type FileEntry } from './hooks/useFilterDebounce';
import { useOpenedFolderFiles } from './hooks/useOpenedFolderFiles';
import { useDragDrop } from './hooks/useDragDrop';
import { useAccessibility } from './hooks/useAccessibility';
import { ProviderSettings } from './features/ai-provider/components';
import { useAIProviderStore } from './features/ai-provider/store';
// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_PANE_SIZE = 10;

function isOpenableDocument(filePath: string): boolean {
  const name = filePath.slice(filePath.lastIndexOf('/') + 1).toLowerCase();
  return (
    name.endsWith('.md') ||
    name.endsWith('.mdx') ||
    name.endsWith('.markdown') ||
    name.endsWith('.txt')
  );
}

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
    entries.push({ id: parentPath, path: parentPath, name: parentName });
  }
  entries.push({ id: filePath, path: filePath, name: fileName });
  return entries;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Main App component with split-pane layout. */
// eslint-disable-next-line max-lines-per-function
export function App(): React.ReactElement {
  useAccessibility();
  const state = useAppState();
  const dialogs = useAppDialogs(state);
  const sidebarVisible = useUILayoutStore(selectSidebarVisible);
  const aiFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('ai'));
  const authoringFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('authoring'));
  const workspaceFeatureEnabled = useFeatureFlagsStore(selectFeatureFlag('workspace'));
  const aiProviderSettingsOpen = useAIProviderStore((s) => s.settingsOpen);
  const closeAiProviderSettings = useAIProviderStore((s) => s.closeSettings);
  const distractionFree = useEditorPreferencesStore((s) => s.distractionFreeEnabled);
  useEffect(() => {
    initThemeManager();
    applySavedCustomCss();
  }, []);

  // File explorer filter state
  const filterQuery = useFileExplorerStore(selectFilterQuery);
  const isFilterActive = useFileExplorerStore(selectIsFilterActive);
  const isFiltering = useFileExplorerStore(selectIsFiltering);
  const matchResults = useFileExplorerStore(selectMatchResults);
  const matchResultCount = matchResults.size;
  const isFilterQueryActive = filterQuery.trim().length > 0;

  const isMountedRef = useRef(true);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return 'light';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (event: MediaQueryListEvent): void => {
      setPreviewTheme(event.matches ? 'dark' : 'light');
    };
    setPreviewTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', updateTheme);
    return () => {
      mediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  const openedFolder = useOpenedFolderFiles(state.filePath);
  const folderFiles = openedFolder.files;
  const explorerEntries = useMemo(() => {
    const base = buildExplorerEntries(state.filePath, state.fileName);
    const known = new Set(base.map((entry) => entry.path));
    const extra = folderFiles
      .filter((file) => !known.has(file.path))
      .map((file) => ({ id: file.path, path: file.path, name: file.name }));
    return [...base, ...extra];
  }, [folderFiles, state.fileName, state.filePath]);
  useFilterDebounce({
    query: filterQuery,
    files: explorerEntries,
    enabled: sidebarVisible && isFilterQueryActive,
  });

  const visibleExplorerEntries = useMemo(() => {
    if (!isFilterActive) return explorerEntries;
    return explorerEntries.filter((entry) => matchResults.has(entry.id));
  }, [explorerEntries, isFilterActive, matchResults]);

  useEffect(() => {
    if (isFilterQueryActive) return;
    if (!isFilterActive && matchResultCount === 0 && !isFiltering) return;
    useFileExplorerStore.getState().applyFilterResults(new Map(), 0);
  }, [isFilterQueryActive, isFilterActive, isFiltering, matchResultCount]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Drag & drop file opening
  const handleFileDrop = useCallback((filePath: string) => {
    void openFileFromPath(filePath).catch((err: unknown) => {
      console.error('[App] Failed to open dropped file:', err);
    });
  }, []);
  useDragDrop(handleFileDrop);

  // Template browser opener for tests
  const openTemplateBrowser = useTemplateBrowserModalStore((s) => s.openTemplateBrowser);
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      (window as unknown as Record<string, unknown>).__mdxpadTestOpenTemplateBrowser =
        openTemplateBrowser;
      return () => {
        delete (window as unknown as Record<string, unknown>).__mdxpadTestOpenTemplateBrowser;
      };
    }
    return undefined;
  }, [openTemplateBrowser]);

  const { palette, getCommandContext } = useMenuEvents(state.editorRef, state.handleNotification);

  // In distraction-free mode, hide sidebar, status bar, breadcrumb, and tabs
  const showChrome = !distractionFree;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {/* Title bar drag region */}
      {showChrome && (
        <div
          className="h-8 w-full flex-shrink-0"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
      )}

      {/* Tab bar */}
      {showChrome && <TabBar />}

      {/* Breadcrumb navigation */}
      {showChrome && (
        <Breadcrumb className="border-b border-border bg-muted/20 text-xs text-muted-foreground" />
      )}

      {/* Main content area with split panes */}
      <main className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left Sidebar */}
        {showChrome && sidebarVisible && (
          <div className="flex flex-col w-64 border-r bg-muted/30 overflow-hidden">
            <div className="flex-shrink-0 border-b">
              <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Explorer
              </div>
              <div className="px-2 pb-2">
                <FileTreeFilter />
              </div>
              <div className="max-h-40 overflow-y-auto px-2 pb-2">
                {openedFolder.error ? (
                  <p className="px-2 pb-2 text-xs text-destructive" role="alert">
                    {openedFolder.error}
                  </p>
                ) : null}
                <ul className="space-y-1" data-testid="file-explorer-list">
                  {visibleExplorerEntries.map((entry) => {
                    const match = matchResults.get(entry.id);
                    const name = (
                      <FilterHighlight
                        text={entry.name}
                        positions={match?.positions ?? null}
                        highlightClassName="font-semibold text-foreground underline"
                        className="block truncate text-foreground"
                      />
                    );
                    return (
                      <li key={entry.id} className="rounded px-2 py-1 text-xs hover:bg-muted/60">
                        {isOpenableDocument(entry.path) ? (
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => {
                              void openFileFromPath(entry.path);
                            }}
                          >
                            {name}
                          </button>
                        ) : (
                          name
                        )}
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
                onAddFrontmatter={dialogs.handleAddFrontmatter}
                onApplyAutoFix={dialogs.handleApplyAutoFix}
              />
            )}
            {workspaceFeatureEnabled && (
              <WorkspacePanel
                className="min-h-0 flex-1"
                rootPath={
                  state.filePath?.includes('/') === true
                    ? state.filePath.slice(0, state.filePath.lastIndexOf('/'))
                    : null
                }
                activeFilePath={state.filePath}
              />
            )}
            {aiFeatureEnabled && <AiWriteSidebar />}
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

          {state.previewVisible && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize={state.previewSize}
                minSize={MIN_PANE_SIZE}
                className="flex flex-col"
              >
                <PreviewPane
                  className="flex-1 h-full"
                  theme={previewTheme}
                  onErrorClick={state.handlePreviewErrorClick}
                  onErrorsChange={state.handleErrorsChange}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </main>

      {/* Status Bar */}
      {showChrome && (
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
      )}

      <CommandPalette getContext={getCommandContext} palette={palette} />
      <CommentPersistence />
      <MountedUtilityPanels editorRef={state.editorRef} />

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          state.announcement.length > 0
            ? 'border-t border-border px-3 py-1 text-xs text-muted-foreground'
            : 'sr-only'
        }
      >
        {state.announcement}
      </div>

      <RecoveryDialog
        isOpen={state.recovery.isDialogOpen && dialogs.activeConflict === null}
        entries={state.recovery.entries}
        onDecision={(d) => {
          void dialogs.handleRecoveryDecision(d);
        }}
      />

      <ConflictDialog
        isOpen={dialogs.activeConflict !== null}
        conflict={dialogs.activeConflict}
        onResolve={(resolution) => {
          void dialogs.handleConflictResolve(resolution);
        }}
        onCancel={dialogs.handleConflictCancel}
      />

      <SettingsPanel isOpen={state.settingsOpen} onClose={state.closeSettings} />

      {aiFeatureEnabled && (
        <Dialog
          open={aiProviderSettingsOpen}
          onOpenChange={(open) => {
            if (!open) closeAiProviderSettings();
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

      <TemplateBrowser
        isOpen={state.isTemplateBrowserOpen}
        onClose={state.closeTemplateBrowser}
        onSelect={state.handleTemplateSelect}
      />

      {state.pendingTemplate && (
        <VariableDialog
          isOpen={state.isVariableDialogOpen}
          onClose={state.handleVariableCancel}
          onSubmit={state.handleVariableSubmit}
          variables={state.pendingTemplate.variables}
          templateName={state.pendingTemplate.name}
        />
      )}

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
