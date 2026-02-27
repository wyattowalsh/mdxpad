/**
 * File Edit Diff Component
 *
 * Inline diff viewer for AI-generated file edits.
 * Shows unified diff with syntax highlighting.
 *
 * @module renderer/components/ai/FileEditDiff
 */

import * as React from 'react';
import { cn } from '@shared/lib/utils';
import type { FileEdit } from '../../stores/multi-file-ai-store';

// =============================================================================
// TYPES
// =============================================================================

export interface FileEditDiffProps {
  readonly edit: FileEdit;
  readonly className?: string;
}

interface DiffLine {
  readonly type: 'context' | 'added' | 'removed';
  readonly content: string;
  readonly lineNumber: number | null;
}

// =============================================================================
// DIFF COMPUTATION
// =============================================================================

function addInsertions(
  result: DiffLine[],
  modifiedLines: readonly string[],
  startIdx: number,
  endIdx: number
): void {
  for (let i = startIdx; i < endIdx; i++) {
    const line = modifiedLines[i];
    if (line !== undefined) {
      result.push({ type: 'added', content: line, lineNumber: i + 1 });
    }
  }
}

function handleMismatch(
  result: DiffLine[],
  oLine: string,
  mLine: string | undefined,
  modifiedLines: readonly string[],
  mi: number
): { oi: number; mi: number } {
  const futureIdx = modifiedLines.indexOf(oLine, mi);
  if (futureIdx >= 0 && futureIdx - mi <= 3) {
    addInsertions(result, modifiedLines, mi, futureIdx);
    result.push({ type: 'context', content: oLine, lineNumber: futureIdx + 1 });
    return { oi: 1, mi: futureIdx - mi + 1 };
  }
  result.push({ type: 'removed', content: oLine, lineNumber: null });
  if (mLine !== undefined) {
    result.push({ type: 'added', content: mLine, lineNumber: mi + 1 });
    return { oi: 1, mi: 1 };
  }
  return { oi: 1, mi: 0 };
}

/**
 * Compute a simple unified diff between two strings.
 * Uses a basic line-by-line comparison.
 */
export function computeDiffLines(original: string, modified: string): readonly DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const result: DiffLine[] = [];

  let oi = 0;
  let mi = 0;

  while (oi < originalLines.length || mi < modifiedLines.length) {
    const oLine = oi < originalLines.length ? originalLines[oi] : undefined;
    const mLine = mi < modifiedLines.length ? modifiedLines[mi] : undefined;

    if (oLine !== undefined && mLine !== undefined && oLine === mLine) {
      result.push({ type: 'context', content: oLine, lineNumber: mi + 1 });
      oi++;
      mi++;
    } else if (oLine !== undefined && (mLine === undefined || oLine !== mLine)) {
      const advance = handleMismatch(result, oLine, mLine, modifiedLines, mi);
      oi += advance.oi;
      mi += advance.mi;
    } else if (mLine !== undefined) {
      result.push({ type: 'added', content: mLine, lineNumber: mi + 1 });
      mi++;
    }
  }

  return result;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function computeStats(diffLines: readonly DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diffLines) {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
  }
  return { added, removed };
}

const DiffHeader: React.FC<{
  readonly path: string;
  readonly stats: { added: number; removed: number };
}> = ({ path, stats }) => (
  <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 text-xs">
    <span className="font-mono truncate">{path}</span>
    <div className="flex items-center gap-2">
      {stats.added > 0 ? (
        <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
      ) : null}
      {stats.removed > 0 ? (
        <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
      ) : null}
    </div>
  </div>
);
DiffHeader.displayName = 'DiffHeader';

const DiffLineRow: React.FC<{ readonly line: DiffLine }> = ({ line }) => (
  <div
    className={cn(
      'px-3 font-mono',
      line.type === 'added' && 'bg-green-500/10 text-green-700 dark:text-green-300',
      line.type === 'removed' && 'bg-red-500/10 text-red-700 dark:text-red-300',
      line.type === 'context' && 'text-muted-foreground'
    )}
  >
    <span className="inline-block w-4 select-none text-right opacity-50">
      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
    </span>
    <span className="ml-2">{line.content}</span>
  </div>
);
DiffLineRow.displayName = 'DiffLineRow';

// =============================================================================
// COMPONENT
// =============================================================================

export const FileEditDiff: React.FC<FileEditDiffProps> = ({ edit, className }) => {
  const diffLines = React.useMemo(
    () => computeDiffLines(edit.original, edit.modified),
    [edit.original, edit.modified]
  );
  const stats = React.useMemo(() => computeStats(diffLines), [diffLines]);

  return (
    <div className={cn('rounded-md border overflow-hidden', className)}>
      <DiffHeader path={edit.path} stats={stats} />
      <div className="overflow-x-auto">
        <pre className="text-xs leading-5">
          <code>
            {diffLines.map((line, idx) => (
              <DiffLineRow key={idx} line={line} />
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};

FileEditDiff.displayName = 'FileEditDiff';
