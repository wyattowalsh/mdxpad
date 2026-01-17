/**
 * Outline Feature Contracts
 *
 * Feature: 007-mdx-content-outline
 * Re-exports all contract types for the outline feature.
 */

// Store types
export type {
  HeadingLevel,
  OutlineSectionId,
  OutlineItemType,
  OutlineItem,
  OutlineSection,
  OutlineStoreState,
  OutlineStoreActions,
  OutlineStore,
  OutlineStoreApi,
  OutlineAST,
  HeadingNode,
  ComponentNode,
  FrontmatterData,
  SourcePosition,
} from './outline-store';

export {
  selectSections,
  selectHeadingsSection,
  selectComponentsSection,
  selectFrontmatterSection,
  selectIsParsing,
  selectParseError,
  selectLastUpdated,
  selectHasContent,
  INITIAL_OUTLINE_STATE,
  BUILTIN_COMPONENTS,
  DEFAULT_FRONTMATTER_FIELDS,
  MAX_LABEL_LENGTH,
  OUTLINE_UPDATE_DEBOUNCE_MS,
} from './outline-store';

// Navigation types
export type {
  OutlineLocation,
  UseOutlineNavigationOptions,
  UseOutlineNavigationResult,
  UseOutlineNavigation,
  HighlightEffectValue,
} from './outline-navigation';

export {
  DEFAULT_HIGHLIGHT_DURATION_MS,
  HIGHLIGHT_LINE_CLASS,
  SCROLL_BEHAVIOR,
} from './outline-navigation';

// Panel types
export type {
  OutlinePanelProps,
  OutlineSectionProps,
  OutlineItemProps,
  OutlineEmptyStateProps,
  OutlineErrorStateProps,
  OutlinePanelHeaderProps,
  FrontmatterSectionProps,
  FrontmatterField,
  ComponentGroupProps,
  ComponentInstance,
} from './outline-panel';

export {
  DEFAULT_EMPTY_MESSAGE,
  ARIA_ROLES,
  NAV_KEYS,
  MIN_PANEL_WIDTH,
  DEFAULT_PANEL_WIDTH,
  INDENT_PER_LEVEL,
  AUTO_HIDE_THRESHOLD_WITH_PREVIEW,
  AUTO_HIDE_THRESHOLD_NO_PREVIEW,
} from './outline-panel';
