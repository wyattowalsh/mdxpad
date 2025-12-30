/**
 * Preload script - exposes safe APIs to renderer via contextBridge.
 * This is the ONLY bridge between main and renderer processes.
 *
 * @security Uses contextBridge to prevent prototype pollution
 * @security Uses invoke/handle pattern, never send/on
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/lib/ipc';
import type { MdxpadAPI } from './api';

/**
 * Detect architecture at runtime.
 * Note: In sandboxed preload, process.arch is available but may vary by Electron version.
 * We wrap in try-catch for safety.
 */
function getArch(): 'arm64' | 'x64' {
  try {
    return process.arch === 'arm64' ? 'arm64' : 'x64';
  } catch {
    // Default to x64 if process.arch is unavailable
    return 'x64';
  }
}

/**
 * API implementation exposed to renderer.
 */
const api: MdxpadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.getVersion),
  getSecurityInfo: () => ipcRenderer.invoke(IPC_CHANNELS.app.getSecurityInfo),
  platform: {
    os: 'darwin',
    arch: getArch(),
  },
};

// Expose API to renderer via contextBridge
contextBridge.exposeInMainWorld('mdxpad', api);

console.log('mdxpad preload script loaded');
