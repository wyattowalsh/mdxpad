/**
 * Agent Panel
 *
 * React panel showing the AI agent conversation thread, input area,
 * status indicators, and tool call approval UI.
 *
 * @module src/renderer/features/ai-agent/AgentPanel
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  useAgentModeStore,
  selectMessages,
  selectStatus,
  selectActiveToolCalls,
  selectError,
} from './agent-mode-store';
import { getToolDefinition } from './agent-tools';
import { openEditorFiles, openEditorText } from './open-editor-text';
import type { AgentMessage, AgentToolCall } from '@shared/contracts/agent-schemas';

// =============================================================================
// STATUS INDICATOR
// =============================================================================

function StatusIndicator({ status }: { status: string }) {
  const labels: Record<string, string> = {
    idle: 'Ready',
    thinking: 'Thinking...',
    executing: 'Executing...',
    'waiting-for-approval': 'Awaiting Approval',
    error: 'Error',
  };

  const colors: Record<string, string> = {
    idle: 'bg-gray-400',
    thinking: 'bg-blue-500 animate-pulse',
    executing: 'bg-yellow-500 animate-pulse',
    'waiting-for-approval': 'bg-orange-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
      <div className={`h-2 w-2 rounded-full ${colors[status] ?? 'bg-gray-400'}`} />
      <span>{labels[status] ?? status}</span>
    </div>
  );
}

// =============================================================================
// TOOL CALL CARD
// =============================================================================

function ToolCallCard({
  toolCall,
  onApprove,
  onReject,
}: {
  toolCall: AgentToolCall;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const definition = getToolDefinition(toolCall.toolName);
  const isPending = toolCall.status === 'pending';

  return (
    <div className="mx-3 my-1 rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
          Tool: {definition?.description ?? toolCall.toolName}
        </span>
        <span className="text-xs text-gray-500">{toolCall.status}</span>
      </div>
      <pre className="mb-2 overflow-auto rounded bg-white/50 p-2 text-xs dark:bg-black/20">
        {JSON.stringify(toolCall.args, null, 2)}
      </pre>
      {isPending && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApprove(toolCall.id)}
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReject(toolCall.id)}
            className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
          >
            Reject
          </button>
        </div>
      )}
      {toolCall.result && (
        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-900">
          {toolCall.result}
        </pre>
      )}
    </div>
  );
}

// =============================================================================
// MESSAGE BUBBLE
// =============================================================================

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3 py-1`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <span className="mt-1 block text-right text-[10px] opacity-50">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// AGENT PANEL
// =============================================================================

export function AgentPanel({
  workspacePath,
  currentFilePath,
}: {
  readonly workspacePath?: string;
  readonly currentFilePath?: string;
}) {
  const messages = useAgentModeStore(selectMessages);
  const status = useAgentModeStore(selectStatus);
  const activeToolCalls = useAgentModeStore(selectActiveToolCalls);
  const error = useAgentModeStore(selectError);
  const { sendMessage, approveToolCall, rejectToolCall, clearConversation, cancel } =
    useAgentModeStore();

  useEffect(() => {
    const agent = window.mdxpad.agent;
    if (!agent) {
      return undefined;
    }
    return agent.onStreamEvent((event) => {
      useAgentModeStore.getState().handleStreamEvent(event);
    });
  }, []);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = status === 'thinking' || status === 'executing';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeToolCalls.length]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isDisabled) return;

    setInput('');
    const typed = openEditorText(currentFilePath);
    const files = openEditorFiles();
    await sendMessage(trimmed, {
      ...(workspacePath ? { workspacePath } : {}),
      ...(currentFilePath ? { currentFilePath } : {}),
      ...(typed !== undefined ? { openFileContent: typed } : {}),
      ...(files.length > 0 ? { openFiles: files } : {}),
    });
    inputRef.current?.focus();
  }, [currentFilePath, input, isDisabled, sendMessage, workspacePath]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">AI Agent</h3>
        <div className="flex items-center gap-2">
          {isDisabled && (
            <button
              type="button"
              onClick={() => void cancel()}
              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={clearConversation}
            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Status */}
      <StatusIndicator status={status} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Start a conversation with the AI agent
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {activeToolCalls
          .filter((tc) => tc.status === 'pending')
          .map((tc) => (
            <ToolCallCard
              key={tc.id}
              toolCall={tc}
              onApprove={(id) => void approveToolCall(id)}
              onReject={(id) => void rejectToolCall(id)}
            />
          ))}
        {error && (
          <div className="mx-3 my-1 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 dark:border-gray-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent..."
            disabled={isDisabled}
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isDisabled || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
