/**
 * VersionTimeline Component
 *
 * Vertical timeline displaying version history entries with source icons,
 * relative timestamps, and click-to-select behavior.
 *
 * @module renderer/components/history/VersionTimeline
 */

import * as React from 'react';
import { Clock, Save, GitBranch } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import type { VersionEntry, VersionSource } from '@shared/contracts/history-schemas';

// ============================================================================
// Types
// ============================================================================

export interface VersionTimelineProps {
  readonly entries: readonly VersionEntry[];
  readonly selectedEntryId: string | null;
  readonly onSelect: (entryId: string) => void;
  readonly className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}

function SourceIcon({ source }: { readonly source: VersionSource }): React.JSX.Element {
  switch (source) {
    case 'autosave':
      return <Clock className="h-4 w-4" />;
    case 'manual':
      return <Save className="h-4 w-4" />;
    case 'git':
      return <GitBranch className="h-4 w-4" />;
  }
}

function getSourceLabel(source: VersionSource): string {
  switch (source) {
    case 'autosave':
      return 'Auto-save';
    case 'manual':
      return 'Manual save';
    case 'git':
      return 'Git commit';
  }
}

function TimelineEntry({
  entry,
  isSelected,
  onSelect,
}: {
  readonly entry: VersionEntry;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={cn(
        'relative flex w-full items-start gap-3 px-2 py-2 text-left transition-colors',
        'hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
      onClick={() => onSelect(entry.id)}
    >
      <div
        className={cn(
          'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
          isSelected
            ? 'border-primary text-primary'
            : 'border-muted-foreground/30 text-muted-foreground'
        )}
      >
        <SourceIcon source={entry.source} />
      </div>
      <div className="flex-1 overflow-hidden pt-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {getSourceLabel(entry.source)}
          </span>
          <span className="text-xs text-muted-foreground/70">
            {formatRelativeTime(entry.timestamp)}
          </span>
        </div>
        {entry.label !== undefined && entry.label.length > 0 && (
          <p className="mt-0.5 truncate text-sm">{entry.label}</p>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Vertical timeline of version history entries.
 */
export const VersionTimeline = React.memo(function VersionTimeline({
  entries,
  selectedEntryId,
  onSelect,
  className,
}: VersionTimelineProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-4 text-sm text-muted-foreground',
          className
        )}
      >
        No version history available
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} role="listbox" aria-label="Version history">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden="true" />
      {entries.map((entry) => (
        <TimelineEntry
          key={entry.id}
          entry={entry}
          isSelected={entry.id === selectedEntryId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
});
