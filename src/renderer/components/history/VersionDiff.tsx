/**
 * VersionDiff Component
 *
 * Displays a unified diff view between two versions of content.
 * Uses the `diff` package to compute text differences with
 * syntax-highlighted added/removed line indicators.
 *
 * @module renderer/components/history/VersionDiff
 */

import * as React from 'react';
import { diffLines, type Change } from 'diff';
import { cn } from '@shared/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface VersionDiffProps {
  /** Original (older) content */
  readonly oldContent: string;
  /** New (current) content */
  readonly newContent: string;
  /** Label for the old version */
  readonly oldLabel?: string;
  /** Label for the new version */
  readonly newLabel?: string;
  /** Optional additional CSS class name */
  readonly className?: string;
}

interface DiffLine {
  readonly lineNumber: { readonly old: number | null; readonly new: number | null };
  readonly type: 'added' | 'removed' | 'unchanged';
  readonly content: string;
}

// ============================================================================
// Helpers
// ============================================================================

function changesToLines(changes: readonly Change[]): readonly DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const changeLines = change.value.split('\n');
    if (changeLines.length > 0 && changeLines[changeLines.length - 1] === '') {
      changeLines.pop();
    }

    for (const line of changeLines) {
      if (change.added) {
        lines.push({ lineNumber: { old: null, new: newLine }, type: 'added', content: line });
        newLine += 1;
      } else if (change.removed) {
        lines.push({ lineNumber: { old: oldLine, new: null }, type: 'removed', content: line });
        oldLine += 1;
      } else {
        lines.push({
          lineNumber: { old: oldLine, new: newLine },
          type: 'unchanged',
          content: line,
        });
        oldLine += 1;
        newLine += 1;
      }
    }
  }

  return lines;
}

function DiffRow({ line }: { readonly line: DiffLine }): React.JSX.Element {
  return (
    <tr
      className={cn(
        line.type === 'added' && 'bg-green-50 dark:bg-green-950/30',
        line.type === 'removed' && 'bg-red-50 dark:bg-red-950/30'
      )}
    >
      <td className="w-12 select-none border-r px-2 py-0 text-right text-muted-foreground/50">
        {line.lineNumber.old ?? ''}
      </td>
      <td className="w-12 select-none border-r px-2 py-0 text-right text-muted-foreground/50">
        {line.lineNumber.new ?? ''}
      </td>
      <td
        className={cn(
          'w-6 select-none px-1 py-0 text-center',
          line.type === 'added' && 'text-green-600 dark:text-green-400',
          line.type === 'removed' && 'text-red-600 dark:text-red-400'
        )}
      >
        {line.type === 'added' && '+'}
        {line.type === 'removed' && '-'}
      </td>
      <td
        className={cn(
          'whitespace-pre px-2 py-0',
          line.type === 'added' && 'text-green-800 dark:text-green-300',
          line.type === 'removed' && 'text-red-800 dark:text-red-300'
        )}
      >
        {line.content}
      </td>
    </tr>
  );
}

function DiffHeader({
  oldLabel,
  newLabel,
  stats,
}: {
  readonly oldLabel: string;
  readonly newLabel: string;
  readonly stats: { readonly added: number; readonly removed: number };
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-xs">
      <div className="flex gap-4">
        <span className="text-muted-foreground">{oldLabel}</span>
        <span className="text-muted-foreground">{newLabel}</span>
      </div>
      <div className="flex gap-2">
        {stats.added > 0 && (
          <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
        )}
        {stats.removed > 0 && (
          <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Unified diff viewer for comparing two versions of content.
 */
export const VersionDiff = React.memo(function VersionDiff({
  oldContent,
  newContent,
  oldLabel = 'Previous',
  newLabel = 'Current',
  className,
}: VersionDiffProps): React.JSX.Element {
  const changes = React.useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);
  const lines = React.useMemo(() => changesToLines(changes), [changes]);

  const stats = React.useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of lines) {
      if (line.type === 'added') added += 1;
      if (line.type === 'removed') removed += 1;
    }
    return { added, removed };
  }, [lines]);

  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className={cn('overflow-hidden rounded-md border', className)}>
      <DiffHeader oldLabel={oldLabel} newLabel={newLabel} stats={stats} />
      {!hasChanges ? (
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          No changes between versions
        </div>
      ) : (
        <div className="overflow-auto font-mono text-xs" role="region" aria-label="Diff view">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, index) => (
                <DiffRow key={index} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
