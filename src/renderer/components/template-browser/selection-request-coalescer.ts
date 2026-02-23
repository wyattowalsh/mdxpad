export type SelectionRequestRunner = (id: string) => Promise<void>;

/**
 * Coalesce rapid async selection requests so only the latest queued request runs
 * after the current in-flight request completes.
 */
export function createSelectionRequestCoalescer(
  run: SelectionRequestRunner
): SelectionRequestRunner {
  let activeRequest: Promise<void> | null = null;
  let queuedId: string | null = null;

  const flush = async (id: string): Promise<void> => {
    let nextId: string | null = id;

    while (nextId !== null) {
      const currentId: string = nextId;
      queuedId = null;
      await run(currentId);

      nextId = queuedId;
    }
  };

  return async (id: string): Promise<void> => {
    if (activeRequest) {
      queuedId = id;
      return activeRequest;
    }

    activeRequest = flush(id).finally(() => {
      activeRequest = null;
      queuedId = null;
    });

    return activeRequest;
  };
}
