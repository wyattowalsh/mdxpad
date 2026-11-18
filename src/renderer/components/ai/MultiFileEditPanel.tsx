/**
 * Multi-File Edit Panel Component
 *
 * Panel showing AI-generated edits across multiple files.
 * Provides per-file accept/reject and bulk operations.
 *
 * @module renderer/components/ai/MultiFileEditPanel
 */

import * as React from 'react';
import { Check, X, CheckCheck, XCircle, FileText, Loader2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  useMultiFileAiStore,
  selectFileEdits,
  selectIsActive,
} from '../../stores/multi-file-ai-store';
import type { FileEdit } from '../../stores/multi-file-ai-store';
import { applyOpenDocumentEdit } from '@renderer/lib/apply-open-document-edit';
import { FileEditDiff } from './FileEditDiff';
import { Button } from '@ui/button';

// =============================================================================
// TYPES
// =============================================================================

export interface MultiFileEditPanelProps {
  readonly className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

// =============================================================================
// STATUS BADGE
// =============================================================================

const StatusBadge: React.FC<{ readonly status: FileEdit['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Pending
        </span>
      );
    case 'applied':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          Applied
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
          <X className="h-3 w-3" />
          Rejected
        </span>
      );
  }
};

StatusBadge.displayName = 'StatusBadge';

// =============================================================================
// HOOKS
// =============================================================================

function useExpandedPaths() {
  const [expandedPaths, setExpandedPaths] = React.useState<ReadonlySet<string>>(new Set());

  const toggleExpanded = React.useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  return { expandedPaths, toggleExpanded };
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const EmptyState: React.FC<{ readonly className?: string | undefined }> = ({ className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground',
      className
    )}
  >
    <FileText className="h-8 w-8" />
    <p className="text-sm">No multi-file edits in progress</p>
  </div>
);
EmptyState.displayName = 'EmptyState';

const BulkActions: React.FC<{
  readonly onApplyAll: () => void;
  readonly onRejectAll: () => void;
}> = ({ onApplyAll, onRejectAll }) => (
  <div className="flex items-center gap-1">
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onApplyAll}>
      <CheckCheck className="mr-1 h-3.5 w-3.5" />
      Accept All
    </Button>
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRejectAll}>
      <XCircle className="mr-1 h-3.5 w-3.5" />
      Reject All
    </Button>
  </div>
);
BulkActions.displayName = 'BulkActions';

const ProgressBar: React.FC<{
  readonly completed: number;
  readonly total: number;
}> = ({ completed, total }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{
        width: `${total > 0 ? (completed / total) * 100 : 0}%`,
      }}
    />
  </div>
);
ProgressBar.displayName = 'ProgressBar';

const FileEditActions: React.FC<{
  readonly editPath: string;
  readonly status: FileEdit['status'];
  readonly onApply: (path: string) => void;
  readonly onReject: (path: string) => void;
}> = ({ editPath, status, onApply, onReject }) => (
  <div className="flex items-center gap-2">
    <StatusBadge status={status} />
    {status === 'pending' ? (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
          onClick={() => onApply(editPath)}
          aria-label={`Accept edit for ${getFileName(editPath)}`}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
          onClick={() => onReject(editPath)}
          aria-label={`Reject edit for ${getFileName(editPath)}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </>
    ) : null}
  </div>
);
FileEditActions.displayName = 'FileEditActions';

const FileEditRow: React.FC<{
  readonly edit: FileEdit;
  readonly isExpanded: boolean;
  readonly onToggle: (path: string) => void;
  readonly onApply: (path: string) => void;
  readonly onReject: (path: string) => void;
}> = ({ edit, isExpanded, onToggle, onApply, onReject }) => (
  <div className="rounded-md border">
    <div className="flex items-center justify-between px-3 py-2">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium hover:underline"
        onClick={() => onToggle(edit.path)}
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        {getFileName(edit.path)}
      </button>
      <FileEditActions
        editPath={edit.path}
        status={edit.status}
        onApply={onApply}
        onReject={onReject}
      />
    </div>
    {isExpanded ? <FileEditDiff edit={edit} /> : null}
  </div>
);
FileEditRow.displayName = 'FileEditRow';

// =============================================================================
// COMPONENT
// =============================================================================

export const MultiFileEditPanel: React.FC<MultiFileEditPanelProps> = ({ className }) => {
  const fileEdits = useMultiFileAiStore(selectFileEdits);
  const isActive = useMultiFileAiStore(selectIsActive);
  const progress = React.useMemo(() => {
    const total = fileEdits.length;
    const pending = fileEdits.filter((edit) => edit.status === 'pending').length;
    return { total, completed: total - pending, pending };
  }, [fileEdits]);
  const applyEdit = useMultiFileAiStore((s) => s.applyEdit);
  const rejectEdit = useMultiFileAiStore((s) => s.rejectEdit);
  const rejectAll = useMultiFileAiStore((s) => s.rejectAll);
  const { expandedPaths, toggleExpanded } = useExpandedPaths();

  const handleApply = (path: string): void => {
    const edit = fileEdits.find((item) => item.path === path);
    if (edit?.status !== 'pending') {
      return;
    }
    if (!applyOpenDocumentEdit(edit.path, edit.modified)) {
      return;
    }
    applyEdit(path);
  };

  const handleApplyAll = (): void => {
    for (const edit of fileEdits) {
      if (edit.status === 'pending' && applyOpenDocumentEdit(edit.path, edit.modified)) {
        applyEdit(edit.path);
      }
    }
  };

  if (!isActive || fileEdits.length === 0) {
    return <EmptyState className={className} />;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Multi-File Edit</h3>
          <span className="text-xs text-muted-foreground">
            {progress.completed}/{progress.total} resolved
          </span>
        </div>
        {progress.pending > 0 ? (
          <BulkActions onApplyAll={handleApplyAll} onRejectAll={rejectAll} />
        ) : null}
      </div>
      <ProgressBar completed={progress.completed} total={progress.total} />
      <div className="flex flex-col gap-2">
        {fileEdits.map((edit) => (
          <FileEditRow
            key={edit.path}
            edit={edit}
            isExpanded={expandedPaths.has(edit.path)}
            onToggle={toggleExpanded}
            onApply={handleApply}
            onReject={rejectEdit}
          />
        ))}
      </div>
    </div>
  );
};

MultiFileEditPanel.displayName = 'MultiFileEditPanel';
