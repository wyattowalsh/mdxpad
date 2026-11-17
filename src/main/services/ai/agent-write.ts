/**
 * Per-call approval gate for agent file writes.
 *
 * A write is created only after decide() accepts that exact call.
 *
 * @module src/main/services/ai/agent-write
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tool, jsonSchema } from 'ai';

import type { AgentStreamEvent } from '@shared/contracts/agent-schemas';
import { resolveWorkspaceFilePath, WorkspacePathError } from './agent-path';

const DEFAULT_APPROVAL_TIMEOUT_MS = 120_000;

type ApprovalSettle = (approved: boolean) => void;

export class WriteApprovalGate {
  private readonly pending = new Map<string, ApprovalSettle>();

  request(id: string, timeoutMs = DEFAULT_APPROVAL_TIMEOUT_MS): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve(false);
      }, timeoutMs);
      this.pending.set(id, (approved) => {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve(approved);
      });
    });
  }

  decide(id: string, approved: boolean): boolean {
    const settle = this.pending.get(id);
    if (!settle) {
      return false;
    }
    settle(approved);
    return true;
  }

  rejectAll(): void {
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const settle of waiting) {
      settle(false);
    }
  }
}

export interface ApprovedWriteInput {
  readonly workspacePath: string | undefined;
  readonly filePath: string;
  readonly content: string;
  readonly gate: WriteApprovalGate;
  readonly notify: (event: AgentStreamEvent) => void;
  readonly timeoutMs?: number;
  readonly createId?: () => string;
}

export async function executeApprovedWrite(input: ApprovedWriteInput): Promise<string> {
  if (!input.workspacePath) {
    throw new WorkspacePathError('Workspace path is required');
  }
  const resolved = resolveWorkspaceFilePath(input.workspacePath, input.filePath);
  const id = input.createId?.() ?? randomUUID();
  const decision = input.gate.request(id, input.timeoutMs);
  input.notify({
    type: 'tool-call',
    toolCall: {
      id,
      toolName: 'writeFile',
      args: { filePath: resolved, content: input.content },
      status: 'pending',
    },
  });
  input.notify({ type: 'status', status: 'waiting-for-approval' });

  const approved = await decision;
  if (!approved) {
    input.notify({ type: 'tool-result', toolCallId: id, result: 'Write rejected' });
    return 'Write rejected';
  }

  await fs.promises.mkdir(path.dirname(resolved), { recursive: true });
  const handle = await fs.promises.open(
    resolved,
    fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW,
    0o600
  );
  try {
    await handle.writeFile(input.content);
  } finally {
    await handle.close();
  }
  const result = `File written: ${resolved}`;
  input.notify({ type: 'tool-result', toolCallId: id, result });
  input.notify({ type: 'status', status: 'executing' });
  return result;
}

export function createWriteFileTool(
  workspacePath: string | undefined,
  gate: WriteApprovalGate,
  notify: (event: AgentStreamEvent) => void
) {
  return tool({
    description: 'Write content to a workspace file after the user approves that exact write',
    inputSchema: jsonSchema<{ filePath: string; content: string }>({
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Workspace-relative file path' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['filePath', 'content'],
    }),
    execute: ({ filePath, content }) =>
      executeApprovedWrite({ workspacePath, filePath, content, gate, notify }),
  });
}
