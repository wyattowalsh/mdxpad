/**
 * Security tests for Collaboration Server and Share Link Service.
 * Validates room ID handling, token generation, expiry, access modes, revocation.
 *
 * HR-3 audit (2026-03-01): Verified that CollaborationServer.docId is never used
 * in filesystem paths. See "docId filesystem isolation invariant" tests below.
 *
 * @module tests/security/collab-share-security
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { IncomingMessage } from 'node:http';
import { CollaborationServer } from '@main/services/collab-server';
import { ShareLinkService } from '@main/services/share-link-service';
import {
  SafeDocumentIdSchema,
  CollaborationListRequestSchema,
  CollaborationAddCommentRequestSchema,
  CollaborationAddSuggestionRequestSchema,
  CollaborationApplySuggestionRequestSchema,
  CollaborationResolveThreadRequestSchema,
} from '@shared/contracts/platform-schemas';

// ============================================================================
// Mock WebSocket helpers
// ============================================================================

interface MockWsSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  closedCode: number | undefined;
  closedReason: string | undefined;
  listeners: Map<string, ((...args: unknown[]) => void)[]>;
}

function createMockSocket(): MockWsSocket {
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
  const socket: MockWsSocket = {
    readyState: 1,
    send: vi.fn(),
    close: vi.fn((code?: number, reason?: string) => {
      socket.closedCode = code;
      socket.closedReason = reason;
    }),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    }),
    closedCode: undefined,
    closedReason: undefined,
    listeners,
  };
  return socket;
}

function createMockRequest(qs: string): IncomingMessage {
  return { url: `/?${qs}` } as IncomingMessage;
}

function createMockServerFactory() {
  type ConnHandler = (ws: MockWsSocket, req: IncomingMessage) => void;
  let listeningCb: (() => void) | null = null;
  let connectionCb: ConnHandler | null = null;

  const mockServer = {
    on: vi.fn((event: string, handler: (() => void) | ConnHandler | ((e: Error) => void)) => {
      if (event === 'listening') listeningCb = handler as () => void;
      if (event === 'connection') connectionCb = handler as ConnHandler;
    }),
    close: vi.fn((cb?: (err?: Error) => void) => cb?.()),
    address: vi.fn(() => ({ port: 9876 })),
  };

  const factory = vi.fn(() => {
    setTimeout(() => listeningCb?.(), 0);
    return mockServer;
  });

  return {
    factory,
    mockServer,
    simulateConnection: (ws: MockWsSocket, req: IncomingMessage) => connectionCb?.(ws, req),
  };
}

// ============================================================================
// Collaboration Server Security Tests
// ============================================================================

describe('CollaborationServer security', () => {
  let server: CollaborationServer;
  let simulateConnection: (ws: MockWsSocket, req: IncomingMessage) => void;

  beforeEach(async () => {
    const mock = createMockServerFactory();
    simulateConnection = mock.simulateConnection;
    server = new CollaborationServer({
      maxRooms: 5,
      maxClientsPerRoom: 3,
      serverFactory: mock.factory,
    });
    await server.start(0);
  });

  describe('room ID validation', () => {
    it('rejects connections without a docId parameter', () => {
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('username=alice'));
      expect(ws.close).toHaveBeenCalledWith(4000, 'Missing docId parameter');
    });

    it('rejects empty docId parameter', () => {
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('docId=&username=alice'));
      expect(ws.close).toHaveBeenCalledWith(4000, 'Missing docId parameter');
    });

    it('accepts valid room IDs and creates the room', () => {
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('docId=valid-room-123&username=alice'));
      const room = server.getRoom('valid-room-123');
      expect(room).not.toBeNull();
      expect(room?.clientCount).toBe(1);
      expect(room?.clients[0]?.username).toBe('alice');
    });

    it('handles docId with path traversal as opaque identifier', () => {
      // SAFETY: docId is used only as an in-memory Map key in CollaborationServer.
      // It is never passed to path.join(), fs.*, or any file system operation.
      // CollaborationServer (collab-server.ts) imports only 'node:http' — no 'fs',
      // no 'path', no file I/O modules. The rooms Map<string, CollabRoom> stores
      // docId purely for in-memory lookup and WebSocket message routing.
      // NOTE: CollaborationService (collaboration-service.ts) is a SEPARATE class
      // that DOES use documentId in filesystem paths — it has its own validation.
      // See HR-3 audit (2026-03-01) for verification.
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('docId=../../../etc/passwd&username=eve'));
      const room = server.getRoom('../../../etc/passwd');
      expect(room).not.toBeNull();
      expect(room?.docId).toBe('../../../etc/passwd');
    });

    it('handles docId with special characters safely', () => {
      const specialIds = [
        'doc<script>alert(1)</script>',
        'doc"onmouseover="alert(1)',
        'doc\x00null',
        'doc/../secret',
      ];
      for (const docId of specialIds) {
        const ws = createMockSocket();
        simulateConnection(ws, createMockRequest(`docId=${encodeURIComponent(docId)}&username=t`));
        expect(ws.close).not.toHaveBeenCalled();
      }
    });
  });

  describe('docId filesystem isolation invariant', () => {
    // HR-3 audit (2026-03-01): Static verification that CollaborationServer
    // never imports filesystem modules and therefore cannot use docId in paths.
    // This is a defense-in-depth test that will break if someone adds fs/path
    // imports to collab-server.ts, forcing an explicit security review.

    it('collab-server.ts does not import node:fs or node:path', () => {
      const serverSource = readFileSync(
        resolve(__dirname, '../../src/main/services/collab-server.ts'),
        'utf-8'
      );
      // Must not import any filesystem or path modules
      expect(serverSource).not.toMatch(/import\s.*from\s+['"](?:node:)?fs['"]/);
      expect(serverSource).not.toMatch(/import\s.*from\s+['"](?:node:)?path['"]/);
      expect(serverSource).not.toMatch(/require\s*\(\s*['"](?:node:)?fs['"]\s*\)/);
      expect(serverSource).not.toMatch(/require\s*\(\s*['"](?:node:)?path['"]\s*\)/);
    });

    it('collab-server.ts does not call path.join or fs.* operations', () => {
      const serverSource = readFileSync(
        resolve(__dirname, '../../src/main/services/collab-server.ts'),
        'utf-8'
      );
      expect(serverSource).not.toMatch(/path\.join\s*\(/);
      expect(serverSource).not.toMatch(/path\.resolve\s*\(/);
      expect(serverSource).not.toMatch(/fs\.\w+\s*\(/);
      expect(serverSource).not.toMatch(/writeFile|readFile|mkdir|unlink|readdir/);
    });

    it('share-link-service.ts does not import node:fs or node:path', () => {
      const serviceSource = readFileSync(
        resolve(__dirname, '../../src/main/services/share-link-service.ts'),
        'utf-8'
      );
      expect(serviceSource).not.toMatch(/import\s.*from\s+['"](?:node:)?fs['"]/);
      expect(serviceSource).not.toMatch(/import\s.*from\s+['"](?:node:)?path['"]/);
      expect(serviceSource).not.toMatch(/require\s*\(\s*['"](?:node:)?fs['"]\s*\)/);
      expect(serviceSource).not.toMatch(/require\s*\(\s*['"](?:node:)?path['"]\s*\)/);
    });
  });

  describe('room creation with valid IDs', () => {
    it('creates rooms for alphanumeric IDs', () => {
      for (const docId of ['doc-1', 'abc123', 'my_document', 'UUID-like-4f9a']) {
        const ws = createMockSocket();
        simulateConnection(ws, createMockRequest(`docId=${docId}&username=user`));
        const room = server.getRoom(docId);
        expect(room).not.toBeNull();
        expect(room?.docId).toBe(docId);
      }
    });

    it('enforces maximum room limit', () => {
      for (let i = 0; i < 5; i++) {
        const ws = createMockSocket();
        simulateConnection(ws, createMockRequest(`docId=room-${i}&username=user`));
      }
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('docId=room-overflow&username=user'));
      expect(ws.close).toHaveBeenCalledWith(4001, 'Max rooms exceeded');
    });

    it('enforces maximum clients per room', () => {
      for (let i = 0; i < 3; i++) {
        const ws = createMockSocket();
        simulateConnection(ws, createMockRequest(`docId=full-room&username=user-${i}`));
      }
      const ws = createMockSocket();
      simulateConnection(ws, createMockRequest('docId=full-room&username=overflow'));
      expect(ws.close).toHaveBeenCalledWith(4002, 'Room is full');
    });
  });
});

// ============================================================================
// Share Link Service Security Tests
// ============================================================================

describe('ShareLinkService security', () => {
  let service: ShareLinkService;
  const linkOpts = (docId: string, mode: 'read-only' | 'read-write', expires: number | null) =>
    ({ docId, accessMode: mode, expiresInMs: expires }) as const;

  beforeEach(() => {
    service = new ShareLinkService({
      baseUrl: 'mdxpad://share',
      tokenLength: 32,
      maxLinksPerDoc: 5,
    });
  });

  describe('token generation', () => {
    it('generates unique tokens across multiple calls', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tokens.add(service.createLink(linkOpts(`doc-${i}`, 'read-only', null)).token);
      }
      expect(tokens.size).toBe(50);
    });

    it('generates tokens of the expected hex length', () => {
      const link = service.createLink(linkOpts('doc-len', 'read-only', null));
      expect(link.token).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(link.token).toMatch(/^[0-9a-f]+$/);
    });

    it('generates tokens with sufficient entropy', () => {
      const link = service.createLink(linkOpts('doc-entropy', 'read-only', null));
      expect(link.token).not.toMatch(/^0+$/);
      expect(new Set(link.token.split('')).size).toBeGreaterThan(4);
    });
  });

  describe('expiry enforcement', () => {
    it('rejects expired links when validating token', () => {
      const link = service.createLink(linkOpts('doc-expiry', 'read-only', 100));
      expect(service.validateToken(link.token)).not.toBeNull();

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 200);
      expect(service.validateToken(link.token)).toBeNull();
      vi.useRealTimers();
    });

    it('auto-deactivates expired links on validation', () => {
      const link = service.createLink(linkOpts('doc-deactivate', 'read-only', 50));
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 100);
      service.validateToken(link.token);
      expect(service.getLink(link.id)?.isActive).toBe(false);
      vi.useRealTimers();
    });

    it('allows non-expiring links to remain valid indefinitely', () => {
      const link = service.createLink(linkOpts('doc-no-exp', 'read-only', null));
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 365 * 24 * 60 * 60 * 1000);
      expect(service.validateToken(link.token)?.id).toBe(link.id);
      vi.useRealTimers();
    });
  });

  describe('read-only access mode', () => {
    it('creates links with read-only access mode', () => {
      expect(service.createLink(linkOpts('doc-ro', 'read-only', null)).accessMode).toBe(
        'read-only'
      );
    });

    it('validates token and preserves access mode for enforcement', () => {
      const ro = service.createLink(linkOpts('doc-ac', 'read-only', null));
      const rw = service.createLink(linkOpts('doc-ac', 'read-write', null));
      expect(service.validateToken(ro.token)?.accessMode).toBe('read-only');
      expect(service.validateToken(rw.token)?.accessMode).toBe('read-write');
      expect(service.validateToken(ro.token)?.accessMode === 'read-write').toBe(false);
    });

    it('read-only links do not grant write access through any validation path', () => {
      const link = service.createLink(linkOpts('doc-enf', 'read-only', null));
      for (let i = 0; i < 5; i++) {
        expect(service.validateToken(link.token)?.accessMode).toBe('read-only');
      }
    });
  });

  describe('link revocation', () => {
    it('revoked links are rejected on token validation', () => {
      const link = service.createLink(linkOpts('doc-rev', 'read-write', null));
      expect(service.validateToken(link.token)).not.toBeNull();
      expect(service.revokeLink(link.id)).toBe(true);
      expect(service.validateToken(link.token)).toBeNull();
    });

    it('revoking a non-existent link returns false', () => {
      expect(service.revokeLink('non-existent-id')).toBe(false);
    });

    it('revoked link stays revoked even after cleanup', () => {
      const link = service.createLink(linkOpts('doc-rc', 'read-only', null));
      service.revokeLink(link.id);
      service.cleanup();
      expect(service.validateToken(link.token)).toBeNull();
    });

    it('revocation of one link does not affect other links for same doc', () => {
      const l1 = service.createLink(linkOpts('doc-m', 'read-only', null));
      const l2 = service.createLink(linkOpts('doc-m', 'read-write', null));
      service.revokeLink(l1.id);
      expect(service.validateToken(l1.token)).toBeNull();
      expect(service.validateToken(l2.token)).not.toBeNull();
    });
  });

  describe('max links per document', () => {
    it('enforces the maximum number of share links per document', () => {
      for (let i = 0; i < 5; i++) {
        service.createLink(linkOpts('doc-max', 'read-only', null));
      }
      expect(() => service.createLink(linkOpts('doc-max', 'read-only', null))).toThrow(
        /Maximum share links.*reached/
      );
    });
  });
});

// ============================================================================
// SafeDocumentIdSchema — path traversal prevention for CollaborationService
// ============================================================================

describe('SafeDocumentIdSchema path traversal prevention', () => {
  // HR-3 audit (2026-03-01): CollaborationService (collaboration-service.ts)
  // uses documentId in path.join(baseDir, `${documentId}.json`), making it
  // vulnerable to path traversal. SafeDocumentIdSchema blocks this at the
  // Zod validation boundary before the value reaches any filesystem operation.

  describe('rejects dangerous documentId values', () => {
    const dangerousIds = [
      { value: '../../../etc/passwd', reason: 'path traversal with ..' },
      { value: 'doc/../secret', reason: 'embedded path traversal' },
      { value: '..', reason: 'bare parent directory reference' },
      { value: 'foo/bar', reason: 'forward slash path separator' },
      { value: 'foo\\bar', reason: 'backslash path separator' },
      { value: 'doc\x00evil', reason: 'null byte injection' },
    ];

    for (const { value, reason } of dangerousIds) {
      it(`rejects "${value.replace(/\0/g, '\\0')}" (${reason})`, () => {
        const result = SafeDocumentIdSchema.safeParse(value);
        expect(result.success).toBe(false);
      });
    }
  });

  describe('accepts safe documentId values', () => {
    const safeIds = [
      'doc-123',
      'my_document',
      'abc123',
      'UUID-4f9a-bc12',
      'a-long-document-identifier-with-dashes',
      'doc.with.dots',
    ];

    for (const id of safeIds) {
      it(`accepts "${id}"`, () => {
        const result = SafeDocumentIdSchema.safeParse(id);
        expect(result.success).toBe(true);
      });
    }
  });

  describe('rejects empty and missing values', () => {
    it('rejects empty string', () => {
      expect(SafeDocumentIdSchema.safeParse('').success).toBe(false);
    });
  });

  describe('request schemas use SafeDocumentIdSchema', () => {
    // Verify that all collaboration request schemas reject path traversal in documentId.
    // These schemas gate input to CollaborationService which uses documentId in path.join().

    const traversalDocId = '../../../etc/passwd';

    it('CollaborationListRequestSchema rejects path traversal documentId', () => {
      const result = CollaborationListRequestSchema.safeParse({ documentId: traversalDocId });
      expect(result.success).toBe(false);
    });

    it('CollaborationAddCommentRequestSchema rejects path traversal documentId', () => {
      const result = CollaborationAddCommentRequestSchema.safeParse({
        documentId: traversalDocId,
        anchor: {
          blockId: 'b1',
          startOffset: 0,
          endOffset: 5,
          headingPath: [],
        },
        author: 'alice',
        message: 'test',
      });
      expect(result.success).toBe(false);
    });

    it('CollaborationAddSuggestionRequestSchema rejects path traversal documentId', () => {
      const result = CollaborationAddSuggestionRequestSchema.safeParse({
        documentId: traversalDocId,
        anchor: {
          blockId: 'b1',
          startOffset: 0,
          endOffset: 5,
          headingPath: [],
        },
        patch: 'diff',
        rationale: 'reason',
        author: 'alice',
        baseChecksum: 'abc123',
      });
      expect(result.success).toBe(false);
    });

    it('CollaborationApplySuggestionRequestSchema rejects path traversal documentId', () => {
      const result = CollaborationApplySuggestionRequestSchema.safeParse({
        documentId: traversalDocId,
        suggestionId: 'sug-1',
        currentChecksum: 'abc123',
      });
      expect(result.success).toBe(false);
    });

    it('CollaborationResolveThreadRequestSchema rejects path traversal documentId', () => {
      const result = CollaborationResolveThreadRequestSchema.safeParse({
        documentId: traversalDocId,
        threadId: 'thread-1',
        resolved: true,
      });
      expect(result.success).toBe(false);
    });
  });
});
