# AI Provider Abstraction Layer - Implementation Context

**Feature Branch**: `028-ai-provider-abstraction`
**Generated**: 2026-01-17

## Key Implementation References

- **Data Model**: `.specify/specs/028-ai-provider-abstraction/data-model.md`
- **Service Interfaces**: `.specify/specs/028-ai-provider-abstraction/contracts/service-interfaces.md`
- **IPC Channels**: `.specify/specs/028-ai-provider-abstraction/contracts/ipc-channels.md`
- **Tasks**: `.specify/specs/028-ai-provider-abstraction/tasks.md`

## Constitution Requirements (Project Rules)

- TypeScript 5.9.x with `strict: true`
- No `any` types without justification comment
- Functions max 50 lines
- Files max 400 lines
- zod validation for all IPC payloads
- Channel naming: `mdxpad:<domain>:<action>`

## Project Structure

Source files go in:
- `src/main/services/ai/` - Main process services
- `src/shared/ai/` - Shared types, schemas, IPC definitions
- `src/renderer/features/ai-provider/` - Renderer components
