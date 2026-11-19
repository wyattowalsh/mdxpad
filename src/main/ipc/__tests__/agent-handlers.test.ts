import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { AgentChannels } from '@shared/contracts/agent-schemas';
import { AgentService } from '@main/services/ai/agent-service';
import { grantReadCapability, resetFileCapabilities } from '../document-capability';
import { IpcSenderAuthorizationError } from '../ipc-sender-authorization';
import { registerAgentHandlers } from '../agent-handlers';

const { handlers, handle } = vi.hoisted(() => {
  const registered: Record<string, (event: IpcMainInvokeEvent, request?: unknown) => unknown> = {};
  return {
    handlers: registered,
    handle: (
      channel: string,
      handler: (event: IpcMainInvokeEvent, request?: unknown) => unknown
    ) => {
      registered[channel] = handler;
    },
  };
});

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

function createWindow(): BrowserWindow {
  return {
    isDestroyed: () => false,
    webContents: {
      id: 7,
      send: vi.fn(),
      mainFrame: { routingId: 11 },
    },
  } as unknown as BrowserWindow;
}

function createEvent(window: BrowserWindow, senderId = 7): IpcMainInvokeEvent {
  return {
    sender: { id: senderId },
    senderFrame: { routingId: window.webContents.mainFrame.routingId },
  } as unknown as IpcMainInvokeEvent;
}

describe('registerAgentHandlers', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }
    resetFileCapabilities();
  });

  it('rejects an approval from a different sender', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    service.setWindow(window);
    registerAgentHandlers(service, window);

    const approve = handlers[AgentChannels.APPROVE_TOOL];
    expect(approve).toBeTypeOf('function');
    expect(() =>
      approve?.(createEvent(window, 99), { toolCallId: 'missing', approved: true })
    ).toThrow(IpcSenderAuthorizationError);
  });

  it('ignores a renderer workspace path unless the open file was granted', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    const sendMessage = vi.spyOn(service, 'sendMessage').mockResolvedValue(undefined);
    service.setWindow(window);
    registerAgentHandlers(service, window);
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-grant-'));
    tempDirs.push(root);
    const file = path.join(root, 'note.md');
    await writeFile(file, 'hi');
    const send = handlers[AgentChannels.SEND_MESSAGE];

    await send?.(createEvent(window), {
      message: 'edit',
      workspacePath: '/',
      currentFilePath: file,
    });
    expect(sendMessage).toHaveBeenCalledWith('edit', undefined, undefined);

    grantReadCapability(file);
    await send?.(createEvent(window), {
      message: 'edit',
      workspacePath: '/',
      currentFilePath: file,
    });
    const canonical = await realpath(file);
    expect(sendMessage).toHaveBeenLastCalledWith('edit', path.dirname(canonical), canonical);
  });

  it('passes editor text only after the open file is granted', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    const sendMessage = vi.spyOn(service, 'sendMessage').mockResolvedValue(undefined);
    service.setWindow(window);
    registerAgentHandlers(service, window);
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-buffer-'));
    tempDirs.push(root);
    const file = path.join(root, 'note.md');
    await writeFile(file, 'disk');
    const send = handlers[AgentChannels.SEND_MESSAGE];

    await send?.(createEvent(window), {
      message: 'edit',
      currentFilePath: file,
      openFileContent: 'typed!',
    });
    expect(sendMessage).toHaveBeenCalledWith('edit', undefined, undefined);

    grantReadCapability(file);
    await send?.(createEvent(window), {
      message: 'edit',
      currentFilePath: file,
      openFileContent: 'typed!',
    });
    const canonical = await realpath(file);
    expect(sendMessage).toHaveBeenLastCalledWith('edit', path.dirname(canonical), canonical, [
      { path: canonical, content: 'typed!' },
    ]);
  });

  it('passes editor text for another opened file and drops one that was not opened', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    const sendMessage = vi.spyOn(service, 'sendMessage').mockResolvedValue(undefined);
    service.setWindow(window);
    registerAgentHandlers(service, window);
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-tabs-'));
    tempDirs.push(root);
    const current = path.join(root, 'current.md');
    const other = path.join(root, 'other.md');
    const outside = path.join(root, '..', 'outside.md');
    await writeFile(current, 'disk');
    await writeFile(other, 'disk other');
    grantReadCapability(current);
    grantReadCapability(other);
    const send = handlers[AgentChannels.SEND_MESSAGE];

    await send?.(createEvent(window), {
      message: 'edit',
      currentFilePath: current,
      openFiles: [
        { path: other, content: 'other draft' },
        { path: outside, content: 'hidden' },
      ],
    });

    const canonicalCurrent = await realpath(current);
    const canonicalOther = await realpath(other);
    expect(sendMessage).toHaveBeenCalledWith(
      'edit',
      path.dirname(canonicalCurrent),
      canonicalCurrent,
      [{ path: canonicalOther, content: 'other draft' }]
    );
  });

  it('does not write when the approval id is unknown', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    service.setWindow(window);
    registerAgentHandlers(service, window);

    const approve = handlers[AgentChannels.APPROVE_TOOL];
    await expect(
      approve?.(createEvent(window), { toolCallId: 'missing', approved: true })
    ).resolves.toMatchObject({ success: false, error: { code: 'UNKNOWN_TOOL_CALL' } });
  });

  it('writes only after an authorized approval', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    service.setWindow(window);
    registerAgentHandlers(service, window);
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-ipc-'));
    tempDirs.push(root);
    const pending = service.beginWrite(root, 'note.md', 'approved');
    const sent = vi.mocked(window.webContents.send).mock.calls.find((call) => {
      const event = call[1] as { type?: string; toolCall?: { id?: string } };
      return event.type === 'tool-call';
    });
    const toolCallId = (sent?.[1] as { toolCall: { id: string } }).toolCall.id;
    const approve = handlers[AgentChannels.APPROVE_TOOL];

    await expect(
      approve?.(createEvent(window), { toolCallId, approved: true })
    ).resolves.toMatchObject({ success: true });
    await expect(pending).resolves.toContain('note.md');
    await expect(readFile(path.join(root, 'note.md'), 'utf-8')).resolves.toBe('approved');
  });

  it('leaves the file unwritten when the user rejects the write', async () => {
    const window = createWindow();
    const service = new AgentService({} as never);
    service.setWindow(window);
    registerAgentHandlers(service, window);
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-agent-ipc-'));
    tempDirs.push(root);
    const pending = service.beginWrite(root, 'note.md', 'nope');
    const sent = vi.mocked(window.webContents.send).mock.calls.find((call) => {
      const event = call[1] as { type?: string };
      return event.type === 'tool-call';
    });
    const toolCallId = (sent?.[1] as { toolCall: { id: string } }).toolCall.id;
    const approve = handlers[AgentChannels.APPROVE_TOOL];

    await expect(
      approve?.(createEvent(window), { toolCallId, approved: false })
    ).resolves.toMatchObject({ success: true });
    await expect(pending).resolves.toBe('Write rejected');
    await expect(readFile(path.join(root, 'note.md'), 'utf-8')).rejects.toThrow();
  });
});
