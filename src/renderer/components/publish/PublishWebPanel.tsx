/**
 * Publish Web Panel Component
 *
 * Panel for publishing MDX files as a static website.
 * Select files, choose output directory, view progress, and preview results.
 *
 * @module renderer/components/publish/PublishWebPanel
 */

import { memo, useState } from 'react';
import { cn } from '@shared/lib/utils';
import type { PublishProgress } from '@shared/contracts/share-schemas';

// ============================================================================
// Types
// ============================================================================

/** A file entry for publishing */
export interface PublishFileItem {
  readonly path: string;
  readonly name: string;
  readonly selected: boolean;
}

export interface PublishWebPanelProps {
  readonly files: readonly PublishFileItem[];
  readonly outputDir: string;
  readonly progress: PublishProgress | null;
  readonly isPublishing: boolean;
  readonly lastResult: {
    readonly success: boolean;
    readonly filesGenerated: number;
    readonly errors: readonly string[];
  } | null;
  readonly onToggleFile: (path: string) => void;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly onChooseOutputDir: () => void;
  readonly onPublish: () => void;
  readonly onOpenOutput: () => void;
}

// ============================================================================
// Progress Bar
// ============================================================================

interface ProgressBarProps {
  readonly progress: PublishProgress;
}

function ProgressBarComponent({ progress }: ProgressBarProps) {
  const percentage =
    progress.totalFiles > 0 ? Math.round((progress.processedFiles / progress.totalFiles) * 100) : 0;

  return (
    <div className="space-y-1" data-testid="publish-progress">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {progress.status === 'processing'
            ? `Processing: ${progress.currentFile ?? '...'}`
            : progress.status === 'complete'
              ? 'Complete!'
              : progress.status === 'error'
                ? 'Error'
                : 'Pending'}
        </span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            progress.status === 'error' ? 'bg-destructive' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {progress.error && <p className="text-[10px] text-destructive mt-1">{progress.error}</p>}
    </div>
  );
}

const ProgressBar = memo(ProgressBarComponent);
ProgressBar.displayName = 'ProgressBar';

// ============================================================================
// File List Item
// ============================================================================

interface FileListItemProps {
  readonly file: PublishFileItem;
  readonly onToggle: () => void;
  readonly disabled: boolean;
}

function FileListItemComponent({ file, onToggle, disabled }: FileListItemProps) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 py-1 px-1.5 rounded',
        'hover:bg-muted/60 transition-colors cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input
        type="checkbox"
        checked={file.selected}
        onChange={onToggle}
        disabled={disabled}
        className="rounded border-border"
        aria-label={`Include ${file.name}`}
      />
      <span className="text-xs truncate">{file.name}</span>
    </label>
  );
}

const FileListItem = memo(FileListItemComponent);
FileListItem.displayName = 'FileListItem';

// ============================================================================
// File Selection
// ============================================================================

interface FileSelectionProps {
  readonly files: readonly PublishFileItem[];
  readonly selectedCount: number;
  readonly isPublishing: boolean;
  readonly onToggleFile: (path: string) => void;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
}

function FileSelectionComponent({
  files,
  selectedCount,
  isPublishing,
  onToggleFile,
  onSelectAll,
  onDeselectAll,
}: FileSelectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">
          Files ({selectedCount}/{files.length})
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={onSelectAll}
            disabled={isPublishing}
          >
            All
          </button>
          <button
            type="button"
            className="text-[10px] text-primary hover:underline"
            onClick={onDeselectAll}
            disabled={isPublishing}
          >
            None
          </button>
        </div>
      </div>
      <div className="max-h-32 overflow-y-auto border border-border rounded p-1">
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No files available</p>
        ) : (
          files.map((file) => (
            <FileListItem
              key={file.path}
              file={file}
              onToggle={() => onToggleFile(file.path)}
              disabled={isPublishing}
            />
          ))
        )}
      </div>
    </div>
  );
}

const FileSelection = memo(FileSelectionComponent);
FileSelection.displayName = 'FileSelection';

// ============================================================================
// Output Directory
// ============================================================================

interface OutputDirProps {
  readonly outputDir: string;
  readonly isPublishing: boolean;
  readonly onChooseOutputDir: () => void;
}

function OutputDirComponent({ outputDir, isPublishing, onChooseOutputDir }: OutputDirProps) {
  return (
    <div>
      <span className="text-xs font-medium block mb-1">Output Directory</span>
      <div className="flex items-center gap-1">
        <div
          className={cn(
            'flex-1 text-xs p-1.5 rounded border border-border',
            'bg-muted/50 truncate'
          )}
        >
          {outputDir || 'Not selected'}
        </div>
        <button
          type="button"
          className={cn(
            'text-xs px-2 py-1.5 rounded border border-border',
            'hover:bg-muted transition-colors'
          )}
          onClick={onChooseOutputDir}
          disabled={isPublishing}
        >
          Browse
        </button>
      </div>
    </div>
  );
}

const OutputDir = memo(OutputDirComponent);
OutputDir.displayName = 'OutputDir';

// ============================================================================
// Publish Options
// ============================================================================

interface PublishOptionsProps {
  readonly includeStyles: boolean;
  readonly generateIndex: boolean;
  readonly isPublishing: boolean;
  readonly onIncludeStylesChange: (checked: boolean) => void;
  readonly onGenerateIndexChange: (checked: boolean) => void;
}

function PublishOptionsComponent({
  includeStyles,
  generateIndex,
  isPublishing,
  onIncludeStylesChange,
  onGenerateIndexChange,
}: PublishOptionsProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium block">Options</span>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={includeStyles}
          onChange={(e) => onIncludeStylesChange(e.target.checked)}
          disabled={isPublishing}
          className="rounded border-border"
        />
        Include styles
      </label>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={generateIndex}
          onChange={(e) => onGenerateIndexChange(e.target.checked)}
          disabled={isPublishing}
          className="rounded border-border"
        />
        Generate index page
      </label>
    </div>
  );
}

const PublishOptions = memo(PublishOptionsComponent);
PublishOptions.displayName = 'PublishOptions';

// ============================================================================
// Publish Result
// ============================================================================

interface PublishResultDisplayProps {
  readonly lastResult: {
    readonly success: boolean;
    readonly filesGenerated: number;
    readonly errors: readonly string[];
  };
  readonly onOpenOutput: () => void;
}

function PublishResultDisplayComponent({ lastResult, onOpenOutput }: PublishResultDisplayProps) {
  return (
    <div
      className={cn(
        'p-2 rounded border text-xs',
        lastResult.success
          ? 'border-green-500/30 bg-green-500/5 text-green-700'
          : 'border-destructive/30 bg-destructive/5 text-destructive'
      )}
      data-testid="publish-result"
    >
      {lastResult.success ? (
        <div>
          <p>Generated {lastResult.filesGenerated} file(s)</p>
          <button
            type="button"
            className="text-primary hover:underline mt-1"
            onClick={onOpenOutput}
          >
            Open output folder
          </button>
        </div>
      ) : (
        <div>
          <p>Publishing failed</p>
          {lastResult.errors.map((err, i) => (
            <p key={i} className="mt-0.5 text-[10px]">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const PublishResultDisplay = memo(PublishResultDisplayComponent);
PublishResultDisplay.displayName = 'PublishResultDisplay';

// ============================================================================
// Panel Header
// ============================================================================

function PanelHeaderComponent() {
  return (
    <div className="px-3 py-2 border-b border-border">
      <h3 className="text-sm font-medium text-foreground">Publish to Web</h3>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        Generate a static HTML site from your MDX files
      </p>
    </div>
  );
}

const PanelHeader = memo(PanelHeaderComponent);
PanelHeader.displayName = 'PanelHeader';

// ============================================================================
// Publish Button
// ============================================================================

interface PublishButtonProps {
  readonly selectedCount: number;
  readonly canPublish: boolean;
  readonly isPublishing: boolean;
  readonly onPublish: () => void;
}

function PublishButtonComponent({
  selectedCount,
  canPublish,
  isPublishing,
  onPublish,
}: PublishButtonProps) {
  return (
    <div className="px-3 py-2 border-t border-border">
      <button
        type="button"
        className={cn(
          'w-full text-xs py-1.5 rounded',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
        onClick={onPublish}
        disabled={!canPublish}
      >
        {isPublishing
          ? 'Publishing...'
          : `Publish ${selectedCount} file${selectedCount !== 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

const PublishButton = memo(PublishButtonComponent);
PublishButton.displayName = 'PublishButton';

// ============================================================================
// Panel Content
// ============================================================================

interface PanelContentProps {
  readonly files: readonly PublishFileItem[];
  readonly selectedCount: number;
  readonly outputDir: string;
  readonly progress: PublishProgress | null;
  readonly isPublishing: boolean;
  readonly lastResult: PublishWebPanelProps['lastResult'];
  readonly includeStyles: boolean;
  readonly generateIndex: boolean;
  readonly onToggleFile: (path: string) => void;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly onChooseOutputDir: () => void;
  readonly onOpenOutput: () => void;
  readonly onIncludeStylesChange: (checked: boolean) => void;
  readonly onGenerateIndexChange: (checked: boolean) => void;
}

function PanelContentComponent({
  files,
  selectedCount,
  outputDir,
  progress,
  isPublishing,
  lastResult,
  includeStyles,
  generateIndex,
  onToggleFile,
  onSelectAll,
  onDeselectAll,
  onChooseOutputDir,
  onOpenOutput,
  onIncludeStylesChange,
  onGenerateIndexChange,
}: PanelContentProps) {
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
      <FileSelection
        files={files}
        selectedCount={selectedCount}
        isPublishing={isPublishing}
        onToggleFile={onToggleFile}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
      />
      <OutputDir outputDir={outputDir} isPublishing={isPublishing} onChooseOutputDir={onChooseOutputDir} />
      <PublishOptions
        includeStyles={includeStyles}
        generateIndex={generateIndex}
        isPublishing={isPublishing}
        onIncludeStylesChange={onIncludeStylesChange}
        onGenerateIndexChange={onGenerateIndexChange}
      />
      {progress && <ProgressBar progress={progress} />}
      {lastResult && !isPublishing && (
        <PublishResultDisplay lastResult={lastResult} onOpenOutput={onOpenOutput} />
      )}
    </div>
  );
}

const PanelContent = memo(PanelContentComponent);
PanelContent.displayName = 'PanelContent';

// ============================================================================
// Panel Component
// ============================================================================

function PublishWebPanelComponent({
  files,
  outputDir,
  progress,
  isPublishing,
  lastResult,
  onToggleFile,
  onSelectAll,
  onDeselectAll,
  onChooseOutputDir,
  onPublish,
  onOpenOutput,
}: PublishWebPanelProps) {
  const [includeStyles, setIncludeStyles] = useState(true);
  const [generateIndex, setGenerateIndex] = useState(true);
  const selectedCount = files.filter((f) => f.selected).length;
  const canPublish = selectedCount > 0 && outputDir.length > 0 && !isPublishing;

  return (
    <div className="flex flex-col h-full" data-testid="publish-web-panel" role="region" aria-label="Publish to Web">
      <PanelHeader />
      <PanelContent
        files={files}
        selectedCount={selectedCount}
        outputDir={outputDir}
        progress={progress}
        isPublishing={isPublishing}
        lastResult={lastResult}
        includeStyles={includeStyles}
        generateIndex={generateIndex}
        onToggleFile={onToggleFile}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onChooseOutputDir={onChooseOutputDir}
        onOpenOutput={onOpenOutput}
        onIncludeStylesChange={setIncludeStyles}
        onGenerateIndexChange={setGenerateIndex}
      />
      <PublishButton
        selectedCount={selectedCount}
        canPublish={canPublish}
        isPublishing={isPublishing}
        onPublish={onPublish}
      />
    </div>
  );
}

export const PublishWebPanel = memo(PublishWebPanelComponent);
PublishWebPanel.displayName = 'PublishWebPanel';
