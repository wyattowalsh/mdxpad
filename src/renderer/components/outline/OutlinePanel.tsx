/**
 * OutlinePanel Component
 *
 * Main outline panel that displays document structure as a navigable tree.
 * Shows headings, components, and frontmatter sections.
 *
 * @module renderer/components/outline/OutlinePanel
 */

import { memo, useCallback, useRef, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { OutlineSection } from './OutlineSection';
import { OutlineEmptyState } from './OutlineEmptyState';
import {
  useOutlineStore,
  selectSections,
  selectParseError,
  selectHasContent,
} from '@renderer/stores/outline-store';
import {
  useUILayoutStore,
  selectOutlineVisible,
  selectPreviewVisible,
} from '@renderer/stores/ui-layout-store';
import type { OutlineItem, OutlineSectionId } from '@shared/types/outline';
import {
  AUTO_HIDE_THRESHOLD_WITH_PREVIEW,
  AUTO_HIDE_THRESHOLD_NO_PREVIEW,
} from '@shared/types/outline';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default panel width in pixels */
const DEFAULT_PANEL_WIDTH = 250;

/** Minimum panel width in pixels */
const MIN_PANEL_WIDTH = 150;

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for OutlinePanel component.
 */
export interface OutlinePanelProps {
  /** Callback when panel close button is clicked */
  readonly onClose?: () => void;

  /** Callback when an item is clicked for navigation */
  readonly onNavigate?: (item: OutlineItem) => void;

  /** Optional CSS class name */
  readonly className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Document outline panel with sections for headings, components, and frontmatter.
 *
 * @param props - Component props
 * @returns JSX element
 */
function OutlinePanelComponent(props: OutlinePanelProps): React.JSX.Element | null {
  const { onClose, onNavigate, className } = props;

  // Store state
  const isVisible = useUILayoutStore(selectOutlineVisible);
  const previewVisible = useUILayoutStore(selectPreviewVisible);
  const sections = useOutlineStore(selectSections);
  const parseError = useOutlineStore(selectParseError);
  const hasContent = useOutlineStore(selectHasContent);

  // Store actions
  const toggleSectionCollapse = useOutlineStore((state) => state.toggleSectionCollapse);
  const toggleItemCollapse = useOutlineStore((state) => state.toggleItemCollapse);
  const setOutlineVisible = useUILayoutStore((state) => state.setOutlineVisible);

  // Track if panel was auto-hidden (vs manually closed) for auto-restore
  const wasAutoHiddenRef = useRef(false);
  // Track if user manually set visibility (to respect their preference)
  const userSetVisibleRef = useRef(false);

  // Auto-hide logic based on window width
  useEffect(() => {
    const checkAutoHide = (): void => {
      const threshold = previewVisible
        ? AUTO_HIDE_THRESHOLD_WITH_PREVIEW
        : AUTO_HIDE_THRESHOLD_NO_PREVIEW;
      const windowWidth = window.innerWidth;

      if (windowWidth < threshold) {
        // Window too narrow - auto-hide if visible
        if (isVisible && !wasAutoHiddenRef.current) {
          wasAutoHiddenRef.current = true;
          userSetVisibleRef.current = false;
          setOutlineVisible(false);
        }
      } else {
        // Window wide enough - auto-restore if was auto-hidden
        if (!isVisible && wasAutoHiddenRef.current && !userSetVisibleRef.current) {
          wasAutoHiddenRef.current = false;
          setOutlineVisible(true);
        }
      }
    };

    // Check on mount
    checkAutoHide();

    // Listen to window resize
    window.addEventListener('resize', checkAutoHide);
    return () => {
      window.removeEventListener('resize', checkAutoHide);
    };
  }, [previewVisible, isVisible, setOutlineVisible]);

  // Handle close button click - marks as user action to prevent auto-restore
  const handleClose = useCallback(() => {
    userSetVisibleRef.current = true;
    wasAutoHiddenRef.current = false;
    setOutlineVisible(false);
    onClose?.();
  }, [setOutlineVisible, onClose]);

  // Handle section collapse toggle
  const handleToggleSectionCollapse = useCallback(
    (sectionId: OutlineSectionId) => {
      toggleSectionCollapse(sectionId);
    },
    [toggleSectionCollapse]
  );

  // Handle item click - navigate to position
  const handleItemClick = useCallback(
    (item: OutlineItem) => {
      onNavigate?.(item);
    },
    [onNavigate]
  );

  // Handle item collapse toggle
  const handleItemToggleCollapse = useCallback(
    (itemId: string) => {
      toggleItemCollapse(itemId);
    },
    [toggleItemCollapse]
  );

  // Ref for the content container to find focusable items
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape closes the panel
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      // Arrow key navigation within the tree
      const container = contentRef.current;
      if (!container) return;

      // Get all focusable tree items
      const focusableItems = container.querySelectorAll<HTMLElement>('[role="treeitem"]');
      if (focusableItems.length === 0) return;

      const currentFocus = document.activeElement as HTMLElement;
      const currentIndex = Array.from(focusableItems).indexOf(currentFocus);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
          focusableItems[nextIndex]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
          focusableItems[prevIndex]?.focus();
          break;
        }
        case 'ArrowRight': {
          // Expand collapsed item or move to first child
          if (currentFocus.getAttribute('aria-expanded') === 'false') {
            e.preventDefault();
            currentFocus.click(); // Toggle expand
          }
          break;
        }
        case 'ArrowLeft': {
          // Collapse expanded item or move to parent
          if (currentFocus.getAttribute('aria-expanded') === 'true') {
            e.preventDefault();
            currentFocus.click(); // Toggle collapse
          }
          break;
        }
        case 'Home': {
          e.preventDefault();
          focusableItems[0]?.focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          focusableItems[focusableItems.length - 1]?.focus();
          break;
        }
      }
    },
    [handleClose]
  );

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <aside
      role="complementary"
      aria-label="Document outline"
      className={`flex flex-col border-r border-border bg-background h-full ${className ?? ''}`}
      style={{ width: DEFAULT_PANEL_WIDTH, minWidth: MIN_PANEL_WIDTH }}
      onKeyDown={handleKeyDown}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Outline</h2>

          {/* Warning indicator for parse errors */}
          {parseError && (
            <span title="Outline may be outdated due to parse error">
              <AlertTriangle
                className="h-4 w-4 text-yellow-500"
                aria-label="Warning: Outline may be outdated"
              />
            </span>
          )}
        </div>

        {/* Close button */}
        <button
          type="button"
          className="p-1 hover:bg-muted rounded-sm transition-colors"
          onClick={handleClose}
          aria-label="Close outline panel"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Panel content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-2">
        {hasContent ? (
          sections.map((section) => (
            <OutlineSection
              key={section.id}
              section={section}
              onToggleCollapse={handleToggleSectionCollapse}
              onItemClick={handleItemClick}
              onItemToggleCollapse={handleItemToggleCollapse}
            />
          ))
        ) : (
          <OutlineEmptyState />
        )}
      </div>
    </aside>
  );
}

/**
 * Memoized OutlinePanel component.
 */
export const OutlinePanel = memo(OutlinePanelComponent);
OutlinePanel.displayName = 'OutlinePanel';

export default OutlinePanel;
