/**
 * Comment Thread Component
 *
 * Displays a list of messages within a comment thread.
 * Includes an input for new messages and resolve/unresolve controls.
 *
 * @module renderer/components/comments/CommentThread
 */

import { memo, useState, useCallback, type FormEvent } from 'react';
import { cn } from '@shared/lib/utils';
import type {
  CommentThread as CommentThreadType,
  CommentMessage,
} from '@renderer/stores/comments-store';

// ============================================================================
// Types
// ============================================================================

export interface CommentThreadProps {
  readonly thread: CommentThreadType;
  readonly currentUser: string;
  readonly onAddMessage: (threadId: string, content: string) => void;
  readonly onResolve: (threadId: string) => void;
  readonly onUnresolve: (threadId: string) => void;
  readonly onDelete?: ((threadId: string) => void) | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimestamp(ts: number): string {
  const diffMins = Math.floor((Date.now() - ts) / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ============================================================================
// Message Sub-component
// ============================================================================

function MessageItemComponent({ message }: { readonly message: CommentMessage }) {
  return (
    <div className="py-1.5" data-testid={`comment-message-${message.id}`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-xs font-medium text-foreground">{message.author}</span>
        <span className="text-[10px] text-muted-foreground">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>
      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
        {message.content}
      </p>
    </div>
  );
}

const MessageItem = memo(MessageItemComponent);
MessageItem.displayName = 'MessageItem';

// ============================================================================
// Reply Form Sub-component
// ============================================================================

interface ReplyFormProps {
  readonly threadId: string;
  readonly currentUser: string;
  readonly onAddMessage: (threadId: string, content: string) => void;
}

function ReplyFormComponent({ threadId, currentUser, onAddMessage }: ReplyFormProps) {
  const [newMessage, setNewMessage] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = newMessage.trim();
      if (trimmed.length === 0) return;
      onAddMessage(threadId, trimmed);
      setNewMessage('');
    },
    [newMessage, threadId, onAddMessage]
  );

  return (
    <form onSubmit={handleSubmit} className="mt-2">
      <textarea
        className={cn(
          'w-full text-xs p-1.5 rounded border border-border bg-background resize-none',
          'focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground'
        )}
        rows={2}
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        placeholder={`Reply as ${currentUser}...`}
        aria-label="Reply to thread"
      />
      <button
        type="submit"
        disabled={newMessage.trim().length === 0}
        className={cn(
          'text-xs px-2 py-0.5 rounded mt-1 bg-primary text-primary-foreground',
          'hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        Reply
      </button>
    </form>
  );
}

const ReplyForm = memo(ReplyFormComponent);
ReplyForm.displayName = 'ReplyForm';

// ============================================================================
// Thread Actions
// ============================================================================

interface ThreadActionsProps {
  readonly threadId: string;
  readonly resolved: boolean;
  readonly onResolveToggle: () => void;
  readonly onDelete?: ((threadId: string) => void) | undefined;
}

function ThreadActionsComponent({ threadId, resolved, onResolveToggle, onDelete }: ThreadActionsProps) {
  return (
    <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/50">
      <button
        type="button"
        className={cn(
          'text-[10px] px-1.5 py-0.5 rounded transition-colors',
          resolved
            ? 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20'
            : 'bg-green-500/10 text-green-700 hover:bg-green-500/20'
        )}
        onClick={onResolveToggle}
      >
        {resolved ? 'Reopen' : 'Resolve'}
      </button>
      {onDelete && (
        <button
          type="button"
          className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          onClick={() => onDelete(threadId)}
        >
          Delete
        </button>
      )}
    </div>
  );
}

const ThreadActions = memo(ThreadActionsComponent);
ThreadActions.displayName = 'ThreadActions';

// ============================================================================
// Thread Component
// ============================================================================

function CommentThreadComponent({
  thread,
  currentUser,
  onAddMessage,
  onResolve,
  onUnresolve,
  onDelete,
}: CommentThreadProps) {
  const handleResolveToggle = useCallback(() => {
    if (thread.resolved) {
      onUnresolve(thread.id);
    } else {
      onResolve(thread.id);
    }
  }, [thread.id, thread.resolved, onResolve, onUnresolve]);

  return (
    <div
      className={cn('border border-border rounded-md p-2.5', thread.resolved && 'opacity-70')}
      data-testid={`comment-thread-${thread.id}`}
      role="article"
      aria-label={`Comment thread, ${thread.messages.length} messages, ${thread.resolved ? 'resolved' : 'open'}`}
    >
      <div className="divide-y divide-border/50">
        {thread.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
      {!thread.resolved && (
        <ReplyForm threadId={thread.id} currentUser={currentUser} onAddMessage={onAddMessage} />
      )}
      <ThreadActions
        threadId={thread.id}
        resolved={thread.resolved}
        onResolveToggle={handleResolveToggle}
        onDelete={onDelete}
      />
    </div>
  );
}

export const CommentThreadView = memo(CommentThreadComponent);
CommentThreadView.displayName = 'CommentThreadView';
