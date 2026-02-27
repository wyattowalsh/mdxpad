/**
 * Font Settings Extension for CodeMirror
 *
 * Provides compartment-based font configuration for dynamically
 * updating font family, size, and line height.
 *
 * @module renderer/lib/editor/extensions/font-settings
 */

import { Compartment, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

// =============================================================================
// Types
// =============================================================================

/**
 * Font configuration options.
 */
export interface FontSettings {
  /** Font family CSS value (default: 'monospace') */
  readonly fontFamily?: string;
  /** Font size in pixels (default: 14) */
  readonly fontSize?: number;
  /** Line height multiplier (default: 1.6) */
  readonly lineHeight?: number;
}

/**
 * Result of creating a font settings extension.
 */
export interface FontSettingsExtensionResult {
  /** The extension to add to the editor */
  readonly extension: Extension;
  /** Update font settings dynamically */
  readonly update: (view: EditorView, settings: FontSettings) => void;
  /** The compartment for external reconfiguration */
  readonly compartment: Compartment;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_FONT_FAMILY = 'monospace';
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_HEIGHT = 1.6;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Clamp a font size to valid bounds.
 */
function clampFontSize(size: number): number {
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
}

/**
 * Build a theme extension from font settings.
 */
function buildFontTheme(settings: FontSettings): Extension {
  const fontFamily = settings.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontSize = clampFontSize(settings.fontSize ?? DEFAULT_FONT_SIZE);
  const lineHeight = settings.lineHeight ?? DEFAULT_LINE_HEIGHT;

  return EditorView.theme({
    '&': {
      fontSize: `${fontSize}px`,
      fontFamily,
    },
    '.cm-content': {
      fontFamily,
      fontSize: `${fontSize}px`,
      lineHeight: String(lineHeight),
    },
    '.cm-gutters': {
      fontSize: `${fontSize}px`,
      fontFamily,
    },
  });
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Creates a font settings extension with dynamic update support.
 *
 * Uses a CodeMirror Compartment to allow runtime font changes without
 * recreating the editor.
 *
 * @param initialSettings - Initial font configuration
 * @returns Object with the extension, update function, and compartment
 *
 * @example
 * ```typescript
 * const { extension, update } = createFontSettingsExtension({
 *   fontFamily: '"JetBrains Mono", monospace',
 *   fontSize: 16,
 *   lineHeight: 1.8,
 * });
 *
 * // Later, update font size
 * update(view, { fontSize: 18 });
 * ```
 */
export function createFontSettingsExtension(
  initialSettings: FontSettings = {}
): FontSettingsExtensionResult {
  const compartment = new Compartment();

  const extension = compartment.of(buildFontTheme(initialSettings));

  const update = (view: EditorView, settings: FontSettings): void => {
    view.dispatch({
      effects: compartment.reconfigure(buildFontTheme(settings)),
    });
  };

  return { extension, update, compartment };
}
