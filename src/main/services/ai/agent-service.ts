/**
 * AI Agent Service
 *
 * Backend service for AI agent orchestration using Vercel AI SDK
 * streamText() with tool definitions. Manages conversation state,
 * tool execution, and streaming response forwarding to the renderer.
 *
 * @module src/main/services/ai/agent-service
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { streamText, tool, jsonSchema, stepCountIs } from 'ai';
import type { BrowserWindow } from 'electron';

import type { IAIService } from './ai-types';
import { AgentChannels } from '@shared/contracts/agent-schemas';
import type {
  AgentMessage,
  AgentToolCall,
  AgentStreamEvent,
  AgentStatus,
} from '@shared/contracts/agent-schemas';

// =============================================================================
// TYPES
// =============================================================================

interface ConversationState {
  messages: AgentMessage[];
  status: AgentStatus;
  pendingToolCalls: Map<string, AgentToolCall>;
  abortController: AbortController | null;
}

export class WorkspacePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspacePathError';
  }
}

function existingAncestor(target: string): string {
  let current = path.resolve(target);
  let found: string | undefined;
  while (found === undefined) {
    try {
      found = fs.realpathSync(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        found = path.resolve(target);
      } else {
        current = parent;
      }
    }
  }
  return found;
}

/**
 * Resolve a requested path inside a workspace root.
 * Rejects absolute escapes and symlink ancestors that leave the root.
 */
export function resolveWorkspaceFilePath(
  workspaceRoot: string,
  requestedPath: string,
  options?: { readonly allowRoot?: boolean }
): string {
  if (workspaceRoot.trim().length === 0) {
    throw new WorkspacePathError('Workspace path is required');
  }

  const root = existingAncestor(workspaceRoot);
  const candidate = path.resolve(root, requestedPath);
  const relative = path.relative(root, candidate);
  const rootAllowed = options?.allowRoot === true && relative.length === 0;
  if (
    (!rootAllowed && relative.length === 0) ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new WorkspacePathError('Path is outside the workspace');
  }
  if (rootAllowed) {
    return root;
  }

  const resolvedParent = existingAncestor(path.dirname(candidate));
  const resolved = path.join(resolvedParent, path.basename(candidate));
  const resolvedRelative = path.relative(root, resolved);
  if (
    resolvedRelative.length === 0 ||
    resolvedRelative.startsWith('..') ||
    path.isAbsolute(resolvedRelative)
  ) {
    throw new WorkspacePathError('Path is outside the workspace');
  }

  return resolved;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

function createReadFileTool(workspacePath: string | undefined) {
  return tool({
    description: 'Read the contents of a file at the given path',
    inputSchema: jsonSchema<{ filePath: string }>({
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Absolute or workspace-relative file path' },
      },
      required: ['filePath'],
    }),
    execute: async ({ filePath }) => {
      if (!workspacePath) {
        throw new WorkspacePathError('Workspace path is required');
      }
      const resolved = resolveWorkspaceFilePath(workspacePath, filePath);
      return fs.promises.readFile(resolved, 'utf-8');
    },
  });
}

function createWriteFileTool(workspacePath: string | undefined, writesApproved: () => boolean) {
  return tool({
    description: 'Write content to a file at the given path',
    inputSchema: jsonSchema<{ filePath: string; content: string }>({
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['filePath', 'content'],
    }),
    execute: async ({ filePath, content }) => {
      if (!writesApproved()) {
        throw new Error('Write approval is required before the agent can write files');
      }
      if (!workspacePath) {
        throw new WorkspacePathError('Workspace path is required');
      }
      const resolved = resolveWorkspaceFilePath(workspacePath, filePath);
      const dir = path.dirname(resolved);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(resolved, content, 'utf-8');
      return `File written: ${resolved}`;
    },
  });
}

function createSearchFilesTool(workspacePath: string | undefined) {
  return tool({
    description: 'Search for files matching a glob pattern in the workspace',
    inputSchema: jsonSchema<{ query: string }>({
      type: 'object',
      properties: { query: { type: 'string', description: 'Search term or glob pattern' } },
      required: ['query'],
    }),
    execute: async ({ query }) => {
      if (!workspacePath) return 'No workspace path set';
      const root = resolveWorkspaceFilePath(workspacePath, '.', { allowRoot: true });
      const results: string[] = [];

      async function walk(dir: string): Promise<void> {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await walk(full);
            }
          } else if (entry.name.includes(query)) {
            results.push(full);
          }
        }
      }

      await walk(root);
      return results.length > 0 ? results.join('\n') : 'No files found';
    },
  });
}

function createListDirectoryTool(workspacePath: string | undefined) {
  return tool({
    description: 'List contents of a directory',
    inputSchema: jsonSchema<{ dirPath: string }>({
      type: 'object',
      properties: { dirPath: { type: 'string', description: 'Directory path to list' } },
      required: ['dirPath'],
    }),
    execute: async ({ dirPath }) => {
      if (!workspacePath) {
        throw new WorkspacePathError('Workspace path is required');
      }
      const resolved = resolveWorkspaceFilePath(workspacePath, dirPath, { allowRoot: true });
      const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
      return entries.map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`).join('\n');
    },
  });
}

function createAgentTools(workspacePath: string | undefined, writesApproved: () => boolean) {
  return {
    readFile: createReadFileTool(workspacePath),
    writeFile: createWriteFileTool(workspacePath, writesApproved),
    searchFiles: createSearchFilesTool(workspacePath),
    listDirectory: createListDirectoryTool(workspacePath),
  };
}

// =============================================================================
// AGENT SERVICE
// =============================================================================

export class AgentService {
  private conversations = new Map<string, ConversationState>();
  private window: BrowserWindow | null = null;
  private writesApproved = false;

  constructor(private readonly aiService: IAIService) {}

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  /**
   * Allow file writes for this process. Nothing in the IPC layer calls this.
   * Agent mode stays unable to write until a future approval UI does.
   */
  approveWrites(): void {
    this.writesApproved = true;
  }

  async sendMessage(
    message: string,
    workspacePath?: string,
    currentFilePath?: string
  ): Promise<void> {
    const state = this.getOrCreateConversation();
    this.addUserMessage(state, message);
    state.status = 'thinking';
    this.emitEvent({ type: 'status', status: 'thinking' });

    const abortController = new AbortController();
    state.abortController = abortController;

    try {
      const fullText = await this.runStreamResponse(
        state,
        workspacePath,
        currentFilePath,
        abortController
      );
      this.addAssistantMessage(state, fullText);
    } catch (error) {
      this.handleStreamError(state, error, abortController);
    } finally {
      state.abortController = null;
    }
  }

  cancel(): void {
    const state = this.conversations.get('default');
    if (state?.abortController) {
      state.abortController.abort();
    }
  }

  clear(): void {
    this.conversations.delete('default');
  }

  getMessages(): AgentMessage[] {
    return this.conversations.get('default')?.messages ?? [];
  }

  getStatus(): AgentStatus {
    return this.conversations.get('default')?.status ?? 'idle';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getOrCreateConversation(): ConversationState {
    let state = this.conversations.get('default');
    if (!state) {
      state = {
        messages: [],
        status: 'idle',
        pendingToolCalls: new Map<string, AgentToolCall>(),
        abortController: null,
      };
      this.conversations.set('default', state);
    }
    return state;
  }

  private addUserMessage(state: ConversationState, message: string): void {
    const userMessage: AgentMessage = {
      id: randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMessage);
    this.emitEvent({ type: 'message', message: userMessage });
  }

  private async runStreamResponse(
    state: ConversationState,
    workspacePath: string | undefined,
    currentFilePath: string | undefined,
    abortController: AbortController
  ): Promise<string> {
    const model = this.aiService.getActiveModel();
    if (!model) throw new Error('No active AI model configured');

    const tools = createAgentTools(workspacePath, () => this.writesApproved);
    const systemPrompt = buildSystemPrompt(workspacePath, currentFilePath);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: state.messages.map((m) => ({
        role: m.role === 'tool' ? ('assistant' as const) : m.role,
        content: m.content,
      })),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: abortController.signal,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }
    return fullText;
  }

  private addAssistantMessage(state: ConversationState, fullText: string): void {
    const assistantMessage: AgentMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: fullText,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(assistantMessage);
    this.emitEvent({ type: 'message', message: assistantMessage });
    state.status = 'idle';
    this.emitEvent({ type: 'status', status: 'idle' });
    this.emitEvent({ type: 'done' });
  }

  private handleStreamError(
    state: ConversationState,
    error: unknown,
    abortController: AbortController
  ): void {
    if (abortController.signal.aborted) {
      state.status = 'idle';
      this.emitEvent({ type: 'status', status: 'idle' });
      return;
    }
    state.status = 'error';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.emitEvent({
      type: 'error',
      error: { code: 'AGENT_ERROR', message: errorMessage },
    });
  }

  private emitEvent(event: AgentStreamEvent): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(AgentChannels.STREAM_EVENT, event);
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function buildSystemPrompt(
  workspacePath: string | undefined,
  currentFilePath: string | undefined
): string {
  const parts = [
    'You are an AI assistant integrated into MDXPad, a Markdown/MDX editor.',
    'You can read and write files, search the workspace, and help with editing tasks.',
    'Be concise and helpful. When editing files, explain what changes you are making.',
  ];

  if (workspacePath) {
    parts.push(`Current workspace: ${workspacePath}`);
  }
  if (currentFilePath) {
    parts.push(`Currently open file: ${currentFilePath}`);
  }

  return parts.join('\n');
}
