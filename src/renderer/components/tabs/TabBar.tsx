/**
 * TabBar Component
 *
 * Horizontal tab bar for tabbed editing. Displays tabs with filename and
 * dirty indicator, supports drag-to-reorder via @dnd-kit, overflow scrolling,
 * close on hover, middle-click close, and context menu actions.
 *
 * @module renderer/components/tabs/TabBar
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@shared/lib/utils';
import { useTabStore } from '@renderer/stores/tab-store';
import {
  activateDocumentTab,
  closeDocumentTab,
  closeDocumentTabsToRight,
  closeOtherDocumentTabs,
} from './document-tabs';
import { TabItem } from './TabItem';
import { TabContextMenu } from './TabContextMenu';

function TabBarComponent() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const reorderTabs = useTabStore((s) => s.reorderTabs);

  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const fromIndex = tabs.findIndex((t) => t.id === active.id);
      const toIndex = tabs.findIndex((t) => t.id === over.id);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderTabs(fromIndex, toIndex);
      }
    },
    [tabs, reorderTabs]
  );

  const handleContextMenu = useCallback((tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuTabId(tabId);
    setContextMenuOpen(true);
  }, []);

  const focusTab = useCallback((tabId: string) => {
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-testid="tab-item-${tabId}"]`);
      element?.focus();
    });
  }, []);

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (tabs.length === 0) {
        return;
      }

      let targetIndex = index;
      switch (event.key) {
        case 'ArrowRight':
          targetIndex = index < tabs.length - 1 ? index + 1 : 0;
          break;
        case 'ArrowLeft':
          targetIndex = index > 0 ? index - 1 : tabs.length - 1;
          break;
        case 'Home':
          targetIndex = 0;
          break;
        case 'End':
          targetIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      const nextTab = tabs[targetIndex];
      if (nextTab) {
        activateDocumentTab(nextTab.id);
        focusTab(nextTab.id);
      }
    },
    [tabs, focusTab]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        e.preventDefault();
        const targetTab = tabs[num - 1];
        if (targetTab) {
          activateDocumentTab(targetTab.id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs]);

  if (tabs.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-stretch overflow-x-auto',
        'border-b border-border',
        'bg-muted/30',
        'select-none'
      )}
      role="tablist"
      aria-label="Open files"
      data-testid="tab-bar"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, index) => {
            const isContextTarget = contextMenuTabId === tab.id;
            const tabElement = (
              <TabItem
                key={tab.id}
                id={tab.id}
                fileName={tab.fileName}
                isDirty={tab.isDirty}
                isActive={tab.id === activeTabId}
                onClick={() => activateDocumentTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                onClose={() => closeDocumentTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(tab.id, e)}
              />
            );

            if (isContextTarget) {
              return (
                <TabContextMenu
                  key={tab.id}
                  tabId={tab.id}
                  open={contextMenuOpen}
                  onOpenChange={setContextMenuOpen}
                  onClose={() => closeDocumentTab(tab.id)}
                  onCloseOthers={() => closeOtherDocumentTabs(tab.id)}
                  onCloseToRight={() => closeDocumentTabsToRight(tab.id)}
                >
                  {tabElement}
                </TabContextMenu>
              );
            }

            return tabElement;
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export const TabBar = memo(TabBarComponent);
TabBar.displayName = 'TabBar';
