/// <reference types="vite/client" />

import type { MdxpadAPI } from '../preload/api';

declare global {
  interface ImportMetaEnv {
    readonly VITE_FEATURE_WORKSPACE?: string;
    readonly VITE_FEATURE_AI?: string;
    readonly VITE_FEATURE_EXPORT?: string;
    readonly VITE_FEATURE_AUTHORING?: string;
  }

  interface Window {
    /**
     * API exposed by preload script via contextBridge.
     * Provides safe access to Electron main process functionality.
     */
    mdxpad: MdxpadAPI;
    __MDXPAD_FEATURE_FLAGS__?: Partial<{
      workspace: boolean;
      ai: boolean;
      export: boolean;
      authoring: boolean;
    }>;
  }
}

export {};
