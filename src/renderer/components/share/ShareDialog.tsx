/**
 * Share Dialog Component
 *
 * Dialog for generating, copying, and managing share links for documents.
 * Supports read-only mode toggle and active share management.
 *
 * @module renderer/components/share/ShareDialog
 */

import { memo, useState, useCallback } from 'react';
import { cn } from '@shared/lib/utils';
import type { ShareLink, ShareAccessMode } from '@shared/contracts/share-schemas';

// ============================================================================
// Types
// ============================================================================

export interface ShareDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly activeLinks: readonly ShareLink[];
  readonly onCreateLink: (accessMode: ShareAccessMode) => void;
  readonly onRevokeLink: (linkId: string) => void;
  readonly onCopyLink: (url: string) => void;
  readonly onOpenLink: (url: string) => void;
  readonly error?: string | null;
}

// ============================================================================
// Link Status Indicator
// ============================================================================

interface LinkStatusProps {
  readonly isActive: boolean;
  readonly isExpired: boolean;
  readonly accessMode: string;
}

function LinkStatusComponent({ isActive, isExpired, accessMode }: LinkStatusProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full flex-shrink-0',
          isActive && !isExpired ? 'bg-green-500' : 'bg-gray-400'
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-medium truncate">
        {accessMode === 'read-only' ? 'Read Only' : 'Read/Write'}
      </span>
    </div>
  );
}

const LinkStatus = memo(LinkStatusComponent);
LinkStatus.displayName = 'LinkStatus';

// ============================================================================
// Link Actions
// ============================================================================

interface LinkActionsProps {
  readonly isActive: boolean;
  readonly onCopy: () => void;
  readonly onRevoke: () => void;
}

function LinkActionsComponent({ isActive, onCopy, onRevoke }: LinkActionsProps) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        className={cn(
          'text-[10px] px-2 py-0.5 rounded',
          'bg-primary/10 text-primary',
          'hover:bg-primary/20 transition-colors'
        )}
        onClick={onCopy}
        aria-label="Copy share link"
      >
        Copy
      </button>
      {isActive && (
        <button
          type="button"
          className={cn(
            'text-[10px] px-2 py-0.5 rounded',
            'bg-destructive/10 text-destructive',
            'hover:bg-destructive/20 transition-colors'
          )}
          onClick={onRevoke}
          aria-label="Revoke share link"
        >
          Revoke
        </button>
      )}
    </div>
  );
}

const LinkActions = memo(LinkActionsComponent);
LinkActions.displayName = 'LinkActions';

// ============================================================================
// Link Item
// ============================================================================

interface LinkItemProps {
  readonly link: ShareLink;
  readonly onRevoke: () => void;
  readonly onCopy: () => void;
  readonly onOpen: () => void;
}

function LinkItemComponent({ link, onRevoke, onCopy, onOpen }: LinkItemProps) {
  const isExpired = link.expiresAt !== null && Date.now() > link.expiresAt;
  const canOpen = link.isActive && !isExpired;

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded border border-border',
        (!link.isActive || isExpired) && 'opacity-50'
      )}
      data-testid={`share-link-${link.id}`}
    >
      <div className="flex-1 min-w-0">
        <LinkStatus isActive={link.isActive} isExpired={isExpired} accessMode={link.accessMode} />
        <button
          type="button"
          className="block w-full text-left text-[10px] text-muted-foreground truncate mt-0.5 pl-3.5 hover:text-foreground disabled:hover:text-muted-foreground"
          onClick={onOpen}
          disabled={!canOpen}
        >
          {link.url}
        </button>
      </div>
      <LinkActions isActive={link.isActive} onCopy={onCopy} onRevoke={onRevoke} />
    </div>
  );
}

const LinkItem = memo(LinkItemComponent);
LinkItem.displayName = 'LinkItem';

// ============================================================================
// Dialog Header
// ============================================================================

interface DialogHeaderProps {
  readonly onClose: () => void;
}

function DialogHeaderComponent({ onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground">Share Document</h2>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        &times;
      </button>
    </div>
  );
}

const DialogHeader = memo(DialogHeaderComponent);
DialogHeader.displayName = 'DialogHeader';

// ============================================================================
// Create Link Controls
// ============================================================================

interface CreateLinkControlsProps {
  readonly accessMode: ShareAccessMode;
  readonly onToggleAccess: () => void;
  readonly onCreate: () => void;
}

function CreateLinkControlsComponent({
  accessMode,
  onToggleAccess,
  onCreate,
}: CreateLinkControlsProps) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <button
        type="button"
        className={cn(
          'flex-1 text-xs py-1.5 rounded',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 transition-colors'
        )}
        onClick={onCreate}
      >
        Generate Link
      </button>
      <button
        type="button"
        className={cn(
          'text-xs px-3 py-1.5 rounded border border-border',
          'hover:bg-muted transition-colors'
        )}
        onClick={onToggleAccess}
        aria-label={`Access mode: ${accessMode}`}
      >
        {accessMode === 'read-only' ? 'Read Only' : 'Read/Write'}
      </button>
    </div>
  );
}

const CreateLinkControls = memo(CreateLinkControlsComponent);
CreateLinkControls.displayName = 'CreateLinkControls';

// ============================================================================
// Link List
// ============================================================================

interface LinkListProps {
  readonly links: readonly ShareLink[];
  readonly onRevokeLink: (linkId: string) => void;
  readonly onCopyLink: (url: string) => void;
  readonly onOpenLink: (url: string) => void;
}

function LinkListComponent({ links, onRevokeLink, onCopyLink, onOpenLink }: LinkListProps) {
  if (links.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-3">No active share links</p>;
  }

  return (
    <>
      {links.map((link) => (
        <LinkItem
          key={link.id}
          link={link}
          onRevoke={() => onRevokeLink(link.id)}
          onCopy={() => onCopyLink(link.url)}
          onOpen={() => onOpenLink(link.url)}
        />
      ))}
    </>
  );
}

const LinkList = memo(LinkListComponent);
LinkList.displayName = 'LinkList';

// ============================================================================
// Dialog Component
// ============================================================================

function ShareDialogComponent({
  isOpen,
  onClose,
  activeLinks,
  onCreateLink,
  onRevokeLink,
  onCopyLink,
  onOpenLink,
  error = null,
}: ShareDialogProps) {
  const [accessMode, setAccessMode] = useState<ShareAccessMode>('read-only');

  const handleCreate = useCallback(() => {
    onCreateLink(accessMode);
  }, [accessMode, onCreateLink]);

  const handleToggleAccess = useCallback(() => {
    setAccessMode((prev) => (prev === 'read-only' ? 'read-write' : 'read-only'));
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share document"
      data-testid="share-dialog"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'relative bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-md mx-4 p-4'
        )}
      >
        <DialogHeader onClose={onClose} />
        {error ? (
          <p className="text-destructive mb-2 text-xs" role="alert">
            {error}
          </p>
        ) : null}
        <CreateLinkControls
          accessMode={accessMode}
          onToggleAccess={handleToggleAccess}
          onCreate={handleCreate}
        />
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <LinkList
            links={activeLinks}
            onRevokeLink={onRevokeLink}
            onCopyLink={onCopyLink}
            onOpenLink={onOpenLink}
          />
        </div>
      </div>
    </div>
  );
}

export const ShareDialog = memo(ShareDialogComponent);
ShareDialog.displayName = 'ShareDialog';
