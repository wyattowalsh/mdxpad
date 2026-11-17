/**
 * Git IPC handlers.
 * Registers IPC handlers for all git operations.
 *
 * @module git-handlers
 */

import type { IpcMain, BrowserWindow } from 'electron';
import {
  GitChannels,
  GitStatusRequestSchema,
  GitAddRequestSchema,
  GitCommitRequestSchema,
  GitLogRequestSchema,
  GitDiffRequestSchema,
  GitBranchesRequestSchema,
  GitCheckoutRequestSchema,
  GitIsRepoRequestSchema,
} from '@shared/contracts/git-schemas';
import { assertAuthorizedIpcSender } from '@main/ipc/ipc-sender-authorization';
import { trustedDirectoryError } from '@main/ipc/trusted-directory';
import * as gitService from './git-service';
import { GitServiceError } from './git-service';

function untrustedDirectoryResult(
  directory: string
): { ok: false; error: { code: 'PERMISSION_DENIED'; message: string } } | null {
  const message = trustedDirectoryError(directory);
  if (message === null) {
    return null;
  }
  return { ok: false, error: { code: 'PERMISSION_DENIED', message } };
}

function handleGitError(error: unknown): { ok: false; error: { code: string; message: string } } {
  if (error instanceof GitServiceError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  return {
    ok: false,
    error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : String(error) },
  };
}

function registerCoreGitHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(GitChannels.status, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.status);
    try {
      const { workingDir } = GitStatusRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.getStatus(workingDir) };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.add, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.add);
    try {
      const { workingDir, files } = GitAddRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      await gitService.addFiles(workingDir, files);
      return { ok: true, value: { success: true } };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.commit, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.commit);
    try {
      const { workingDir, message } = GitCommitRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.commit(workingDir, message) };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.log, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.log);
    try {
      const { workingDir, maxCount } = GitLogRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.getLog(workingDir, maxCount) };
    } catch (error) {
      return handleGitError(error);
    }
  });
}

function registerBranchGitHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  ipcMain.handle(GitChannels.diff, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.diff);
    try {
      const { workingDir, staged } = GitDiffRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.getDiff(workingDir, staged) };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.branches, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.branches);
    try {
      const { workingDir } = GitBranchesRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.getBranches(workingDir) };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.checkout, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.checkout);
    try {
      const { workingDir, branch } = GitCheckoutRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(workingDir);
      if (denied) return denied;
      return { ok: true, value: await gitService.checkout(workingDir, branch) };
    } catch (error) {
      return handleGitError(error);
    }
  });

  ipcMain.handle(GitChannels.isRepo, async (event, args) => {
    assertAuthorizedIpcSender(event, window, GitChannels.isRepo);
    try {
      const { path } = GitIsRepoRequestSchema.parse(args);
      const denied = untrustedDirectoryResult(path);
      if (denied) return denied;
      const isRepo = await gitService.isGitRepo(path);
      return { ok: true, value: { isRepo } };
    } catch (error) {
      return handleGitError(error);
    }
  });
}

export function registerGitHandlers(ipcMain: IpcMain, window: BrowserWindow): void {
  registerCoreGitHandlers(ipcMain, window);
  registerBranchGitHandlers(ipcMain, window);
  console.log('[GitHandlers] All git handlers registered');
}
