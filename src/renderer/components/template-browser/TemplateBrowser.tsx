/**
 * Template Browser Component
 *
 * Modal dialog with split-pane layout for browsing and selecting templates.
 * Left side displays a filterable template list, right side shows preview.
 *
 * Feature: 016-template-library
 * FR-019: Keyboard navigation support (arrows, Enter, Escape)
 *
 * @module renderer/components/template-browser/TemplateBrowser
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@ui/dialog';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import { Upload, Download } from 'lucide-react';
import { useTemplateStore, selectFilteredTemplates } from '@renderer/stores/template-store';
import { TemplateCard } from './TemplateCard';
import { TemplateFilters } from './TemplateFilters';
import {
  LoadingState,
  EmptyState,
  NoResultsState,
  ErrorState,
  TemplatePreviewPanel,
} from './TemplateBrowserStates';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { EditTemplateDialog, type EditTemplateFormData } from './EditTemplateDialog';
import type { Template, TemplateMetadata } from '@shared/contracts/template-schemas';

// =============================================================================
// Types
// =============================================================================

/**
 * Props for the TemplateBrowser component.
 */
export interface TemplateBrowserProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when a template is selected for use */
  onSelect: (template: Template) => void;
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Template browser modal dialog with split-pane layout.
 *
 * Layout:
 * ```
 * ┌─────────────────────────────────────────────────────────┐
 * │ Template Browser                               [×]      │
 * ├─────────────────────────────────────────────────────────┤
 * │ [Search...                        ] [Category ▼]       │
 * ├─────────────────────┬───────────────────────────────────┤
 * │  Template List      │   Preview                         │
 * │  (scrollable)       │   (scrollable)                    │
 * ├─────────────────────┴───────────────────────────────────┤
 * │                        [Cancel]  [Use Template]         │
 * └─────────────────────────────────────────────────────────┘
 * ```
 *
 * Features:
 * - Loads templates on mount
 * - Filters templates by search and category
 * - Keyboard navigation (arrows, Enter, Escape)
 * - Shows loading, empty, error, and no-results states
 */
export function TemplateBrowser({
  isOpen,
  onClose,
  onSelect,
}: TemplateBrowserProps): React.JSX.Element {
  // Store state
  const templates = useTemplateStore(selectFilteredTemplates);
  const allTemplates = useTemplateStore((state) => state.templates);
  const selectedId = useTemplateStore((state) => state.selectedId);
  const selectedTemplate = useTemplateStore((state) => state.selectedTemplate);
  const isLoading = useTemplateStore((state) => state.isLoading);
  const error = useTemplateStore((state) => state.error);
  const searchQuery = useTemplateStore((state) => state.searchQuery);
  const categoryFilter = useTemplateStore((state) => state.categoryFilter);

  // Store actions
  const loadTemplates = useTemplateStore((state) => state.loadTemplates);
  const selectTemplate = useTemplateStore((state) => state.selectTemplate);
  const clearSelection = useTemplateStore((state) => state.clearSelection);
  const setSearchQuery = useTemplateStore((state) => state.setSearchQuery);
  const setCategoryFilter = useTemplateStore((state) => state.setCategoryFilter);
  const deleteTemplate = useTemplateStore((state) => state.deleteTemplate);
  const saveTemplate = useTemplateStore((state) => state.saveTemplate);
  const importTemplate = useTemplateStore((state) => state.importTemplate);
  const exportTemplate = useTemplateStore((state) => state.exportTemplate);

  // Local state for tracking which template is loading
  const [isSelectingTemplate, setIsSelectingTemplate] = useState(false);

  // Local state for edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateMetadata | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Local state for delete dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateMetadata | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local state for import/export operations
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Refs for keyboard navigation
  const templateListRef = useRef<HTMLDivElement>(null);
  const focusedIndexRef = useRef<number>(-1);

  // Load templates when dialog opens
  useEffect(() => {
    if (isOpen) {
      void loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      clearSelection();
      setSearchQuery('');
      setCategoryFilter(null);
      focusedIndexRef.current = -1;
    }
  }, [isOpen, clearSelection, setSearchQuery, setCategoryFilter]);

  // Handle template card selection
  const handleTemplateSelect = useCallback(
    async (id: string) => {
      setIsSelectingTemplate(true);
      await selectTemplate(id);
      setIsSelectingTemplate(false);
    },
    [selectTemplate]
  );

  // Handle "Use Template" button click
  const handleUseTemplate = useCallback(() => {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
      onClose();
    }
  }, [selectedTemplate, onSelect, onClose]);

  // Handle clearing filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setCategoryFilter(null);
  }, [setSearchQuery, setCategoryFilter]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // Compute existing template names for duplicate detection (for edit dialog)
  const existingTemplateNames = useMemo(
    () => allTemplates.map((t) => t.name),
    [allTemplates]
  );

  // Handle edit request (open edit dialog)
  const handleEditRequest = useCallback(
    (id: string) => {
      const template = allTemplates.find((t) => t.id === id);
      if (template && !template.isBuiltIn) {
        setEditingTemplate(template);
        setEditError(null);
        setIsEditDialogOpen(true);
      }
    },
    [allTemplates]
  );

  // Handle edit dialog close
  const handleEditDialogClose = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditingTemplate(null);
    setEditError(null);
  }, []);

  // Handle edit save
  const handleEditSave = useCallback(
    async (data: EditTemplateFormData) => {
      if (!editingTemplate) return;

      setIsEditSaving(true);
      setEditError(null);

      try {
        // Get the full template to preserve content and variables
        const fullTemplateResult = await window.mdxpad.template.get(data.id);
        if (!fullTemplateResult.success) {
          setEditError(fullTemplateResult.error);
          setIsEditSaving(false);
          return;
        }

        // Save with updated metadata
        await saveTemplate(
          {
            id: data.id,
            name: data.name,
            description: data.description,
            category: data.category,
            tags: data.tags,
            variables: fullTemplateResult.data.variables ?? [],
            content: fullTemplateResult.data.content,
          },
          true // replace existing
        );

        setIsEditDialogOpen(false);
        setEditingTemplate(null);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to save template');
      } finally {
        setIsEditSaving(false);
      }
    },
    [editingTemplate, saveTemplate]
  );

  // Handle delete request (open delete dialog)
  const handleDeleteRequest = useCallback(
    (id: string) => {
      const template = allTemplates.find((t) => t.id === id);
      if (template && !template.isBuiltIn) {
        setDeletingTemplate(template);
        setIsDeleteDialogOpen(true);
      }
    },
    [allTemplates]
  );

  // Handle delete dialog close
  const handleDeleteDialogClose = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeletingTemplate(null);
  }, []);

  // Handle delete confirm
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingTemplate) return;

    setIsDeleting(true);

    try {
      await deleteTemplate(deletingTemplate.id);
      setIsDeleteDialogOpen(false);
      setDeletingTemplate(null);
    } catch (err) {
      // Error is handled in the store
      console.error('Failed to delete template:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [deletingTemplate, deleteTemplate]);

  // Handle import button click
  const handleImport = useCallback(async () => {
    setIsImporting(true);

    try {
      const dialogResult = await window.mdxpad.template.showOpenDialog();
      if (!dialogResult.success) {
        console.error('Failed to show open dialog:', dialogResult.error);
        return;
      }

      if (dialogResult.data.canceled || !dialogResult.data.path) {
        return;
      }

      await importTemplate(dialogResult.data.path, false);
    } catch (err) {
      console.error('Failed to import template:', err);
    } finally {
      setIsImporting(false);
    }
  }, [importTemplate]);

  // Handle export button click
  const handleExport = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsExporting(true);

    try {
      const dialogResult = await window.mdxpad.template.showSaveDialog(selectedTemplate.name);
      if (!dialogResult.success) {
        console.error('Failed to show save dialog:', dialogResult.error);
        return;
      }

      if (dialogResult.data.canceled || !dialogResult.data.path) {
        return;
      }

      await exportTemplate(selectedTemplate.id, dialogResult.data.path);
    } catch (err) {
      console.error('Failed to export template:', err);
    } finally {
      setIsExporting(false);
    }
  }, [selectedTemplate, exportTemplate]);

  // Computed template IDs for keyboard navigation
  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (templates.length === 0) {
        return;
      }

      const currentIndex = focusedIndexRef.current;
      let newIndex = currentIndex;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = currentIndex < templates.length - 1 ? currentIndex + 1 : 0;
          break;

        case 'ArrowUp':
          event.preventDefault();
          newIndex = currentIndex > 0 ? currentIndex - 1 : templates.length - 1;
          break;

        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;

        case 'End':
          event.preventDefault();
          newIndex = templates.length - 1;
          break;

        case 'Enter':
          event.preventDefault();
          if (selectedTemplate) {
            handleUseTemplate();
          } else if (currentIndex >= 0 && currentIndex < templates.length) {
            const template = templates[currentIndex];
            if (template) {
              void handleTemplateSelect(template.id);
            }
          }
          return;

        default:
          return;
      }

      // Update focused index and select template
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < templates.length) {
        const targetTemplate = templates[newIndex];
        if (targetTemplate) {
          focusedIndexRef.current = newIndex;
          void handleTemplateSelect(targetTemplate.id);

          // Focus the card element for visual feedback
          const cardElement = templateListRef.current?.querySelector(
            `[data-template-id="${targetTemplate.id}"]`
          ) as HTMLElement | null;
          cardElement?.focus();
        }
      }
    },
    [templates, selectedTemplate, handleUseTemplate, handleTemplateSelect]
  );

  // Update focused index when selection changes externally
  useEffect(() => {
    if (selectedId) {
      const index = templateIds.indexOf(selectedId);
      if (index !== -1) {
        focusedIndexRef.current = index;
      }
    }
  }, [selectedId, templateIds]);

  // Determine which state to show in the template list
  const showLoading = isLoading && allTemplates.length === 0;
  const showError = error !== null && allTemplates.length === 0;
  const showEmpty = !isLoading && !error && allTemplates.length === 0;
  const showNoResults = !isLoading && !error && allTemplates.length > 0 && templates.length === 0;
  const showTemplates = !isLoading && !error && templates.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[90vw] h-[80vh] max-h-[700px] flex flex-col p-0 gap-0"
        onKeyDown={handleKeyDown}
        aria-describedby="template-browser-description"
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Template Browser</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                disabled={isImporting}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!selectedTemplate || isExporting}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
          <DialogDescription id="template-browser-description" className="sr-only">
            Browse and select a template to create a new document. Use arrow keys to navigate,
            Enter to select.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-muted/30">
          <TemplateFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />
        </div>

        {/* Split-pane content */}
        <div className="flex-1 flex min-h-0">
          {/* Left side: Template list */}
          <div
            ref={templateListRef}
            className="w-2/5 min-w-[240px] border-r border-border flex flex-col"
            role="listbox"
            aria-label="Template list"
            tabIndex={0}
          >
            {showLoading && <LoadingState isVisible={true} />}
            {showError && <ErrorState error={error} onRetry={handleRetry} />}
            {showEmpty && <EmptyState />}
            {showNoResults && <NoResultsState onClearFilters={handleClearFilters} />}
            {showTemplates && (
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedId === template.id}
                      onSelect={handleTemplateSelect}
                      onEdit={handleEditRequest}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Right side: Preview */}
          <div className="flex-1 bg-muted/20 min-w-0">
            <TemplatePreviewPanel
              template={selectedTemplate}
              isLoading={isSelectingTemplate && selectedId !== null && selectedTemplate === null}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleUseTemplate} disabled={!selectedTemplate}>
            Use Template
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        isOpen={isEditDialogOpen}
        onClose={handleEditDialogClose}
        onSave={handleEditSave}
        template={editingTemplate}
        isSaving={isEditSaving}
        error={editError}
        existingNames={existingTemplateNames}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleDeleteDialogClose}
        onConfirm={handleDeleteConfirm}
        templateName={deletingTemplate?.name ?? ''}
        isDeleting={isDeleting}
      />
    </Dialog>
  );
}

export default TemplateBrowser;
