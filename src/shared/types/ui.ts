/**
 * UI type definitions.
 * Defines types for layout, theming, and UI state.
 */

/** Application layout state */
export interface LayoutState {
  readonly sidebarVisible: boolean;
  readonly sidebarWidth: number;
  readonly previewVisible: boolean;
  readonly previewWidth: number;
}

/** Theme variants */
export type Theme = 'light' | 'dark' | 'system';

/** Theme configuration */
export interface ThemeConfig {
  readonly theme: Theme;
  readonly resolvedTheme: 'light' | 'dark'; // After resolving 'system'
}

/** Panel resize constraints */
export interface PanelConstraints {
  readonly minSize: number;
  readonly maxSize: number;
  readonly defaultSize: number;
}
