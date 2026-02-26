/**
 * Coalesces Mermaid render requests and prevents re-entrant execution.
 */
export interface MermaidRenderScheduler {
  requestRender: () => void;
}

export function createMermaidRenderScheduler(
  renderMermaid: () => Promise<void>
): MermaidRenderScheduler {
  let pendingRenders = 0;
  let inFlight: Promise<void> | null = null;

  const run = (): Promise<void> => {
    if (inFlight !== null) {
      return inFlight;
    }

    inFlight = (async () => {
      while (pendingRenders > 0) {
        pendingRenders = 0;
        await renderMermaid();
      }
    })().finally(() => {
      inFlight = null;
    });

    return inFlight;
  };

  return {
    requestRender: () => {
      pendingRenders += 1;
      void run().catch(() => {
        // Errors are handled by renderMermaid implementation.
      });
    },
  };
}
