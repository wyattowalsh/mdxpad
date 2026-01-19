/**
 * Template Browser State Components
 *
 * Sub-components for displaying various states in the Template Browser:
 * loading, empty, error, no results, and preview states.
 *
 * Feature: 016-template-library
 *
 * @module renderer/components/template-browser/TemplateBrowserStates
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { FileText, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { Button } from '@ui/button';
import { ScrollArea } from '@ui/scroll-area';
import type { Template } from '@shared/contracts/template-schemas';

// =============================================================================
// Constants
// =============================================================================

/** Delay before showing loading spinner to prevent flicker (ms) */
const LOADING_DELAY_MS = 150;

// =============================================================================
// Loading State
// =============================================================================

/**
 * Loading state component with delayed spinner.
 */
interface LoadingStateProps {
  readonly isVisible: boolean;
}

export function LoadingState({ isVisible }: LoadingStateProps): React.JSX.Element | null {
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setShowSpinner(false);
      return;
    }

    const timer = setTimeout(() => setShowSpinner(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isVisible]);

  if (!isVisible || !showSpinner) {
    return null;
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground"
      role="status"
      aria-label="Loading templates"
    >
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      <p className="text-sm">Loading templates...</p>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

/**
 * Empty state when no templates exist at all.
 */
export function EmptyState(): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center"
      role="status"
    >
      <FolderOpen className="h-12 w-12 opacity-50" aria-hidden="true" />
      <div>
        <h3 className="text-base font-medium text-foreground mb-1">No templates available</h3>
        <p className="text-sm">
          Create a new template by saving your current document as a template, or import a template
          file (.mdxt).
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// No Results State
// =============================================================================

/**
 * No results state when filters don't match any templates.
 */
interface NoResultsStateProps {
  readonly onClearFilters: () => void;
}

export function NoResultsState({ onClearFilters }: NoResultsStateProps): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center"
      role="status"
    >
      <FileText className="h-12 w-12 opacity-50" aria-hidden="true" />
      <div>
        <h3 className="text-base font-medium text-foreground mb-1">
          No templates match your search
        </h3>
        <p className="text-sm mb-3">Try adjusting your search terms or category filter.</p>
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Error State
// =============================================================================

/**
 * Error state when template loading fails.
 */
interface ErrorStateProps {
  readonly error: string;
  readonly onRetry: () => void;
}

export function ErrorState({ error, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 text-destructive p-6 text-center"
      role="alert"
    >
      <AlertCircle className="h-12 w-12" aria-hidden="true" />
      <div>
        <h3 className="text-base font-medium mb-1">Failed to load templates</h3>
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Preview States
// =============================================================================

/**
 * Preview placeholder when no template is selected.
 */
export function PreviewPlaceholder(): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6 text-center"
      role="status"
    >
      <FileText className="h-12 w-12 opacity-50" aria-hidden="true" />
      <p className="text-sm">Select a template to preview</p>
    </div>
  );
}

/**
 * Template preview panel showing content preview.
 */
interface TemplatePreviewPanelProps {
  readonly template: Template | null;
  readonly isLoading: boolean;
}

export function TemplatePreviewPanel({
  template,
  isLoading,
}: TemplatePreviewPanelProps): React.JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading template preview</span>
      </div>
    );
  }

  if (!template) {
    return <PreviewPlaceholder />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Template header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground mb-1">{template.name}</h3>
        <p className="text-sm text-muted-foreground">{template.description}</p>
        {template.variables && template.variables.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''} to fill
            in
          </p>
        )}
      </div>

      {/* Content preview */}
      <ScrollArea className="flex-1">
        <pre className="p-4 text-sm font-mono text-muted-foreground whitespace-pre-wrap break-words">
          {template.content}
        </pre>
      </ScrollArea>
    </div>
  );
}
