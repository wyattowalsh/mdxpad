/**
 * Collaboration Server — Yjs WebSocket server running in Electron main process.
 * Manages collaboration rooms and connected clients for real-time document editing.
 *
 * @module main/services/collab-server
 */

import type { IncomingMessage } from 'node:http';

// ============================================================================
// WebSocket Types (minimal interface — avoids direct `ws` import for type compat)
// ============================================================================

/** Minimal WebSocket interface matching the `ws` library */
interface WsSocket {
  readonly readyState: number;
  send(data: Uint8Array | Buffer): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', listener: (data: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
}

/** Minimal WebSocketServer interface */
interface WsServer {
  on(event: 'listening', listener: () => void): void;
  on(event: 'connection', listener: (ws: WsSocket, req: IncomingMessage) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  close(callback?: (err?: Error) => void): void;
  address(): { port: number } | string | null;
}

/** Factory type for creating WebSocketServer instances */
type WsServerFactory = (options: { port: number }) => WsServer;

// ============================================================================
// Types
// ============================================================================

/** Represents a connected client in a collaboration room */
interface CollabClient {
  readonly clientId: number;
  readonly ws: WsSocket;
  readonly username: string;
  readonly color: string;
  readonly joinedAt: number;
}

/** Represents a collaboration room for a document */
interface CollabRoom {
  readonly docId: string;
  readonly clients: Map<number, CollabClient>;
  readonly createdAt: number;
  /** Accumulated document updates for late joiners */
  readonly updates: Uint8Array[];
}

/** Room info returned publicly (without WebSocket refs) */
export interface CollabRoomInfo {
  readonly docId: string;
  readonly clientCount: number;
  readonly createdAt: number;
  readonly clients: readonly {
    readonly clientId: number;
    readonly username: string;
    readonly color: string;
    readonly joinedAt: number;
  }[];
}

/** Options for the collaboration server */
export interface CollabServerOptions {
  readonly maxClientsPerRoom?: number | undefined;
  readonly maxRooms?: number | undefined;
  readonly maxUpdatesPerRoom?: number | undefined;
  readonly serverFactory?: WsServerFactory | undefined;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_CLIENTS_PER_ROOM = 20;
const DEFAULT_MAX_ROOMS = 50;
const DEFAULT_MAX_UPDATES_PER_ROOM = 1000;
const MSG_TYPE_SYNC = 0;
// MSG_TYPE_AWARENESS = 1 reserved for future awareness protocol messages

// ============================================================================
// Collaboration Server
// ============================================================================

/**
 * Collaboration server managing Yjs WebSocket rooms in the Electron main process.
 * Each document gets its own room identified by docId.
 */
export class CollaborationServer {
  private wss: WsServer | null = null;
  private readonly rooms = new Map<string, CollabRoom>();
  private nextClientId = 1;
  private port = 0;
  private readonly maxClientsPerRoom: number;
  private readonly maxRooms: number;
  private readonly maxUpdatesPerRoom: number;
  private readonly serverFactory: WsServerFactory | null;

  constructor(options: CollabServerOptions = {}) {
    this.maxClientsPerRoom = options.maxClientsPerRoom ?? DEFAULT_MAX_CLIENTS_PER_ROOM;
    this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS;
    this.maxUpdatesPerRoom = options.maxUpdatesPerRoom ?? DEFAULT_MAX_UPDATES_PER_ROOM;
    this.serverFactory = options.serverFactory ?? null;
  }

  /**
   * Start the WebSocket server on the specified port.
   * @param port - Port to listen on (0 for random available port)
   * @returns The actual port the server is listening on
   */
  async start(port: number): Promise<number> {
    if (this.wss) {
      throw new Error('Collaboration server is already running');
    }

    if (!this.serverFactory) {
      throw new Error('No WebSocket server factory provided');
    }

    const factory = this.serverFactory;
    return new Promise<number>((resolve, reject) => {
      this.wss = factory({ port });

      this.wss.on('listening', () => {
        const address = this.wss?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          console.log(`[CollabServer] Listening on port ${this.port}`);
          resolve(this.port);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });

      this.wss.on('connection', (ws: WsSocket, req: IncomingMessage) => {
        this.handleConnection(ws, req);
      });

      this.wss.on('error', (error: Error) => {
        console.error('[CollabServer] Server error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * Stop the WebSocket server and disconnect all clients.
   */
  async stop(): Promise<void> {
    if (!this.wss) {
      return;
    }

    // Close all client connections
    for (const room of this.rooms.values()) {
      for (const client of room.clients.values()) {
        client.ws.close(1000, 'Server shutting down');
      }
    }

    this.rooms.clear();

    return new Promise<void>((resolve, reject) => {
      this.wss?.close((err?: Error) => {
        this.wss = null;
        this.port = 0;
        if (err) {
          reject(err);
        } else {
          console.log('[CollabServer] Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get information about a specific room.
   * @param docId - Document identifier for the room
   * @returns Room info or null if room doesn't exist
   */
  getRoom(docId: string): CollabRoomInfo | null {
    const room = this.rooms.get(docId);
    if (!room) {
      return null;
    }

    return {
      docId: room.docId,
      clientCount: room.clients.size,
      createdAt: room.createdAt,
      clients: Array.from(room.clients.values()).map((c) => ({
        clientId: c.clientId,
        username: c.username,
        color: c.color,
        joinedAt: c.joinedAt,
      })),
    };
  }

  /**
   * Broadcast a document update to all clients in a room.
   * @param docId - Document identifier for the room
   * @param update - Yjs document update bytes
   */
  broadcastUpdate(docId: string, update: Uint8Array): void {
    const room = this.rooms.get(docId);
    if (!room) {
      return;
    }

    // Store update for late joiners
    room.updates.push(update);
    if (room.updates.length > this.maxUpdatesPerRoom) {
      room.updates.splice(0, room.updates.length - this.maxUpdatesPerRoom);
    }

    // Broadcast to all connected clients
    const message = this.encodeMessage(MSG_TYPE_SYNC, update);
    for (const client of room.clients.values()) {
      if (client.ws.readyState === 1) { // WebSocket.OPEN
        client.ws.send(message);
      }
    }
  }

  /**
   * Get the current server port.
   * @returns The port number or 0 if not running
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Check if the server is running.
   */
  isRunning(): boolean {
    return this.wss !== null;
  }

  /**
   * Get all active room IDs.
   */
  getRoomIds(): readonly string[] {
    return Array.from(this.rooms.keys());
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleConnection(ws: WsSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/', `http://localhost:${this.port}`);
    const docId = url.searchParams.get('docId');
    const username = url.searchParams.get('username') ?? 'Anonymous';
    const color = url.searchParams.get('color') ?? '#6366f1';

    if (!docId) {
      ws.close(4000, 'Missing docId parameter');
      return;
    }

    const room = this.getOrCreateRoom(docId);
    if (!room) {
      ws.close(4001, 'Max rooms exceeded');
      return;
    }

    if (room.clients.size >= this.maxClientsPerRoom) {
      ws.close(4002, 'Room is full');
      return;
    }

    const clientId = this.nextClientId++;
    const client: CollabClient = {
      clientId,
      ws,
      username,
      color,
      joinedAt: Date.now(),
    };

    room.clients.set(clientId, client);
    console.log(`[CollabServer] Client ${clientId} (${username}) joined room ${docId}`);

    // Send existing updates to new client
    for (const update of room.updates) {
      ws.send(this.encodeMessage(MSG_TYPE_SYNC, update));
    }

    ws.on('message', (data: Buffer) => {
      this.handleMessage(docId, clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(docId, clientId);
    });

    ws.on('error', (error: Error) => {
      console.error(`[CollabServer] Client ${clientId} error:`, error.message);
      this.handleDisconnect(docId, clientId);
    });
  }

  private handleMessage(docId: string, senderId: number, data: Buffer): void {
    const room = this.rooms.get(docId);
    if (!room) {
      return;
    }

    const bytes = new Uint8Array(data);
    const msgType = bytes[0];

    if (msgType === MSG_TYPE_SYNC) {
      const update = bytes.slice(1);
      room.updates.push(update);
      if (room.updates.length > this.maxUpdatesPerRoom) {
        room.updates.splice(0, room.updates.length - this.maxUpdatesPerRoom);
      }
    }

    // Broadcast to all other clients in the room
    for (const [cid, client] of room.clients) {
      if (cid !== senderId && client.ws.readyState === 1) {
        client.ws.send(data);
      }
    }
  }

  private handleDisconnect(docId: string, clientId: number): void {
    const room = this.rooms.get(docId);
    if (!room) {
      return;
    }

    room.clients.delete(clientId);
    console.log(`[CollabServer] Client ${clientId} left room ${docId}`);

    // Clean up empty rooms
    if (room.clients.size === 0) {
      this.rooms.delete(docId);
      console.log(`[CollabServer] Room ${docId} removed (empty)`);
    }
  }

  private getOrCreateRoom(docId: string): CollabRoom | null {
    const existing = this.rooms.get(docId);
    if (existing) {
      return existing;
    }

    if (this.rooms.size >= this.maxRooms) {
      return null;
    }

    const room: CollabRoom = {
      docId,
      clients: new Map(),
      createdAt: Date.now(),
      updates: [],
    };

    this.rooms.set(docId, room);
    return room;
  }

  private encodeMessage(type: number, data: Uint8Array): Uint8Array {
    const message = new Uint8Array(1 + data.length);
    message[0] = type;
    message.set(data, 1);
    return message;
  }
}
