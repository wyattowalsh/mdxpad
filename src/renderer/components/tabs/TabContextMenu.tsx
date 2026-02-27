/**
 * TabContextMenu Component
 *
 * Right-click context menu for tabs using Radix DropdownMenu.
 * Provides Close, Close Others, and Close to Right actions.
 *
 * @module renderer/components/tabs/TabContextMenu
 */

import { memo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu';

export interface TabContextMenuProps {
  readonly tabId: string;
  readonly children: React.ReactNode;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClose: () => void;
  readonly onCloseOthers: () => void;
  readonly onCloseToRight: () => void;
}

function TabContextMenuComponent({
  children,
  open,
  onOpenChange,
  onClose,
  onCloseOthers,
  onCloseToRight,
}: TabContextMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid="tab-context-menu">
        <DropdownMenuItem onClick={onClose} data-testid="tab-ctx-close">
          Close
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCloseOthers} data-testid="tab-ctx-close-others">
          Close Others
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCloseToRight} data-testid="tab-ctx-close-right">
          Close to the Right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const TabContextMenu = memo(TabContextMenuComponent);
TabContextMenu.displayName = 'TabContextMenu';
