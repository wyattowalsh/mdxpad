/// <reference types="vite/client" />

import type { MdxpadAPI } from '../preload/api';

declare global {
  interface Window {
    /**
     * API exposed by preload script via contextBridge.
     * Provides safe access to Electron main process functionality.
     */
    mdxpad: MdxpadAPI;
  }
}

export {};
