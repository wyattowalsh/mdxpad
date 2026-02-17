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
  requestSchema: z.ZodType<TReq> | null,
  responseSchema: z.ZodType<TRes>,
  args?: unknown
): Promise<TRes> {
  // Validate request if schema provided (sender-side validation)
  if (requestSchema && args !== undefined) {
    const reqParsed = requestSchema.safeParse(args);
    if (!reqParsed.success) {
      throw new Error(`Request validation failed: ${reqParsed.error.message}`);
    }
  }

  // Invoke IPC - cast to unknown since Electron returns any
  const response: unknown = await ipcRenderer.invoke(channel, args);

  // Validate response (receiver-side validation)
  const resParsed = responseSchema.safeParse(response);
  if (!resParsed.success) {
    throw new Error(`Response validation failed: ${resParsed.error.message}`);
  }

  return resParsed.data;
}
