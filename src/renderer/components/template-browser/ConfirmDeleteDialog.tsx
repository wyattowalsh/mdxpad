/**
 * Confirm Delete Dialog
 *
 * Confirmation dialog for template deletion.
 * Shows template name and warns about irreversible action.
 *
 * Feature: 016-template-library
 * FR-014: Prevent deletion of built-in templates
 *
 * @module renderer/components/template-browser/ConfirmDeleteDialog
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/dialog';
import { Button } from '@ui/button';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Props for the ConfirmDeleteDialog component.
 */
export interface ConfirmDeleteDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog is closed */
  onClose: () => void;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
  /** Name of the template being deleted */
  templateName: string;
  /** Whether the delete operation is in progress */
  isDeleting?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Confirmation dialog for template deletion.
 *
 * Shows a warning message and requires explicit confirmation before
 * deleting a template. Includes loading state during deletion.
 *
 * @param props - Component props
 * @returns JSX element
 */
export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  templateName,
  isDeleting = false,
}: ConfirmDeleteDialogProps): React.JSX.Element {
  const handleConfirm = React.useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            Delete Template
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-semibold text-foreground">&ldquo;{templateName}&rdquo;</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteDialog;
