/**
 * Distraction-Free Mode Extension for CodeMirror
 *
 * Provides utilities for hiding UI chrome and toggling
 * fullscreen to create a minimal writing environment.
 *
 * @module renderer/lib/editor/extensions/distraction-free
 */

import { type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// =============================================================================
// Types
// =============================================================================

/**
 * Distraction-free mode state.
 */
export interface DistractionFreeState {
  /** Whether distraction-free mode is currently active */
  isActive: boolean;
  /** Toggle distraction-free mode on/off */
  toggle: () => void;
}

// =============================================================================
// Constants
// =============================================================================

/** CSS class applied to the editor in distraction-free mode */
const DF_CLASS = 'cm-distraction-free';

/** CSS class for the body element when in distraction-free mode */
const DF_BODY_CLASS = 'distraction-free-active';

// =============================================================================
// Theme
// =============================================================================

const distractionFreeTheme = EditorView.baseTheme({
  [`&.${DF_CLASS}`]: {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '9999',
    backgroundColor: 'var(--cm-df-bg, #ffffff)',
  },
  [`&.${DF_CLASS} .cm-scroller`]: {
    maxWidth: '72ch',
    margin: '0 auto',
    padding: '2rem 1rem',
  },
  [`&dark.${DF_CLASS}`]: {
    backgroundColor: 'var(--cm-df-bg, #1e1e1e)',
  },
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Distraction-free mode extension.
 *
 * Provides styling for a fullscreen, centered writing area.
 * Use `createDistractionFreeState` for toggle logic.
 *
 * @returns CodeMirror Extension
 */
export function distractionFreeExtension(): Extension {
  return [distractionFreeTheme];
}

// =============================================================================
// State Factory
// =============================================================================

/**
 * Creates a distraction-free mode state manager.
 *
 * Manages toggling the distraction-free CSS classes on the editor
 * and document body. Use alongside `distractionFreeExtension()`.
 *
 * @returns State object with `isActive` and `toggle()` method
 *
 * @example
 * ```typescript
 * const dfState = createDistractionFreeState();
 *
 * button.addEventListener('click', () => {
 *   dfState.toggle();
 * });
 * ```
 */
export function createDistractionFreeState(): DistractionFreeState {
  let active = false;

  return {
    get isActive(): boolean {
      return active;
    },

    toggle(): void {
      active = !active;

      if (active) {
        document.body.classList.add(DF_BODY_CLASS);
      } else {
        document.body.classList.remove(DF_BODY_CLASS);
      }
    },
  };
}
