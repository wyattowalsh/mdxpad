/**
 * Conflict Resolver Dialog
 *
 * Shows when a key binding conflicts with an existing shortcut.
 * Provides options: replace, cancel, or reassign the conflicting command.
 *
 * @module renderer/components/shortcuts/ConflictResolver
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ui/dialog';
import { Button } from '@ui/button';
import type { Modifier } from '../../stores/keybinding-store';
import { normalizeKeybinding } from '../../stores/keybinding-store';

// =============================================================================
// TYPES
// =============================================================================

export interface ConflictInfo {
  readonly newCommandId: string;
  readonly newCommandLabel: string;
  readonly conflictingCommandId: string;
  readonly conflictingCommandLabel: string;
  readonly key: string;
  readonly modifiers: readonly Modifier[];
}

export interface ConflictResolverProps {
  readonly conflict: ConflictInfo | null;
  readonly onReplace: () => void;
  readonly onCancel: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflict,
  onReplace,
  onCancel,
}) => {
  if (!conflict) return null;

  const shortcutDisplay = normalizeKeybinding(conflict.key, conflict.modifiers);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Keyboard Shortcut Conflict
          </DialogTitle>
          <DialogDescription>
            The shortcut{' '}
            <kbd className="mx-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
              {shortcutDisplay}
            </kbd>{' '}
            is already assigned to <strong>{conflict.conflictingCommandLabel}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/50 p-3 text-sm">
          <p>
            Assigning this shortcut to <strong>{conflict.newCommandLabel}</strong> will remove it
            from <strong>{conflict.conflictingCommandLabel}</strong>.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onReplace}>
            Replace Binding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ConflictResolver.displayName = 'ConflictResolver';
