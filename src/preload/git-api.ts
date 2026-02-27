/**
 * Git Operations Preload API.
 * Provides git operation bridge functions for the renderer process.
 *
 * @module git-api
 */

import { ipcRenderer } from 'electron';
import { GitChannels } from '@shared/contracts/git-schemas';

export const gitApi = {
  status: (workingDir: string) => ipcRenderer.invoke(GitChannels.status, { workingDir }),

  add: (workingDir: string, files: string[]) =>
    ipcRenderer.invoke(GitChannels.add, { workingDir, files }),

  commit: (workingDir: string, message: string) =>
    ipcRenderer.invoke(GitChannels.commit, { workingDir, message }),

  log: (workingDir: string, maxCount?: number) =>
    ipcRenderer.invoke(GitChannels.log, { workingDir, maxCount }),

  diff: (workingDir: string, staged?: boolean) =>
    ipcRenderer.invoke(GitChannels.diff, { workingDir, staged }),

  branches: (workingDir: string) => ipcRenderer.invoke(GitChannels.branches, { workingDir }),

  checkout: (workingDir: string, branch: string) =>
    ipcRenderer.invoke(GitChannels.checkout, { workingDir, branch }),

  isRepo: (path: string) => ipcRenderer.invoke(GitChannels.isRepo, { path }),
};
