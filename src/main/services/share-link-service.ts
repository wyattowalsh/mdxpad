/**
 * Share Link Service — Manages shareable URLs with unique tokens.
 * Generates, stores, and validates share links for documents.
 *
 * @module main/services/share-link-service
 */

import { randomUUID, randomBytes } from 'node:crypto';
import type { ShareLink, ShareAccessMode } from '@shared/contracts/share-schemas';
import { readShareStore, writeShareStore, type ShareStoreData } from './share-link-store';

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
  readonly storagePath?: string;
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
  private readonly storagePath: string | null;
  private loaded = false;
  private saveTail: Promise<void> = Promise.resolve();
  private pendingSave: Promise<void> = Promise.resolve();
  private lastWrittenLinks = new Map<string, ShareLink>();
  private lastWrittenContents = new Map<string, string>();

  constructor(options: ShareLinkServiceOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.tokenLength = options.tokenLength ?? DEFAULT_TOKEN_LENGTH;
    this.maxLinksPerDoc = options.maxLinksPerDoc ?? DEFAULT_MAX_LINKS_PER_DOC;
    this.storagePath = options.storagePath ?? null;
  }

  private ensureLoaded(): void {
    if (this.loaded || this.storagePath === null) {
      this.loaded = true;
      return;
    }
    this.loaded = true;
    const stored = readShareStore(this.storagePath);
    for (const link of stored.links) {
      this.links.set(link.id, link);
      const content = stored.contents[link.id];
      if (content !== undefined) {
        this.contents.set(link.id, content);
      }
    }
    this.rememberWritten();
  }

  whenSaved(): Promise<void> {
    return this.saveTail;
  }

  private captureShareStore(): ShareStoreData {
    const contents: Record<string, string> = {};
    for (const [id, content] of this.contents) {
      contents[id] = content;
    }
    return { links: Array.from(this.links.values()), contents };
  }

  private rememberWritten(): void {
    this.lastWrittenLinks = new Map(this.links);
    this.lastWrittenContents = new Map(this.contents);
  }

  private replaceWritten(snapshot: ShareStoreData): void {
    this.lastWrittenLinks = new Map(snapshot.links.map((link) => [link.id, link]));
    this.lastWrittenContents = new Map(Object.entries(snapshot.contents));
  }

  private restoreWritten(): void {
    this.links.clear();
    this.contents.clear();
    for (const [id, link] of this.lastWrittenLinks) {
      this.links.set(id, link);
    }
    for (const [id, content] of this.lastWrittenContents) {
      this.contents.set(id, content);
    }
  }

  private scheduleSave(): void {
    if (this.storagePath === null) {
      this.pendingSave = Promise.resolve();
      return;
    }
    const snapshot = this.captureShareStore();
    const target = this.storagePath;
    const attempt = this.saveTail.catch(() => undefined).then(async () => {
      try {
        await writeShareStore(target, snapshot);
        this.replaceWritten(snapshot);
      } catch {
        if (this.pendingSave === attempt) {
          this.restoreWritten();
        }
      }
    });
    this.pendingSave = attempt;
    this.saveTail = attempt;
  }

  /**
   * Create a new share link for a document.
   * @param options - Configuration for the share link
   * @returns The created share link
   * @throws Error if max links per document exceeded
   */
  createLink(options: CreateShareLinkOptions): ShareLink {
    this.ensureLoaded();
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
    this.scheduleSave();
    console.log(`[ShareLinkService] Created share link ${id} for doc ${options.docId}`);

    return link;
  }

  /**
   * Revoke (deactivate) a share link.
   * @param id - Share link ID to revoke
   * @returns true if the link was found and revoked
   */
  revokeLink(id: string): boolean {
    this.ensureLoaded();
    const link = this.links.get(id);
    if (!link) {
      return false;
    }

    const revokedLink: ShareLink = {
      ...link,
      isActive: false,
    };
    this.links.set(id, revokedLink);
    this.scheduleSave();

    console.log(`[ShareLinkService] Revoked share link ${id}`);
    return true;
  }

  /**
   * Get a share link by ID.
   * @param id - Share link ID
   * @returns The share link or null
   */
  getLink(id: string): ShareLink | null {
    this.ensureLoaded();
    return this.links.get(id) ?? null;
  }

  /**
   * Validate a share token and return the associated link.
   * Checks that the link is active and not expired.
   * @param token - The share token to validate
   * @returns The valid share link or null
   */
  validateToken(token: string): ShareLink | null {
    this.ensureLoaded();
    for (const link of this.links.values()) {
      if (link.token === token) {
        if (!link.isActive) {
          return null;
        }

        if (link.expiresAt !== null && Date.now() > link.expiresAt) {
          // Auto-deactivate expired links
          const expiredLink: ShareLink = { ...link, isActive: false };
          this.links.set(link.id, expiredLink);
          this.scheduleSave();
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
    this.ensureLoaded();
    if (docId !== undefined) {
      return this.getLinksByDocId(docId);
    }

    return Array.from(this.links.values());
  }

  /**
   * Move links created for one untitled tab onto the file that tab was saved as.
   * A saved file cannot be the source, so one file's links stay on that file.
   */
  moveUntitledDocument(fromDocId: string, toDocId: string): readonly ShareLink[] {
    this.ensureLoaded();
    if (!fromDocId.startsWith('untitled:') || fromDocId.length <= 'untitled:'.length) {
      throw new Error('Share links can only move from an untitled document');
    }
    if (toDocId.length === 0 || toDocId.startsWith('untitled:')) {
      throw new Error('Share links can only move onto a saved file');
    }
    const moving = this.getLinksByDocId(fromDocId);
    const existing = this.getLinksByDocId(toDocId);
    if (existing.length + moving.length > this.maxLinksPerDoc) {
      throw new Error(
        `Maximum share links (${this.maxLinksPerDoc}) reached for document ${toDocId}`
      );
    }
    for (const link of moving) {
      this.links.set(link.id, { ...link, docId: toDocId });
    }
    this.scheduleSave();
    return this.getLinksByDocId(toDocId);
  }

  /**
   * Remove expired and inactive links.
   * @returns Number of links removed
   */
  cleanup(): number {
    this.ensureLoaded();
    const now = Date.now();
    let removed = 0;

    for (const [id, link] of this.links) {
      if (!link.isActive || (link.expiresAt !== null && now > link.expiresAt)) {
        this.links.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      this.scheduleSave();
      console.log(`[ShareLinkService] Cleaned up ${removed} expired/inactive links`);
    }

    return removed;
  }

  /**
   * Get total number of active links.
   */
  getActiveLinkCount(): number {
    this.ensureLoaded();
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
