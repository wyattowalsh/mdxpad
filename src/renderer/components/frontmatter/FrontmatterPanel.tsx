/**
 * FrontmatterPanel Component
 *
 * Collapsible sidebar panel for frontmatter editing.
 * Contains mode toggle, form editor, and panel controls.
 * Displays warning banners for unsupported YAML features and
 * error banners for malformed delimiters with auto-fix options.
 *
 * @module renderer/components/frontmatter/FrontmatterPanel
 */

import { memo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Code,
  AlertTriangle,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@renderer/components/ui/tabs';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Textarea } from '@renderer/components/ui/textarea';
import {
  useFrontmatterStore,
  selectMode,
  selectIsPanelOpen,
  selectExists,
  selectRawYamlDraft,
  selectParseError,
  selectHasValidationErrors,
  selectValidationErrorCount,
  selectData,
} from '@renderer/stores/frontmatter-store';
import { FrontmatterForm } from './FrontmatterForm';
import { ValidationBadge } from './ValidationIndicator';
import type { FrontmatterMode } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for FrontmatterPanel component.
 */
export interface FrontmatterPanelProps {
  /** Optional className for container styling */
  readonly className?: string;

  /** Callback to apply auto-fix (provided by parent who has document access) */
  readonly onApplyAutoFix?: (fixedContent: string) => void;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Warning banner for unsupported YAML features.
 */
interface UnsupportedFeaturesBannerProps {
  readonly reasons: readonly string[];
  readonly fieldNames: readonly string[];
  readonly onSwitchToRaw: () => void;
}

const UnsupportedFeaturesBanner = memo(function UnsupportedFeaturesBanner(
  props: UnsupportedFeaturesBannerProps
): React.JSX.Element {
  const { reasons, fieldNames, onSwitchToRaw } = props;

  const reasonsText = reasons.length > 0 ? reasons.join(', ') : 'advanced features';
  const fieldsText =
    fieldNames.length > 0
      ? ` (${fieldNames.slice(0, 3).join(', ')}${fieldNames.length > 3 ? '...' : ''})`
      : '';

  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-2 text-xs">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-600" />
      <div className="flex-1">
        <p className="text-yellow-800 dark:text-yellow-200">
          Some fields use {reasonsText} and can only be edited in raw mode{fieldsText}.
        </p>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-yellow-700 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100"
          onClick={onSwitchToRaw}
        >
          Switch to raw mode
        </Button>
      </div>
    </div>
  );
});

/**
 * Error banner for malformed frontmatter delimiters.
 */
interface DelimiterErrorBannerProps {
  readonly message: string;
  readonly hasSuggestedFix: boolean;
  readonly onAutoFix: () => void;
  readonly onSwitchToRaw: () => void;
}

const DelimiterErrorBanner = memo(function DelimiterErrorBanner(
  props: DelimiterErrorBannerProps
): React.JSX.Element {
  const { message, hasSuggestedFix, onAutoFix, onSwitchToRaw } = props;

  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="mb-1.5 text-destructive">{message}</p>
        <div className="flex gap-2">
          {hasSuggestedFix && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={onAutoFix}
            >
              <Wrench className="h-3 w-3" />
              Auto-fix
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={onSwitchToRaw}
          >
            <Code className="h-3 w-3" />
            View raw
          </Button>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Collapsible sidebar panel for frontmatter editing.
 *
 * @param props - Component props
 * @returns JSX element
 */
function FrontmatterPanelComponent(props: FrontmatterPanelProps): React.JSX.Element {
  const { className, onApplyAutoFix } = props;

  const mode = useFrontmatterStore(selectMode);
  const isPanelOpen = useFrontmatterStore(selectIsPanelOpen);
  const exists = useFrontmatterStore(selectExists);
  const rawYamlDraft = useFrontmatterStore(selectRawYamlDraft);
  const parseError = useFrontmatterStore(selectParseError);
  const hasValidationErrors = useFrontmatterStore(selectHasValidationErrors);
  const validationErrorCount = useFrontmatterStore(selectValidationErrorCount);
  const data = useFrontmatterStore(selectData);

  const togglePanel = useFrontmatterStore((s) => s.togglePanel);
  const setMode = useFrontmatterStore((s) => s.setMode);
  const setRawYaml = useFrontmatterStore((s) => s.setRawYaml);

  // Derived state for unsupported features and delimiter errors
  const hasUnsupportedFeatures = data?.hasUnsupportedFeatures ?? false;
  const unsupportedReasons = data?.unsupportedReasons ?? [];
  const unsupportedFieldNames = data?.unsupportedFieldNames ?? [];
  const delimiterError = data?.delimiterError ?? null;

  const handleToggle = useCallback(() => {
    togglePanel();
  }, [togglePanel]);

  const handleModeChange = useCallback(
    (value: string) => {
      const result = setMode(value as FrontmatterMode);
      if (!result.valid) {
        // Show error (validation errors are handled in UI)
        console.warn('Mode switch failed:', result.errors);
      }
    },
    [setMode]
  );

  const handleRawYamlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRawYaml(e.target.value);
    },
    [setRawYaml]
  );

  const handleSwitchToRaw = useCallback(() => {
    setMode('raw');
  }, [setMode]);

  const handleAutoFix = useCallback(() => {
    if (delimiterError?.suggestedFix && onApplyAutoFix) {
      onApplyAutoFix(delimiterError.suggestedFix);
    }
  }, [delimiterError?.suggestedFix, onApplyAutoFix]);

  // Determine if we should show banners
  const showDelimiterError = delimiterError !== null;
  const showUnsupportedWarning =
    hasUnsupportedFeatures && mode === 'visual' && !showDelimiterError;

  return (
    <div className={className}>
      {/* Panel Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 border-b px-3 py-2 text-sm font-medium hover:bg-muted/50"
        aria-expanded={isPanelOpen}
        aria-controls="frontmatter-content"
      >
        {isPanelOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <FileText className="h-4 w-4" />
        <span>Frontmatter</span>
        {(hasValidationErrors || showDelimiterError) && (
          <span
            className="ml-auto h-2 w-2 rounded-full bg-destructive"
            aria-label="Has validation errors"
          />
        )}
        {hasUnsupportedFeatures && !hasValidationErrors && !showDelimiterError && (
          <span
            className="ml-auto h-2 w-2 rounded-full bg-yellow-500"
            aria-label="Has unsupported features"
          />
        )}
      </button>

      {/* Panel Content */}
      {isPanelOpen && (
        <div id="frontmatter-content" className="border-b">
          {/* Delimiter Error Banner (always shown first) */}
          {showDelimiterError && (
            <div className="p-2">
              <DelimiterErrorBanner
                message={delimiterError.message}
                hasSuggestedFix={!!delimiterError.suggestedFix}
                onAutoFix={handleAutoFix}
                onSwitchToRaw={handleSwitchToRaw}
              />
            </div>
          )}

          {exists && !showDelimiterError ? (
            <Tabs value={mode} onValueChange={handleModeChange}>
              <div className="flex items-center justify-between border-b px-3 py-1.5">
                <TabsList className="h-7">
                  <TabsTrigger value="visual" className="h-6 gap-1 px-2 text-xs">
                    <FileText className="h-3 w-3" />
                    Visual
                    {hasValidationErrors && (
                      <ValidationBadge
                        errorCount={validationErrorCount}
                        className="ml-1"
                      />
                    )}
                    {hasUnsupportedFeatures && !hasValidationErrors && (
                      <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="raw" className="h-6 gap-1 px-2 text-xs">
                    <Code className="h-3 w-3" />
                    Raw
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="visual" className="mt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-3 p-3">
                    {/* Unsupported Features Warning */}
                    {showUnsupportedWarning && (
                      <UnsupportedFeaturesBanner
                        reasons={unsupportedReasons}
                        fieldNames={unsupportedFieldNames}
                        onSwitchToRaw={handleSwitchToRaw}
                      />
                    )}
                    <FrontmatterForm
                      onSwitchToRawMode={handleSwitchToRaw}
                      unsupportedFieldNames={unsupportedFieldNames}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="raw" className="mt-0">
                <div className="p-3">
                  <Textarea
                    value={rawYamlDraft}
                    onChange={handleRawYamlChange}
                    placeholder="Enter YAML frontmatter..."
                    className="min-h-[200px] font-mono text-sm"
                    aria-label="Raw YAML editor"
                    aria-invalid={!!parseError}
                  />
                  {parseError && (
                    <p className="mt-2 text-xs text-destructive">
                      Line {parseError.line}: {parseError.message}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : !showDelimiterError ? (
            <div className="p-3">
              <p className="mb-3 text-sm text-muted-foreground">
                No frontmatter in this document.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Will be handled by addField in Phase 5
                }}
              >
                Add Frontmatter
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export const FrontmatterPanel = memo(FrontmatterPanelComponent);
FrontmatterPanel.displayName = 'FrontmatterPanel';
