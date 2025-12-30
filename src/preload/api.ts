/**
 * MdxpadAPI - Interface exposed to renderer via contextBridge.
 * This is the ONLY way renderer can communicate with main process.
 */

import type { SecurityInfo } from '@shared/lib/ipc';

/**
 * API surface exposed to renderer process via contextBridge.
 *
 * @security All methods use invoke/handle pattern.
 * @security All responses should be validated before use.
 */
export interface MdxpadAPI {
  /**
   * Get application version.
   * @returns Semantic version string (e.g., "0.1.0")
   */
  getVersion(): Promise<string>;

  /**
   * Get current security configuration.
   * Used by verify-security script and debug info.
   * @returns Security settings object
   */
  getSecurityInfo(): Promise<SecurityInfo>;

  /**
   * Platform information.
   */
  platform: {
    os: 'darwin'; // macOS only per constitution
    arch: 'arm64' | 'x64';
  };
}
