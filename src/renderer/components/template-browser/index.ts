/**
 * Template Browser Components
 *
 * Components for browsing, selecting, and managing templates.
 *
 * @module renderer/components/template-browser
 */

export { TemplateBrowser } from './TemplateBrowser';
export type { TemplateBrowserProps } from './TemplateBrowser';

export { TemplateCard } from './TemplateCard';
export type { TemplateCardProps } from './TemplateCard';

export { TemplateFilters } from './TemplateFilters';
export type { TemplateFiltersProps } from './TemplateFilters';

export {
  LoadingState,
  EmptyState,
  NoResultsState,
  ErrorState,
  PreviewPlaceholder,
  TemplatePreviewPanel,
} from './TemplateBrowserStates';

export { VariableDialog } from './VariableDialog';
export type { VariableDialogProps } from './VariableDialog';

export { SaveTemplateDialog } from './SaveTemplateDialog';
export type { SaveTemplateDialogProps, SaveTemplateFormData } from './SaveTemplateDialog';

export { EditTemplateDialog } from './EditTemplateDialog';
export type { EditTemplateDialogProps, EditTemplateFormData } from './EditTemplateDialog';

export { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
export type { ConfirmDeleteDialogProps } from './ConfirmDeleteDialog';
