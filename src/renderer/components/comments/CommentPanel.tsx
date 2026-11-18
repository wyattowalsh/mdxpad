/**
 * Comment Panel Component
 *
 * Side panel listing all comment threads with filtering by status.
 * Clicking a thread navigates to its location in the editor.
 *
 * @module renderer/components/comments/CommentPanel
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { cn } from '@shared/lib/utils';
import type { CommentThread } from '@renderer/stores/comments-store';
import { sourcePosition } from './comment-position';

// ============================================================================
// Types
// ============================================================================

type FilterMode = 'all' | 'unresolved' | 'resolved';

export interface CommentPanelProps {
  readonly threads: readonly CommentThread[];
  readonly content?: string;
  readonly activeThreadId: string | null;
  readonly onSelectThread: (threadId: string) => void;
  readonly onNavigateToThread: (threadId: string) => void;
}

// ============================================================================
// Thread Summary — Header
// ============================================================================

interface ThreadSummaryHeaderProps {
  readonly author: string;
  readonly messageCount: number;
  readonly resolved: boolean;
}

function ThreadSummaryHeaderComponent({
  author,
  messageCount,
  resolved,
}: ThreadSummaryHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-0.5">
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full flex-shrink-0',
          resolved ? 'bg-green-500' : 'bg-yellow-500'
        )}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-foreground truncate">{author}</span>
      <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
        {messageCount} msg{messageCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

const ThreadSummaryHeader = memo(ThreadSummaryHeaderComponent);
ThreadSummaryHeader.displayName = 'ThreadSummaryHeader';

// ============================================================================
// Thread Summary
// ============================================================================

interface ThreadSummaryProps {
  readonly thread: CommentThread;
  readonly content: string;
  readonly isActive: boolean;
  readonly onSelect: () => void;
  readonly onNavigate: () => void;
}

function ThreadSummaryComponent({
  thread,
  content,
  isActive,
  onSelect,
  onNavigate,
}: ThreadSummaryProps) {
  const firstMessage = thread.messages[0];
  const preview = firstMessage
    ? firstMessage.content.length > 80
      ? `${firstMessage.content.slice(0, 80)}...`
      : firstMessage.content
    : '';

  return (
    <button
      type="button"
      className={cn(
        'w-full text-left p-2 rounded-md transition-colors',
        'hover:bg-muted/60',
        isActive && 'bg-muted ring-1 ring-ring/20'
      )}
      onClick={onSelect}
      onDoubleClick={onNavigate}
      data-testid={`comment-panel-thread-${thread.id}`}
      aria-label={`Thread: ${preview}, ${thread.messages.length} messages, ${thread.resolved ? 'resolved' : 'open'}`}
    >
      <ThreadSummaryHeader
        author={firstMessage?.author ?? 'Unknown'}
        messageCount={thread.messages.length}
        resolved={thread.resolved}
      />
      <p className="text-xs text-muted-foreground truncate pl-4">{preview}</p>
      <div className="flex items-center gap-2 mt-0.5 pl-4">
        <span className="text-[10px] text-muted-foreground">
          Line {sourcePosition(content, thread.anchorFrom).line}
        </span>
      </div>
    </button>
  );
}

const ThreadSummary = memo(ThreadSummaryComponent);
ThreadSummary.displayName = 'ThreadSummary';

// ============================================================================
// Filter Tabs
// ============================================================================

interface FilterTabsProps {
  readonly filter: FilterMode;
  readonly onFilterChange: (filter: FilterMode) => void;
  readonly counts: {
    readonly all: number;
    readonly unresolved: number;
    readonly resolved: number;
  };
}

const FILTER_TABS: readonly { readonly value: FilterMode; readonly label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unresolved', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

function FilterTabsComponent({ filter, onFilterChange, counts }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md" role="tablist">
      {FILTER_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={filter === tab.value}
          className={cn(
            'flex-1 text-[10px] py-1 px-2 rounded transition-colors',
            filter === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => onFilterChange(tab.value)}
        >
          {tab.label} ({counts[tab.value]})
        </button>
      ))}
    </div>
  );
}

const FilterTabs = memo(FilterTabsComponent);
FilterTabs.displayName = 'FilterTabs';

// ============================================================================
// Thread List
// ============================================================================

interface ThreadListProps {
  readonly threads: readonly CommentThread[];
  readonly content: string;
  readonly activeThreadId: string | null;
  readonly filter: FilterMode;
  readonly onSelect: (threadId: string) => void;
  readonly onNavigate: (threadId: string) => void;
}

function ThreadListComponent({
  threads,
  content,
  activeThreadId,
  filter,
  onSelect,
  onNavigate,
}: ThreadListProps) {
  if (threads.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {filter === 'all' ? 'No comments yet' : `No ${filter} comments`}
      </div>
    );
  }

  return (
    <>
      {threads.map((thread) => (
        <ThreadSummary
          key={thread.id}
          thread={thread}
          content={content}
          isActive={thread.id === activeThreadId}
          onSelect={() => onSelect(thread.id)}
          onNavigate={() => onNavigate(thread.id)}
        />
      ))}
    </>
  );
}

const ThreadList = memo(ThreadListComponent);
ThreadList.displayName = 'ThreadList';

// ============================================================================
// Panel Component
// ============================================================================

function useFilteredThreads(threads: readonly CommentThread[]) {
  const [filter, setFilter] = useState<FilterMode>('all');

  const counts = useMemo(
    () => ({
      all: threads.length,
      unresolved: threads.filter((t) => !t.resolved).length,
      resolved: threads.filter((t) => t.resolved).length,
    }),
    [threads]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case 'unresolved':
        return threads.filter((t) => !t.resolved);
      case 'resolved':
        return threads.filter((t) => t.resolved);
      default:
        return threads;
    }
  }, [threads, filter]);

  return { filter, setFilter, counts, filtered };
}

function CommentPanelComponent({
  threads,
  content = '',
  activeThreadId,
  onSelectThread,
  onNavigateToThread,
}: CommentPanelProps) {
  const { filter, setFilter, counts, filtered } = useFilteredThreads(threads);

  const handleSelect = useCallback(
    (threadId: string) => onSelectThread(threadId),
    [onSelectThread]
  );

  const handleNavigate = useCallback(
    (threadId: string) => onNavigateToThread(threadId),
    [onNavigateToThread]
  );

  return (
    <div
      className="flex flex-col h-full"
      data-testid="comment-panel"
      role="region"
      aria-label="Comments"
    >
      <div className="px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium text-foreground mb-1.5">Comments</h3>
        <FilterTabs filter={filter} onFilterChange={setFilter} counts={counts} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
        <ThreadList
          threads={filtered}
          content={content}
          activeThreadId={activeThreadId}
          filter={filter}
          onSelect={handleSelect}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}

export const CommentPanel = memo(CommentPanelComponent);
CommentPanel.displayName = 'CommentPanel';
