/**
 * Validated IPC Invoke Utility
 *
 * Provides a safe IPC invoke helper with schema validation on both ends.
 * Per Constitution III.3: All payloads validated with zod on both ends.
 *
 * @security Uses invoke/handle pattern, never send/on
 * @security All payloads validated with zod schemas
 * @module src/preload/validated-invoke
 */

import { ipcRenderer } from 'electron';
import { z } from 'zod';

const DEFAULT_INVOKE_TIMEOUT_MS = 15_000;

export interface ValidatedInvokeOptions {
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

function createAbortError(channel: string): Error {
  return new Error(`IPC invoke aborted for channel: ${channel}`);
}

function createTimeoutError(channel: string, timeoutMs: number): Error {
  return new Error(`IPC invoke timed out after ${timeoutMs}ms for channel: ${channel}`);
}

async function invokeWithGuards(
  channel: string,
  args: unknown,
  options?: ValidatedInvokeOptions
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_INVOKE_TIMEOUT_MS;
  const signal = options?.signal;

  if (signal?.aborted) {
    throw createAbortError(channel);
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(createTimeoutError(channel, timeoutMs));
    }, timeoutMs);

    const onAbort = (): void => {
      cleanup();
      reject(createAbortError(channel));
    };

    const cleanup = (): void => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    void ipcRenderer.invoke(channel, args).then(
      (response) => {
        cleanup();
        resolve(response);
      },
      (error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/**
 * Performs a validated IPC invoke with schema validation on both ends.
 * Per Constitution III.3: All payloads validated with zod on both ends.
 *
 * @param channel - IPC channel name
 * @param requestSchema - Zod schema for request validation (null for void requests)
 * @param responseSchema - Zod schema for response validation
 * @param args - Arguments to pass to the handler (undefined for void requests)
 * @returns Validated response data
 * @throws Error if request or response validation fails
 */
export async function validatedInvoke<TReq, TRes>(
  channel: string,
  requestSchema: z.ZodType<TReq, z.ZodTypeDef, unknown> | null,
  responseSchema: z.ZodType<TRes, z.ZodTypeDef, unknown>,
  args?: unknown,
  options?: ValidatedInvokeOptions
): Promise<TRes> {
  // Validate request if schema provided (sender-side validation)
  if (requestSchema && args !== undefined) {
    const reqParsed = requestSchema.safeParse(args);
    if (!reqParsed.success) {
      throw new Error(`Request validation failed: ${reqParsed.error.message}`);
    }
  }

  // Invoke IPC - cast to unknown since Electron returns any
  const response: unknown = await invokeWithGuards(channel, args, options);

  // Validate response (receiver-side validation)
  const resParsed = responseSchema.safeParse(response);
  if (!resParsed.success) {
    throw new Error(`Response validation failed: ${resParsed.error.message}`);
  }

  return resParsed.data;
}

/**
 * Creates a typed invoke helper for channels with request/response contracts.
 */
export function createTypedValidatedInvoke<TReq, TRes>(
  channel: string,
  requestSchema: z.ZodType<TReq, z.ZodTypeDef, unknown>,
  responseSchema: z.ZodType<TRes, z.ZodTypeDef, unknown>
): (request: TReq, options?: ValidatedInvokeOptions) => Promise<TRes> {
  return (request, options) =>
    validatedInvoke(channel, requestSchema, responseSchema, request, options);
}
