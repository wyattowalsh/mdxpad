/**
 * Git handlers tests.
 * Tests IPC handler registration and Zod validation.
 */

import { mkdirSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { grantReadCapability, resetFileCapabilities } from '@main/ipc/document-capability';

// Mock git-service
vi.mock('./git-service', () => ({
  getStatus: vi.fn(),
  addFiles: vi.fn(),
  commit: vi.fn(),
  getLog: vi.fn(),
  getDiff: vi.fn(),
  getBranches: vi.fn(),
  checkout: vi.fn(),
  isGitRepo: vi.fn(),
  GitServiceError: class extends Error {
    code: string;
    constructor(msg: string, code = 'UNKNOWN') {
      super(msg);
      this.code = code;
    }
  },
}));

// Mock ipc-sender-authorization
vi.mock('@main/ipc/ipc-sender-authorization', () => ({
  assertAuthorizedIpcSender: vi.fn(),
}));

import { registerGitHandlers } from './git-handlers';
import * as gitService from './git-service';
import { GitChannels } from '@shared/contracts/git-schemas';

describe('git-handlers', () => {
  const repoDir = path.join(os.tmpdir(), 'mdxpad-git-handler-repo');
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const mockIpcMain = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
  };
  const mockWindow = {
    webContents: { id: 1, mainFrame: { routingId: 1 } },
  };
  const mockEvent = {
    sender: { id: 1 },
    senderFrame: { routingId: 1, url: 'http://localhost' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    mkdirSync(repoDir, { recursive: true });
    grantReadCapability(path.join(repoDir, 'note.md'));
    registerGitHandlers(
      mockIpcMain as unknown as Electron.IpcMain,
      mockWindow as unknown as Electron.BrowserWindow
    );
  });

  afterEach(() => {
    resetFileCapabilities();
    rmSync(repoDir, { recursive: true, force: true });
  });

  it('should register all git handlers', () => {
    const channels = Object.values(GitChannels);
    for (const channel of channels) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  describe('status handler', () => {
    it('should return ok result for valid request', async () => {
      const statusResult = {
        isClean: true,
        staged: [],
        modified: [],
        notAdded: [],
        created: [],
        deleted: [],
        conflicted: [],
        current: 'main',
        tracking: null,
      };
      vi.mocked(gitService.getStatus).mockResolvedValue(statusResult);

      const handler = handlers.get(GitChannels.status)!;
      const result = await handler(mockEvent, { workingDir: repoDir });
      expect(result).toEqual({ ok: true, value: statusResult });
    });

    it('does not run git in a folder the user has not opened', async () => {
      const handler = handlers.get(GitChannels.status)!;
      const result = await handler(mockEvent, { workingDir: '/other' });
      expect(result).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
      expect(gitService.getStatus).not.toHaveBeenCalled();
    });

    it('should return error for invalid request', async () => {
      const handler = handlers.get(GitChannels.status)!;
      const result = await handler(mockEvent, { workingDir: '' });
      expect(result).toHaveProperty('ok', false);
    });
  });

  describe('add handler', () => {
    it('should return success for valid add request', async () => {
      vi.mocked(gitService.addFiles).mockResolvedValue(undefined);
      const handler = handlers.get(GitChannels.add)!;
      const result = await handler(mockEvent, { workingDir: repoDir, files: ['file.ts'] });
      expect(result).toEqual({ ok: true, value: { success: true } });
    });
  });

  describe('commit handler', () => {
    it('should return hash for valid commit', async () => {
      vi.mocked(gitService.commit).mockResolvedValue({ hash: 'abc', message: 'msg' });
      const handler = handlers.get(GitChannels.commit)!;
      const result = await handler(mockEvent, { workingDir: repoDir, message: 'msg' });
      expect(result).toEqual({ ok: true, value: { hash: 'abc', message: 'msg' } });
    });
  });

  describe('isRepo handler', () => {
    it('should return isRepo result', async () => {
      vi.mocked(gitService.isGitRepo).mockResolvedValue(true);
      const handler = handlers.get(GitChannels.isRepo)!;
      const result = await handler(mockEvent, { path: repoDir });
      expect(result).toEqual({ ok: true, value: { isRepo: true } });
    });
  });
});
