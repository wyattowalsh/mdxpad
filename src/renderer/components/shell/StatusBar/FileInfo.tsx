/**
 * FileInfo Component
 *
 * Displays the current filename with dirty and orphan indicators.
 * Shows a bullet (dot) when file has unsaved changes.
 * Shows "(Deleted)" suffix when file was deleted externally.
 *
 * @module renderer/components/shell/StatusBar/FileInfo
 */

import { memo } from 'react';
import { cn } from '@shared/lib/utils';
import type { FileInfoProps } from './types';

/**
 * FileInfo displays the current file name with status indicators.
 *
 * @example
 * ```tsx
 * <FileInfo fileName="document.mdx" isDirty={true} />
 * // Renders: "document.mdx •"
 *
 * <FileInfo fileName="document.mdx" isDirty={false} isOrphan={true} />
 * // Renders: "document.mdx (Deleted)"
 * ```
 */
function FileInfoComponent({ fileName, isDirty, isOrphan = false }: FileInfoProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm text-muted-foreground truncate max-w-[200px]',
        isOrphan && 'text-destructive'
      )}
      title={`${fileName}${isDirty ? ' (unsaved)' : ''}${isOrphan ? ' (deleted)' : ''}`}
    >
      <span className="truncate" data-testid="file-info-name">
        {fileName}
      </span>
      {isOrphan && (
        <span className="text-destructive whitespace-nowrap" data-testid="file-info-orphan">
          (Deleted)
        </span>
      )}
      {isDirty && !isOrphan && (
        <span
          className="text-muted-foreground"
          aria-label="Unsaved changes"
          data-testid="file-info-dirty"
        >
          {'\u2022'}
        </span>
      )}
    </div>
  );
}

export const FileInfo = memo(FileInfoComponent);
FileInfo.displayName = 'FileInfo';
