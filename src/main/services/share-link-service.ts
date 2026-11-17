/**
 * Share Link Service — Manages shareable URLs with unique tokens.
 * Generates, stores, and validates share links for documents.
 *
 * @module main/services/share-link-service
 */

import { randomUUID, randomBytes } from 'node:crypto';
import type { ShareLink, ShareAccessMode } from '@shared/contracts/share-schemas';

// ============================================================================
// Types
// ============================================================================

/** Options for creating a share link */
export interface CreateShareLinkOptions {
  readonly docId: string;
  readonly accessMode: ShareAccessMode;
  readonly expiresInMs: number | null;
  readonly content?: string;
}

export interface ShareReadResult {
  readonly docId: string;
  readonly accessMode: ShareAccessMode;
  readonly content: string;
}

/** Options for the share link service */
export interface ShareLinkServiceOptions {
  readonly baseUrl?: string;
  readonly tokenLength?: number;
  readonly maxLinksPerDoc?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BASE_URL = 'mdxpad://share';
const DEFAULT_TOKEN_LENGTH = 32;
const DEFAULT_MAX_LINKS_PER_DOC = 10;

// ============================================================================
// Share Link Service
// ============================================================================

/**
 * Service for managing shareable document links.
 * Generates unique tokens, manages expiration, and handles link lifecycle.
 */
export class ShareLinkService {
  private readonly links = new Map<string, ShareLink>();
  private readonly contents = new Map<string, string>();
  private readonly baseUrl: string;
  private readonly tokenLength: number;
  private readonly maxLinksPerDoc: number;

  constructor(options: ShareLinkServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.tokenLength = options.tokenLength ?? DEFAULT_TOKEN_LENGTH;
    this.maxLinksPerDoc = options.maxLinksPerDoc ?? DEFAULT_MAX_LINKS_PER_DOC;
  }

  /**
   * Create a new share link for a document.
   * @param options - Configuration for the share link
   * @returns The created share link
   * @throws Error if max links per document exceeded
   */
  createLink(options: CreateShareLinkOptions): ShareLink {
    const docLinks = this.getLinksByDocId(options.docId);
    if (docLinks.length >= this.maxLinksPerDoc) {
      throw new Error(
        `Maximum share links (${this.maxLinksPerDoc}) reached for document ${options.docId}`
      );
    }

    const id = randomUUID();
    const token = randomBytes(this.tokenLength).toString('hex');
    const now = Date.now();
    const expiresAt = options.expiresInMs !== null ? now + options.expiresInMs : null;

    const link: ShareLink = {
      id,
      token,
      docId: options.docId,
      url: `${this.baseUrl}/${token}`,
      accessMode: options.accessMode,
      createdAt: now,
      expiresAt,
      isActive: true,
    };

    this.links.set(id, link);
    if (options.content !== undefined) {
      this.contents.set(id, options.content);
    }
    console.log(`[ShareLinkService] Created share link ${id} for doc ${options.docId}`);

    return link;
  }

  /**
   * Revoke (deactivate) a share link.
   * @param id - Share link ID to revoke
   * @returns true if the link was found and revoked
   */
  revokeLink(id: string): boolean {
    const link = this.links.get(id);
    if (!link) {
      return false;
    }

    const revokedLink: ShareLink = {
      ...link,
      isActive: false,
    };
    this.links.set(id, revokedLink);

    console.log(`[ShareLinkService] Revoked share link ${id}`);
    return true;
  }

  /**
   * Get a share link by ID.
   * @param id - Share link ID
   * @returns The share link or null
   */
  getLink(id: string): ShareLink | null {
    return this.links.get(id) ?? null;
  }

  /**
   * Validate a share token and return the associated link.
   * Checks that the link is active and not expired.
   * @param token - The share token to validate
   * @returns The valid share link or null
   */
  validateToken(token: string): ShareLink | null {
    for (const link of this.links.values()) {
      if (link.token === token) {
        if (!link.isActive) {
          return null;
        }

        if (link.expiresAt !== null && Date.now() > link.expiresAt) {
          // Auto-deactivate expired links
          const expiredLink: ShareLink = { ...link, isActive: false };
          this.links.set(link.id, expiredLink);
          return null;
        }

        return link;
      }
    }

    return null;
  }

  /**
   * Read owner-supplied document text for a token.
   * Unknown, revoked, and expired tokens all return null.
   * The document id is never treated as a filesystem path.
   */
  readByToken(token: string): ShareReadResult | null {
    const link = this.validateToken(token);
    if (!link) {
      return null;
    }

    const content = this.contents.get(link.id);
    if (content === undefined) {
      return null;
    }

    return {
      docId: link.docId,
      accessMode: link.accessMode,
      content,
    };
  }

  /**
   * Get all share links, optionally filtered by document ID.
   * @param docId - Optional document ID filter
   * @returns Array of share links
   */
  getLinks(docId?: string): readonly ShareLink[] {
    if (docId !== undefined) {
      return this.getLinksByDocId(docId);
    }

    return Array.from(this.links.values());
  }

  /**
   * Remove expired and inactive links.
   * @returns Number of links removed
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, link] of this.links) {
      if (!link.isActive || (link.expiresAt !== null && now > link.expiresAt)) {
        this.links.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[ShareLinkService] Cleaned up ${removed} expired/inactive links`);
    }

    return removed;
  }

  /**
   * Get total number of active links.
   */
  getActiveLinkCount(): number {
    let count = 0;
    for (const link of this.links.values()) {
      if (link.isActive) {
        count++;
      }
    }
    return count;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getLinksByDocId(docId: string): ShareLink[] {
    const result: ShareLink[] = [];
    for (const link of this.links.values()) {
      if (link.docId === docId) {
        result.push(link);
      }
    }
    return result;
  }
}
