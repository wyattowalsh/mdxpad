import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { BrowserWindow } from 'electron';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

const mockAddLink = vi.fn();
const mockGetBacklinks = vi.fn();

vi.mock('@main/services/workspace-service', () => ({
  WorkspaceService: vi.fn(() => ({
    addLink: mockAddLink,
    getBacklinks: mockGetBacklinks,
  })),
}));

import { ipcMain } from 'electron';
import { registerLinkHandlers, WORKSPACE_LINK_CHANNELS } from '@main/ipc/link-handlers';

const mockIpcMain = ipcMain as unknown as { handle: Mock };

function createWindow(): BrowserWindow {
  return {
    webContents: {
      id: 1,
      mainFrame: { routingId: 10 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  const senderId = overrides?.senderId ?? window.webContents.id;
  const senderFrameRoutingId =
    overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: senderFrameRoutingId },
  };
}

describe('link-handlers', () => {
  let registeredHandlers: Map<string, (event: unknown, args?: unknown) => Promise<unknown>>;
  let mockWindow: BrowserWindow;
  let authorizedInvokeEvent: ReturnType<typeof createInvokeEvent>;

  const validAddLinkRequest = {
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    link: {
      sourceDocumentId: '223e4567-e89b-12d3-a456-426614174000',
      sourcePath: '/workspace/notes/source.mdx',
      targetDocumentId: '323e4567-e89b-12d3-a456-426614174000',
      targetPath: '/workspace/notes/target.mdx',
      targetAnchor: 'intro',
      relation: 'references' as const,
      position: {
        line: 0,
        column: 0,
        offset: 0,
      },
    },
  };

  const validGetBacklinksRequest = {
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    documentId: '323e4567-e89b-12d3-a456-426614174000',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    registeredHandlers = new Map();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    );

    mockWindow = createWindow();
    authorizedInvokeEvent = createInvokeEvent(mockWindow);

    registerLinkHandlers(ipcMain, mockWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers addLink and getBacklinks handlers', () => {
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_LINK_CHANNELS.addLink,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      WORKSPACE_LINK_CHANNELS.getBacklinks,
      expect.any(Function)
    );
  });

  it('rejects unauthorized sender for addLink', () => {
    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.addLink);
    const unauthorizedEvent = createInvokeEvent(mockWindow, {
      senderId: mockWindow.webContents.id + 1,
    });

    expect(() => handler!(unauthorizedEvent, validAddLinkRequest)).toThrow(
      'Unauthorized IPC sender'
    );
    expect(mockAddLink).not.toHaveBeenCalled();
  });

  it('adds a link with validated request/response', async () => {
    mockAddLink.mockResolvedValue({
      ok: true,
      value: validAddLinkRequest.link,
    });

    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.addLink);
    const result = await handler!(authorizedInvokeEvent, validAddLinkRequest);

    expect(mockAddLink).toHaveBeenCalledWith(validAddLinkRequest);
    expect(result).toEqual({
      ok: true,
      value: validAddLinkRequest.link,
    });
  });

  it('rejects invalid addLink request payload', async () => {
    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.addLink);

    await expect(handler!(authorizedInvokeEvent, { workspaceId: 'bad-id' })).rejects.toThrow(
      'Validation failed'
    );
    expect(mockAddLink).not.toHaveBeenCalled();
  });

  it('rejects invalid addLink response payload', async () => {
    mockAddLink.mockResolvedValue({
      ok: true,
      value: {
        ...validAddLinkRequest.link,
        relation: 'invalid-relation',
      },
    });

    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.addLink);

    await expect(handler!(authorizedInvokeEvent, validAddLinkRequest)).rejects.toThrow();
  });

  it('gets backlinks with validated request/response', async () => {
    mockGetBacklinks.mockResolvedValue({
      ok: true,
      value: [validAddLinkRequest.link],
    });

    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.getBacklinks);
    const result = await handler!(authorizedInvokeEvent, validGetBacklinksRequest);

    expect(mockGetBacklinks).toHaveBeenCalledWith(validGetBacklinksRequest);
    expect(result).toEqual({
      ok: true,
      value: [validAddLinkRequest.link],
    });
  });

  it('rejects invalid getBacklinks request payload', async () => {
    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.getBacklinks);

    await expect(handler!(authorizedInvokeEvent, { workspaceId: 'bad-id' })).rejects.toThrow(
      'Validation failed'
    );
    expect(mockGetBacklinks).not.toHaveBeenCalled();
  });

  it('rejects invalid getBacklinks response payload', async () => {
    mockGetBacklinks.mockResolvedValue({
      ok: true,
      value: [
        {
          ...validAddLinkRequest.link,
          relation: 'invalid-relation',
        },
      ],
    });

    const handler = registeredHandlers.get(WORKSPACE_LINK_CHANNELS.getBacklinks);

    await expect(handler!(authorizedInvokeEvent, validGetBacklinksRequest)).rejects.toThrow();
  });
});
