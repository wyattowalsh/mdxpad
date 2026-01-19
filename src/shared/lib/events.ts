/**
 * TypedEventEmitter - Type-safe event emitter for pub/sub patterns.
 * Ensures event names and payloads are correctly typed.
 */

/**
 * Event map type - maps event names to payload types.
 * @example
 * type AppEvents = {
 *   'file:changed': { path: string };
 *   'theme:updated': { theme: 'light' | 'dark' };
 * };
 */
export type EventMap = Record<string, unknown>;

/**
 * Event handler function type.
 */
export type EventHandler<T> = (payload: T) => void;

/**
 * Type-safe event emitter.
 * Ensures event names and payloads are correctly typed.
 */
export class TypedEventEmitter<T extends EventMap> {
  private handlers = new Map<keyof T, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event.
   * @param event - Event name (must be key of T)
   * @param handler - Callback receiving typed payload
   * @returns Unsubscribe function
   */
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(event, handlers);

    return () => {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event once.
   * @param event - Event name
   * @param handler - Callback (called once then removed)
   * @returns Unsubscribe function
   */
  once<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers.
   * @param event - Event name
   * @param payload - Typed payload
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(payload));
    }
  }

  /**
   * Remove listener(s) from an event or clear all events.
   * @param event - Optional event name. If omitted, clears all events.
   * @param handler - Optional specific handler to remove
   */
  off<K extends keyof T>(event?: K, handler?: EventHandler<T[K]>): void {
    if (event === undefined) {
      // Clear all events
      this.handlers.clear();
    } else if (handler !== undefined) {
      // Remove specific handler for event
      const handlers = this.handlers.get(event);
      if (handlers) {
        handlers.delete(handler as EventHandler<unknown>);
        if (handlers.size === 0) {
          this.handlers.delete(event);
        }
      }
    } else {
      // Remove all handlers for event
      this.handlers.delete(event);
    }
  }

  /**
   * Get the number of listeners for an event.
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount<K extends keyof T>(event: K): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

/**
 * Create a new typed event emitter.
 * @returns New TypedEventEmitter instance
 * @example
 * type MyEvents = {
 *   'user:login': { userId: string };
 *   'user:logout': { userId: string };
 * };
 * const emitter = createEventEmitter<MyEvents>();
 */
export function createEventEmitter<
  Events extends EventMap
>(): TypedEventEmitter<Events> {
  return new TypedEventEmitter<Events>();
}
