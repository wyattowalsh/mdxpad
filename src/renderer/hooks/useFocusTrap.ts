/**
 * Focus trap hook for modal dialogs.
 * Traps focus within a container when active.
 *
 * @module renderer/hooks/useFocusTrap
 */

import { useEffect, type RefObject } from 'react';

/** Selector for focusable elements */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within a container element.
 * When active, Tab and Shift+Tab cycle through focusable elements
 * within the container, never escaping to elements outside.
 *
 * @param containerRef - Ref to the container element
 * @param isActive - Whether the focus trap is currently active
 * @param options - Optional configuration
 * @param options.autoFocus - Automatically focus first element when activated (default: true)
 * @param options.restoreFocus - Restore focus to previously focused element on deactivate (default: true)
 *
 * @example
 * ```tsx
 * const dialogRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(dialogRef, isOpen);
 *
 * return isOpen ? (
 *   <div ref={dialogRef} role="dialog">
 *     <input type="text" />
 *     <button>OK</button>
 *   </div>
 * ) : null;
 * ```
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  options: {
    autoFocus?: boolean;
    restoreFocus?: boolean;
  } = {}
): void {
  const { autoFocus = true, restoreFocus = true } = options;

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    /**
     * Get all focusable elements within the container.
     */
    const getFocusables = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
      );
    };

    /**
     * Handle keydown to trap Tab navigation.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Tab') return;

      const focusables = getFocusables();
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (!first || !last) return;

      if (event.shiftKey) {
        // Shift+Tab: if on first element, wrap to last
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, wrap to first
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    // Auto-focus first element
    if (autoFocus) {
      const focusables = getFocusables();
      focusables[0]?.focus();
    }

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previously focused element
      if (restoreFocus && previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [containerRef, isActive, autoFocus, restoreFocus]);
}
