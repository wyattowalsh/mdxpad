# ADR-001: IPC Validation with Zod Schemas

## Status

Accepted

## Date

2025-01-01

## Context

Electron applications communicate between the main process (Node.js) and the renderer process (browser) via Inter-Process Communication (IPC). This boundary is a critical security surface:

- The renderer process is untrusted (it runs web content).
- Messages crossing the IPC boundary can be tampered with or malformed.
- TypeScript types are erased at runtime, providing no actual validation.
- Without runtime validation, the main process could act on invalid or malicious input.

We needed a strategy that provides both compile-time type safety and runtime validation at IPC boundaries.

## Decision

All IPC communication in MDXPad uses **Zod schemas** defined in `src/shared/contracts/` as the single source of truth for request and response types.

The pattern works as follows:

1. **Schema definition** (`src/shared/contracts/*.ts`): Zod schemas define the shape of every IPC request and response.

2. **Type derivation**: TypeScript types are inferred from schemas using `z.infer<>`, ensuring types and runtime validation are always in sync.

3. **Main process handlers** (`src/main/ipc/*.ts`): Every `ipcMain.handle` call parses the incoming request with the corresponding schema before processing, and parses the response before returning.

4. **Preload bridge** (`src/preload/index.ts`): The `validatedInvoke` helper validates the response from the main process before passing it to the renderer.

```typescript
// Schema (shared/contracts/file-schemas.ts)
export const ReadFileRequestSchema = z.object({
  filePath: z.string().min(1),
});
export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;

// Handler (main/ipc/file-handlers.ts)
ipcMain.handle('file:read', async (_, request) => {
  const validated = ReadFileRequestSchema.parse(request);
  const result = await fileService.read(validated.filePath);
  return ReadFileResponseSchema.parse(result);
});

// Preload (preload/index.ts)
readFile: (filePath: string) =>
  validatedInvoke('file:read', { filePath }, ReadFileResponseSchema)
```

## Consequences

### Positive

- **Defense in depth**: Both sides of the IPC boundary validate messages, catching bugs and preventing injection.
- **Single source of truth**: Types are derived from schemas, so type mismatches between processes are impossible.
- **Clear error messages**: Zod provides detailed validation errors that make debugging straightforward.
- **Incremental adoption**: New IPC channels can adopt the pattern without changing existing ones.
- **Self-documenting**: Schemas serve as living documentation of the IPC API surface.

### Negative

- **Runtime overhead**: Every IPC call incurs Zod parsing cost. In practice this is negligible (sub-millisecond for typical payloads), but worth noting.
- **Boilerplate**: Each channel requires schema + type + handler + preload wiring. This was mitigated by keeping schemas in a central `contracts/` directory.
- **Zod dependency**: The pattern couples us to Zod. Switching validation libraries would require updating all contracts.

### Neutral

- The pattern naturally encourages small, focused IPC messages (large objects are awkward to schema-define).
- Schemas can be reused for other validation (e.g., file content, user input).

## Alternatives Considered

### Runtime type assertions (`assert` / manual checks)

Manual `typeof` checks and assertions are error-prone, verbose, and do not compose well. They also diverge from TypeScript types over time.

### io-ts / superstruct

These libraries serve a similar purpose but Zod was chosen for its:
- Superior TypeScript inference
- Simpler API
- Larger ecosystem and community
- Better error messages

### No runtime validation (trust TypeScript types)

TypeScript types are erased at runtime. This leaves the IPC boundary completely unprotected. A bug in the renderer or a compromised renderer process could send arbitrary data to the main process.

## References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [Zod Documentation](https://zod.dev)
- `src/shared/contracts/` -- IPC schema definitions
- `src/preload/index.ts` -- `validatedInvoke` helper
- Spec 001: Interface Contracts
