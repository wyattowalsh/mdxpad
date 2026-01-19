/**
 * TemplatePreview Component
 *
 * Displays a live preview of template MDX content in the template browser.
 * Shows the raw template content with variables like `{{title}}` visible
 * (not substituted yet), allowing users to see the template structure.
 *
 * Reuses the preview infrastructure from Spec 003 for MDX rendering.
 *
 * @module renderer/components/template-browser/TemplatePreview
 */

import { memo, useMemo } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { PreviewPane } from '../preview/PreviewPane';
import type { Template } from '@shared/contracts/template-schemas';
import { cn } from '@shared/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the TemplatePreview component.
 */
export interface TemplatePreviewProps {
  /** Template to preview, or null if no selection */
  readonly template: Template | null;

  /** Whether the template is currently loading */
  readonly isLoading?: boolean;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Empty state component shown when no template is selected.
 */
const EmptyState = memo(function EmptyState(): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full text-center p-8"
      role="status"
      aria-label="No template selected"
    >
      <FileText
        className="h-12 w-12 text-muted-foreground/50 mb-4"
        aria-hidden="true"
      />
      <h3 className="text-lg font-medium text-foreground mb-2">
        Select a template to preview
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Choose a template from the list to see a live preview of its content.
      </p>
    </div>
  );
});

/**
 * Loading state component shown while template is loading.
 */
const LoadingState = memo(function LoadingState(): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full"
      role="status"
      aria-label="Loading template"
    >
      <Loader2
        className="h-8 w-8 text-primary animate-spin mb-4"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">Loading template...</p>
    </div>
  );
});

/**
 * Template header showing name and description.
 */
interface TemplateHeaderProps {
  readonly name: string;
  readonly description: string;
}

const TemplateHeader = memo(function TemplateHeader({
  name,
  description,
}: TemplateHeaderProps): React.JSX.Element {
  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-muted/30">
      <h2 className="text-base font-semibold text-foreground line-clamp-1">
        {name}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
        {description}
      </p>
    </div>
  );
});

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Template preview component for the template browser.
 *
 * Features:
 * - Live MDX preview of template content using Spec 003 infrastructure
 * - Shows template variables (e.g., `{{title}}`) as-is without substitution
 * - Header displays template name and description
 * - Loading indicator while template is being fetched
 * - Empty state messaging when no template is selected
 * - Full height layout with scrollable content area
 * - Clean, minimal design using Tailwind CSS
 *
 * @param props - Component props
 * @returns JSX element
 *
 * @example
 * ```tsx
 * <TemplatePreview
 *   template={selectedTemplate}
 *   isLoading={isLoadingTemplate}
 * />
 * ```
 */
function TemplatePreviewComponent({
  template,
  isLoading = false,
}: TemplatePreviewProps): React.JSX.Element {
  // Memoize the content to prevent unnecessary re-renders
  // The raw content with {{variables}} is displayed as-is
  const previewContent = useMemo(() => {
    if (!template) {
      return '';
    }
    return template.content;
  }, [template]);

  // Handle loading state
  if (isLoading) {
    return (
      <div
        className="flex flex-col h-full bg-background"
        data-testid="template-preview"
      >
        <LoadingState />
      </div>
    );
  }

  // Handle empty state (no template selected)
  if (!template) {
    return (
      <div
        className="flex flex-col h-full bg-background"
        data-testid="template-preview"
      >
        <EmptyState />
      </div>
    );
  }

  // Render template preview with header
  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background',
        'border-l border-border'
      )}
      data-testid="template-preview"
      data-template-id={template.id}
    >
      {/* Template header with name and description */}
      <TemplateHeader name={template.name} description={template.description} />

      {/* Scrollable preview content area */}
      <div className="flex-1 overflow-auto min-h-0">
        <PreviewPane
          source={previewContent}
          className="h-full"
        />
      </div>
    </div>
  );
}

/**
 * Memoized TemplatePreview component for performance optimization.
 */
export const TemplatePreview = memo(TemplatePreviewComponent);
TemplatePreview.displayName = 'TemplatePreview';

export default TemplatePreview;
