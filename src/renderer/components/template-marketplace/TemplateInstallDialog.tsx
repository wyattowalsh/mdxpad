/**
 * Template Install Dialog Component
 *
 * Dialog showing template details (author, description, preview)
 * with install/cancel buttons and progress indicator.
 *
 * @module renderer/components/template-marketplace/TemplateInstallDialog
 */

import * as React from 'react';
import { Download, User, Tag, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ui/dialog';
import { Button } from '@ui/button';
import type { MarketplaceTemplate } from '../../stores/marketplace-store';
import { useMarketplaceStore, selectIsInstalling } from '../../stores/marketplace-store';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateInstallDialogProps {
  readonly template: MarketplaceTemplate | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface MetadataRowProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
}

const MetadataRow: React.FC<MetadataRowProps> = ({ icon, label, value }) => (
  <>
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <span className="font-medium capitalize">{value}</span>
  </>
);
MetadataRow.displayName = 'MetadataRow';

const TemplateMetadata: React.FC<{ readonly template: MarketplaceTemplate }> = ({ template }) => (
  <div className="grid grid-cols-2 gap-2 text-sm">
    <MetadataRow icon={<User className="h-3.5 w-3.5" />} label="Author" value={template.author} />
    <MetadataRow
      icon={<Tag className="h-3.5 w-3.5" />}
      label="Category"
      value={template.category}
    />
    <MetadataRow
      icon={<Clock className="h-3.5 w-3.5" />}
      label="Version"
      value={template.version}
    />
    <MetadataRow
      icon={<Download className="h-3.5 w-3.5" />}
      label="Downloads"
      value={template.downloads.toLocaleString()}
    />
  </div>
);
TemplateMetadata.displayName = 'TemplateMetadata';

const InstallButton: React.FC<{
  readonly isInstalling: boolean;
  readonly onClick: () => void;
}> = ({ isInstalling, onClick }) => (
  <Button onClick={onClick} disabled={isInstalling}>
    {isInstalling ? (
      <>
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        Installing...
      </>
    ) : (
      <>
        <Download className="mr-1.5 h-4 w-4" />
        Install
      </>
    )}
  </Button>
);
InstallButton.displayName = 'InstallButton';

// =============================================================================
// COMPONENT
// =============================================================================

export const TemplateInstallDialog: React.FC<TemplateInstallDialogProps> = ({
  template,
  open,
  onOpenChange,
}) => {
  const installTemplate = useMarketplaceStore((s) => s.installTemplate);
  const isInstalling = useMarketplaceStore(
    template ? selectIsInstalling(template.id) : () => false
  );

  const handleInstall = React.useCallback(() => {
    if (!template) return;
    void installTemplate(template.id).then(() => {
      onOpenChange(false);
    });
  }, [template, installTemplate, onOpenChange]);

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>{template.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <TemplateMetadata template={template} />
          {template.previewUrl ? (
            <a
              href={template.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View preview
            </a>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <InstallButton isInstalling={isInstalling} onClick={handleInstall} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

TemplateInstallDialog.displayName = 'TemplateInstallDialog';
