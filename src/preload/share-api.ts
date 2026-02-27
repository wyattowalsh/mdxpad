/**
 * Share & Publish Preload API — Exposes sharing/publishing operations to renderer.
 * Uses ipcRenderer.invoke for request-response and ipcRenderer.on for events.
 *
 * @security Uses invoke/handle pattern for all operations.
 * @security All payloads validated with zod on both ends per Constitution III.3.
 * @module preload/share-api
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';
import {
  ShareChannels,
  CreateShareLinkRequestSchema,
  CreateShareLinkResponseSchema,
  RevokeShareLinkRequestSchema,
  RevokeShareLinkResponseSchema,
  GetShareLinksRequestSchema,
  GetShareLinksResponseSchema,
  PublishRequestSchema,
  PublishResponseSchema,
  PublishProgressSchema,
  type CreateShareLinkRequest,
  type CreateShareLinkResponse,
  type RevokeShareLinkRequest,
  type RevokeShareLinkResponse,
  type GetShareLinksRequest,
  type GetShareLinksResponse,
  type PublishRequest,
  type PublishResponse,
  type PublishProgress,
} from '@shared/contracts/share-schemas';

// ============================================================================
// Validated Invoke Helper
// ============================================================================

/**
 * Performs a validated share IPC invoke with schema validation.
 */
async function validatedShareInvoke<TRes>(
  channel: string,
  responseSchema: z.ZodType<TRes>,
  args?: unknown
): Promise<TRes> {
  const response: unknown = await ipcRenderer.invoke(channel, args);
  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(`Share response validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
}

// ============================================================================
// Share API Interface
// ============================================================================

/**
 * Share & Publish API exposed to renderer via contextBridge.
 */
export interface ShareApi {
  /**
   * Create a new share link for a document.
   * @param request - Share link configuration
   * @returns Created share link
   */
  createLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse>;

  /**
   * Revoke an existing share link.
   * @param request - Link ID to revoke
   * @returns Success indicator
   */
  revokeLink(request: RevokeShareLinkRequest): Promise<RevokeShareLinkResponse>;

  /**
   * Get all share links, optionally filtered by document.
   * @param request - Optional document ID filter
   * @returns Array of share links
   */
  getLinks(request?: GetShareLinksRequest): Promise<GetShareLinksResponse>;

  /**
   * Publish files as a static site.
   * @param request - Publish configuration
   * @returns Publish result with output details
   */
  publish(request: PublishRequest): Promise<PublishResponse>;

  /**
   * Subscribe to publish progress events.
   * @param callback - Called when publish progress updates
   * @returns Unsubscribe function
   */
  onPublishProgress(callback: (progress: PublishProgress) => void): () => void;
}

// ============================================================================
// Event Listener Registries
// ============================================================================

const publishProgressListeners = new Set<(progress: PublishProgress) => void>();

// Set up IPC event listener for publish progress
ipcRenderer.on(ShareChannels.PUBLISH_PROGRESS, (_event, data: unknown) => {
  const validated = PublishProgressSchema.safeParse(data);
  if (validated.success) {
    for (const listener of publishProgressListeners) {
      listener(validated.data);
    }
  } else {
    console.error('[ShareAPI] Invalid publish progress data:', validated.error.message);
  }
});

// ============================================================================
// Share API Implementation
// ============================================================================

/**
 * Share & Publish API implementation for preload exposure.
 */
export const shareApi: ShareApi = {
  createLink: async (request) => {
    const reqParsed = CreateShareLinkRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Create link request validation failed: ${reqParsed.error.message}`);
    }

    return validatedShareInvoke(
      ShareChannels.CREATE_LINK,
      CreateShareLinkResponseSchema,
      reqParsed.data
    );
  },

  revokeLink: async (request) => {
    const reqParsed = RevokeShareLinkRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Revoke link request validation failed: ${reqParsed.error.message}`);
    }

    return validatedShareInvoke(
      ShareChannels.REVOKE_LINK,
      RevokeShareLinkResponseSchema,
      reqParsed.data
    );
  },

  getLinks: async (request) => {
    const args = request ?? {};
    const reqParsed = GetShareLinksRequestSchema.safeParse(args);
    if (!reqParsed.success) {
      throw new Error(`Get links request validation failed: ${reqParsed.error.message}`);
    }

    return validatedShareInvoke(
      ShareChannels.GET_LINKS,
      GetShareLinksResponseSchema,
      reqParsed.data
    );
  },

  publish: async (request) => {
    const reqParsed = PublishRequestSchema.safeParse(request);
    if (!reqParsed.success) {
      throw new Error(`Publish request validation failed: ${reqParsed.error.message}`);
    }

    return validatedShareInvoke(
      ShareChannels.PUBLISH,
      PublishResponseSchema,
      reqParsed.data
    );
  },

  onPublishProgress: (callback) => {
    publishProgressListeners.add(callback);
    return () => {
      publishProgressListeners.delete(callback);
    };
  },
};
