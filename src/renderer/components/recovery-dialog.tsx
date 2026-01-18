/**
 * RecoveryDialog Component
 *
 * Modal dialog for crash recovery on application restart.
 * Displays a list of recoverable documents with options to restore,
 * discard, or dismiss the dialog.
 *
 * Features:
 * - Lists recoverable documents with file name, path, timestamp, and preview
 * - Content preview panel showing full document content on selection
 * - Checkboxes for selective document restoration (Phase 5 support)
 * - Full keyboard navigation support (Arrow keys, Space, Enter, Escape)
 * - Visual indicators for invalid/corrupted recovery files
 * - Accessible ARIA attributes for screen readers
 *
 * Per FR-004: Display recovery dialog on startup when recovery data exists.
 * Per FR-005: Show content preview for selected recovery entry.
 * Per FR-007: Explicit decline required to discard recovery data.
 *
 * @module renderer/components/recovery-dialog
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileText, Clock, Check, X, Loader2, Eye, GitBranch } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import type { RecoveryDialogEntry, RecoveryDecision, DocumentId } from '@shared/contracts/autosave-schemas';
import type { RecoveryPreviewResponse } from '@shared/contracts/autosave-ipc';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the RecoveryDialog component.
 */
export interface RecoveryDialogProps {
  /** Whether the dialog is currently open */
  readonly isOpen: boolean;
  /** List of recoverable document entries to display */
  readonly entries: readonly RecoveryDialogEntry[];
  /** Callback when user makes a recovery decision */
  readonly onDecision: (decision: RecoveryDecision) => void;
}

/**
 * Props for individual recovery entry items.
 */
interface RecoveryEntryItemProps {
  /** The recovery entry data */
  readonly entry: RecoveryDialogEntry;
  /** Whether this entry is currently selected (focused) */
  readonly isSelected: boolean;
  /** Whether this entry's checkbox is checked */
  readonly isChecked: boolean;
  /** Callback when checkbox state changes */
  readonly onToggle: () => void;
  /** Callback when entry is clicked */
  readonly onClick: () => void;
}

/**
 * Preview state for a document.
 */
interface PreviewState {
  /** Loading state while fetching */
  readonly isLoading: boolean;
  /** Full content if successfully fetched */
  readonly content: string | null;
  /** Error message if fetch failed */
  readonly error: string | null;
  /** Timestamp when preview was fetched */
  readonly fetchedAt: number | null;
}

/**
 * Props for the ContentPreview component.
 */
interface ContentPreviewProps {
  /** The currently focused entry */
  readonly entry: RecoveryDialogEntry | null;
  /** Preview state for the entry */
  readonly previewState: PreviewState | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Maximum length for content preview display in list */
const MAX_PREVIEW_LENGTH = 100;

/** ID prefix for list items (accessibility) */
const ITEM_ID_PREFIX = 'recovery-item-';

/** Debounce delay for fetching preview (ms) */
const PREVIEW_FETCH_DEBOUNCE_MS = 300;

/** Cache duration for previews (5 minutes) */
const PREVIEW_CACHE_DURATION_MS = 5 * 60 * 1000;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format a Unix timestamp as a human-readable date/time string.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date/time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate content preview to a maximum length.
 *
 * @param content - Content string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with ellipsis if needed
 */
function truncatePreview(content: string, maxLength: number = MAX_PREVIEW_LENGTH): string {
  const trimmed = content.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

// =============================================================================
// IPC STUB
// =============================================================================

/**
 * Fetch full content preview for a document via IPC.
 * @param documentId - The document ID to fetch preview for
 * @returns Promise resolving to preview response
 */
async function fetchPreview(documentId: DocumentId): Promise<RecoveryPreviewResponse> {
  // TODO: Replace with actual IPC call
  // return window.mdxpad.recovery.preview({ documentId });
  console.debug('[RecoveryDialog] Fetching preview for:', documentId);
  throw new Error('Preview API not available - preload needs update');
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Content preview panel showing full document content.
 */
const ContentPreview = memo(function ContentPreviewComponent({
  entry,
  previewState,
}: ContentPreviewProps): React.JSX.Element {
  // No entry selected
  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Eye className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
        <p className="text-sm text-center">
          Select a document to preview its content
        </p>
      </div>
    );
  }

  // Loading state
  if (previewState?.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <Loader2 className="w-6 h-6 animate-spin mb-2" aria-hidden="true" />
        <p className="text-sm">Loading preview...</p>
      </div>
    );
  }

  // Error state
  if (previewState?.error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <AlertTriangle className="w-6 h-6 text-yellow-500 mb-2" aria-hidden="true" />
        <p className="text-sm text-center text-destructive">
          Failed to load preview
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {previewState.error}
        </p>
      </div>
    );
  }

  // Content available - show preview
  const content = previewState?.content ?? entry.contentPreview ?? '';

  return (
    <div className="flex flex-col h-full">
      {/* Header with file info */}
      <div className="flex-shrink-0 border-b px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <FileText className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span className="truncate" title={entry.fileName}>
            {entry.fileName}
          </span>
        </div>
        {entry.filePath && (
          <p className="text-xs text-muted-foreground truncate mt-0.5" title={entry.filePath}>
            {entry.filePath}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>Autosaved {formatTimestamp(entry.savedAt)}</span>
        </div>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-words text-foreground/90">
          {content || (
            <span className="text-muted-foreground italic">
              No content available
            </span>
          )}
        </pre>
      </ScrollArea>
    </div>
  );
});

ContentPreview.displayName = 'ContentPreview';

/**
 * Individual recovery entry item with checkbox.
 */
// eslint-disable-next-line max-lines-per-function -- Complex UI component with multiple visual elements
const RecoveryEntryItem = memo(function RecoveryEntryItemComponent({
  entry,
  isSelected,
  isChecked,
  onToggle,
  onClick,
}: RecoveryEntryItemProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  return (
    <div
      id={`${ITEM_ID_PREFIX}${entry.documentId}`}
      role="option"
      aria-selected={isSelected}
      aria-checked={isChecked}
      tabIndex={isSelected ? 0 : -1}
      className={cn(
        'flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors',
        'border border-transparent',
        isSelected && 'bg-accent border-accent-foreground/20',
        !isSelected && 'hover:bg-muted/50',
        !entry.isValid && 'opacity-75'
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      data-testid={`recovery-entry-${entry.documentId}`}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
          isChecked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background'
        )}
        role="checkbox"
        aria-checked={isChecked}
        aria-label={`Select ${entry.fileName}`}
      >
        {isChecked && <Check className="w-3 h-3" aria-hidden="true" />}
      </div>

      {/* Document info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* File icon or warning */}
          {entry.isValid ? (
            <FileText className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 text-yellow-500"
              aria-label="Recovery file may be corrupted"
            />
          )}

          {/* File name */}
          <span className="font-medium text-sm truncate" title={entry.fileName}>
            {entry.fileName}
          </span>

          {/* Invalid badge */}
          {!entry.isValid && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
              May be corrupted
            </span>
          )}

          {/* Conflict badge - per FR-016 */}
          {entry.hasConflict && (
            <span
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-600 dark:text-orange-400"
              title="The file on disk was modified after this recovery was saved"
            >
              <GitBranch className="w-3 h-3" aria-hidden="true" />
              Conflict
            </span>
          )}
        </div>

        {/* File path */}
        {entry.filePath && (
          <p
            className="text-xs text-muted-foreground truncate mt-0.5"
            title={entry.filePath}
          >
            {entry.filePath}
          </p>
        )}
        {!entry.filePath && (
          <p className="text-xs text-muted-foreground/70 italic mt-0.5">
            Untitled document
          </p>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>Autosaved {formatTimestamp(entry.savedAt)}</span>
        </div>

        {/* Content preview */}
        {entry.contentPreview && (
          <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2 italic">
            {truncatePreview(entry.contentPreview)}
          </p>
        )}
      </div>
    </div>
  );
});

RecoveryEntryItem.displayName = 'RecoveryEntryItem';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Recovery dialog for restoring documents after a crash.
 *
 * Displays a list of recoverable documents and allows users to:
 * - Select specific documents to restore (via checkboxes)
 * - Restore all selected documents
 * - Discard all recovery data (with explicit confirmation)
 * - Dismiss the dialog (preserves recovery data for next startup)
 *
 * @example
 * ```tsx
 * <RecoveryDialog
 *   isOpen={showRecoveryDialog}
 *   entries={recoverableDocuments}
 *   onDecision={(decision) => {
 *     if (decision.action === 'accept') {
 *       restoreDocuments(decision.selectedIds);
 *     }
 *   }}
 * />
 * ```
 */
// eslint-disable-next-line max-lines-per-function -- Complex modal dialog with keyboard navigation and state management
function RecoveryDialogComponent({
  isOpen,
  entries,
  onDecision,
}: RecoveryDialogProps): React.JSX.Element {
  // Track which entries are checked for selective recovery
  const [checkedIds, setCheckedIds] = useState<Set<DocumentId>>(new Set());

  // Track which entry is currently focused for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Ref to the list container for focus management
  const listRef = useRef<HTMLDivElement>(null);

  // Preview cache: Map<DocumentId, PreviewState>
  const [previewCache, setPreviewCache] = useState<Map<DocumentId, PreviewState>>(new Map());

  // Debounce timer ref for preview fetching
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the currently focused entry
  const focusedEntry = entries[focusedIndex] ?? null;

  // Get preview state for focused entry
  const currentPreviewState = focusedEntry
    ? previewCache.get(focusedEntry.documentId) ?? null
    : null;

  // Initialize checked state when entries change or dialog opens
  useEffect(() => {
    if (isOpen && entries.length > 0) {
      // Pre-select all valid entries
      const validIds = new Set(
        entries.filter((e) => e.isValid).map((e) => e.documentId)
      );
      setCheckedIds(validIds);
      setFocusedIndex(0);
      // Clear preview cache when dialog opens with new entries
      setPreviewCache(new Map());
    }
  }, [isOpen, entries]);

  /**
   * Fetch preview for a document with debouncing and caching.
   */
  const fetchPreviewForDocument = useCallback(async (documentId: DocumentId) => {
    // Check cache first
    const cached = previewCache.get(documentId);
    if (cached && cached.content !== null && cached.fetchedAt !== null) {
      const age = Date.now() - cached.fetchedAt;
      if (age < PREVIEW_CACHE_DURATION_MS) {
        // Cache is still valid, no need to fetch
        return;
      }
    }

    // Set loading state
    setPreviewCache(prev => {
      const next = new Map(prev);
      next.set(documentId, {
        isLoading: true,
        content: null,
        error: null,
        fetchedAt: null,
      });
      return next;
    });

    try {
      const response = await fetchPreview(documentId);

      if (response.ok) {
        setPreviewCache(prev => {
          const next = new Map(prev);
          next.set(documentId, {
            isLoading: false,
            content: response.content,
            error: null,
            fetchedAt: Date.now(),
          });
          return next;
        });
      } else {
        // Map error codes to user-friendly messages
        const errorMessages: Record<string, string> = {
          NOT_FOUND: 'Recovery file not found',
          CORRUPTED: 'Recovery file is corrupted',
          READ_ERROR: 'Failed to read recovery file',
        };
        setPreviewCache(prev => {
          const next = new Map(prev);
          next.set(documentId, {
            isLoading: false,
            content: null,
            error: errorMessages[response.error] ?? 'Unknown error',
            fetchedAt: null,
          });
          return next;
        });
      }
    } catch (err) {
      // Handle IPC not available or other errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch preview';
      setPreviewCache(prev => {
        const next = new Map(prev);
        next.set(documentId, {
          isLoading: false,
          content: null,
          error: errorMessage,
          fetchedAt: null,
        });
        return next;
      });
    }
  }, [previewCache]);

  // Fetch preview when focused entry changes (debounced)
  useEffect(() => {
    if (!isOpen || !focusedEntry) return;

    // Clear previous debounce timer
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    // Check if we already have a valid cached preview
    const cached = previewCache.get(focusedEntry.documentId);
    if (cached && cached.content !== null && cached.fetchedAt !== null) {
      const age = Date.now() - cached.fetchedAt;
      if (age < PREVIEW_CACHE_DURATION_MS) {
        return; // Already have valid cache
      }
    }

    // Debounce the fetch
    previewDebounceRef.current = setTimeout(() => {
      fetchPreviewForDocument(focusedEntry.documentId);
    }, PREVIEW_FETCH_DEBOUNCE_MS);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [isOpen, focusedEntry, previewCache, fetchPreviewForDocument]);

  // Memoize selected IDs array for decision callback
  const selectedIds = useMemo(() => Array.from(checkedIds), [checkedIds]);

  // Count selected entries
  const selectedCount = checkedIds.size;
  const hasSelection = selectedCount > 0;

  /**
   * Toggle checkbox state for an entry.
   */
  const handleToggle = useCallback((documentId: DocumentId) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  }, []);

  /**
   * Handle "Restore Selected" button click.
   */
  const handleAccept = useCallback(() => {
    onDecision({
      action: 'accept',
      selectedIds,
    });
  }, [onDecision, selectedIds]);

  /**
   * Handle "Discard All" button click.
   * Per FR-007: Explicit decline discards all recovery data.
   */
  const handleDecline = useCallback(() => {
    onDecision({ action: 'decline' });
  }, [onDecision]);

  /**
   * Handle dialog dismiss (X button or Escape).
   * Preserves recovery data for next startup.
   */
  const handleDismiss = useCallback(() => {
    onDecision({ action: 'dismiss' });
  }, [onDecision]);

  /**
   * Handle clicking on an entry row.
   */
  const handleEntryClick = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      const entry = entries[index];
      if (entry) {
        handleToggle(entry.documentId);
      }
    },
    [entries, handleToggle]
  );

  /**
   * Handle keyboard navigation within the list.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (entries.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, entries.length - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case ' ': {
          e.preventDefault();
          const focusedEntry = entries[focusedIndex];
          if (focusedEntry) {
            handleToggle(focusedEntry.documentId);
          }
          break;
        }

        case 'Enter':
          e.preventDefault();
          if (hasSelection) {
            handleAccept();
          }
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(entries.length - 1);
          break;

        case 'a':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            // Select all valid entries
            const allValidIds = new Set(
              entries.filter((entry) => entry.isValid).map((entry) => entry.documentId)
            );
            setCheckedIds(allValidIds);
          }
          break;
      }
    },
    [entries, focusedIndex, handleToggle, hasSelection, handleAccept]
  );

  // Scroll focused item into view
  useEffect(() => {
    if (!isOpen || entries.length === 0) return;

    const focusedId = entries[focusedIndex]?.documentId;
    if (!focusedId) return;

    const element = document.getElementById(`${ITEM_ID_PREFIX}${focusedId}`);
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isOpen, focusedIndex, entries]);

  // Focus the list container when dialog opens
  useEffect(() => {
    if (isOpen && listRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.focus();
      });
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent
        className="max-w-4xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
        data-testid="recovery-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" aria-hidden="true" />
            Recover Unsaved Work
          </DialogTitle>
          <DialogDescription>
            {entries.length === 1
              ? 'Found 1 document with unsaved changes from a previous session.'
              : `Found ${entries.length} documents with unsaved changes from a previous session.`}
          </DialogDescription>
        </DialogHeader>

        {/* Split view: Document list and Content preview */}
        <div className="flex-1 min-h-0 -mx-6 my-4">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full min-h-[300px]"
          >
            {/* Document list panel */}
            <ResizablePanel defaultSize={45} minSize={30}>
              <ScrollArea className="h-full px-6">
                <div
                  ref={listRef}
                  role="listbox"
                  aria-label="Recoverable documents"
                  aria-multiselectable="true"
                  aria-activedescendant={
                    entries[focusedIndex]
                      ? `${ITEM_ID_PREFIX}${entries[focusedIndex].documentId}`
                      : undefined
                  }
                  tabIndex={0}
                  className="space-y-2 outline-none pr-2"
                  data-testid="recovery-list"
                >
                  {entries.map((entry, index) => (
                    <RecoveryEntryItem
                      key={entry.documentId}
                      entry={entry}
                      isSelected={index === focusedIndex}
                      isChecked={checkedIds.has(entry.documentId)}
                      onToggle={() => handleToggle(entry.documentId)}
                      onClick={() => handleEntryClick(index)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </ResizablePanel>

            {/* Resizable handle */}
            <ResizableHandle withHandle />

            {/* Content preview panel */}
            <ResizablePanel defaultSize={55} minSize={30}>
              <div
                className="h-full border-l bg-muted/20"
                data-testid="recovery-preview"
                aria-label="Document preview"
              >
                <ContentPreview
                  entry={focusedEntry}
                  previewState={currentPreviewState}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Footer with actions */}
        <DialogFooter className="gap-2 sm:gap-2">
          {/* Selection indicator */}
          <div className="flex-1 text-sm text-muted-foreground hidden sm:block">
            {selectedCount} of {entries.length} selected
          </div>

          {/* Action buttons */}
          <Button
            variant="destructive"
            onClick={handleDecline}
            data-testid="recovery-discard-button"
          >
            <X className="w-4 h-4 mr-1" aria-hidden="true" />
            Discard All
          </Button>
          <Button
            variant="default"
            onClick={handleAccept}
            disabled={!hasSelection}
            data-testid="recovery-restore-button"
          >
            <Check className="w-4 h-4 mr-1" aria-hidden="true" />
            Restore Selected ({selectedCount})
          </Button>
        </DialogFooter>

        {/* Keyboard hints for screen readers */}
        <div className="sr-only" aria-live="polite">
          Use arrow keys to navigate, Space to toggle selection, Enter to restore selected.
          Press Escape to dismiss and keep recovery data.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Memoized RecoveryDialog component.
 */
export const RecoveryDialog = memo(RecoveryDialogComponent);
RecoveryDialog.displayName = 'RecoveryDialog';

export default RecoveryDialog;
