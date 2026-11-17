import { mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { AgentStreamEvent } from '@shared/contracts/agent-schemas';
import { executeApprovedWrite, WriteApprovalGate } from '../agent-write';
import { WorkspacePathError } from '../agent-path';

describe('executeApprovedWrite', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-write-'));
    tempDirs.push(dir);
    return dir;
  }

  function startWrite(root: string, filePath: string, content: string, gate: WriteApprovalGate) {
    let callId = '';
    const pending = executeApprovedWrite({
      workspacePath: root,
      filePath,
      content,
      gate,
      createId: () => 'write-1',
      notify: (event: AgentStreamEvent) => {
        if (event.type === 'tool-call') {
          callId = event.toolCall.id;
        }
      },
    });
    return { pending, callId: () => callId };
  }

  it('does not create a file when the write is rejected', async () => {
    const root = await makeTempDir();
    const gate = new WriteApprovalGate();
    const { pending, callId } = startWrite(root, 'nested/note.md', 'hello', gate);

    expect(callId()).toBe('write-1');
    expect(gate.decide(callId(), false)).toBe(true);
    await expect(pending).resolves.toBe('Write rejected');
    await expect(readFile(path.join(root, 'nested', 'note.md'), 'utf-8')).rejects.toThrow();
  });

  it('writes the approved content at the jailed path', async () => {
    const root = await makeTempDir();
    const gate = new WriteApprovalGate();
    const { pending, callId } = startWrite(root, 'nested/note.md', 'hello', gate);

    expect(gate.decide(callId(), true)).toBe(true);
    await expect(pending).resolves.toContain('nested');
    await expect(readFile(path.join(root, 'nested', 'note.md'), 'utf-8')).resolves.toBe('hello');
  });

  it('rejects an escaping path before asking for approval', async () => {
    const root = await makeTempDir();
    const gate = new WriteApprovalGate();
    const notify = (): void => {
      throw new Error('approval should not be requested');
    };

    await expect(
      executeApprovedWrite({
        workspacePath: root,
        filePath: '../secret.md',
        content: 'nope',
        gate,
        notify,
      })
    ).rejects.toThrow(WorkspacePathError);
    expect(gate.decide('write-1', true)).toBe(false);
  });
});
