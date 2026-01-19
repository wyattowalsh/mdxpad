# Implementation Plan: AI Provider Abstraction Layer

**Branch**: `028-ai-provider-abstraction` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-ai-provider-abstraction/spec.md`

## Summary

Implement a BYOK (Bring Your Own Key) AI provider abstraction layer enabling users to configure and use multiple AI providers (OpenAI, Anthropic, local models like Ollama/LM Studio) with secure credential storage via macOS Keychain, unified interfaces via Vercel AI SDK, usage tracking, and capability detection.

## Technical Context

**Language/Version**: TypeScript 5.9.x with `strict: true` (per Constitution Article II)
**Primary Dependencies**: Electron 39.x (safeStorage), React 19.x, Zustand 5.x + Immer 11.x, Vercel AI SDK v6 (@ai-sdk/*)
**Storage**: electron-store for config/usage, safeStorage for credentials (macOS Keychain), memory for session fallback
**Testing**: Vitest 4.x (unit), Playwright 1.57.x (E2E)
**Target Platform**: macOS-only (per Constitution Preamble)
**Project Type**: Electron application (main + renderer processes)
**Performance Goals**: <2s cold start (Article V); keystroke latency unaffected (AI operations are async, no blocking of editor input)
**Constraints**: <5MB renderer bundle (Article V), AI SDK ~67KB core fits budget
**Scale/Scope**: Support 5-10 provider configurations (SC-005)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Article | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| II | TypeScript 5.9.x strict: true | ✅ PASS | All code uses strict TypeScript |
| II | React 19.x | ✅ PASS | UI components use React 19 |
| II | Zustand 5.x + Immer 11.x | ✅ PASS | Store uses zustand/immer middleware |
| II | zod 4.x validation | ✅ PASS | All IPC schemas use zod |
| III.1 | Main process owns file/native APIs | ✅ PASS | Credentials in main process only |
| III.2 | contextIsolation: true | ✅ PASS | No changes to security settings |
| III.2 | sandbox: true | ✅ PASS | No changes to security settings |
| III.3 | invoke/handle IPC pattern | ✅ PASS | All channels use invoke/handle |
| III.3 | zod validation both ends | ✅ PASS | Schemas defined in shared/ |
| III.3 | Max 10 top-level channels | ✅ PASS | 5 invoke/handle domains (provider, credential, generate, usage, capability) + 3 streaming send/on channels (stream:chunk, stream:complete, stream:error) |
| III.3 | Channel naming mdxpad:<domain>:<action> | ✅ PASS | e.g., mdxpad:ai:provider:add |
| V | Cold start < 2s | ⏳ TBD | Verify after implementation |
| V | Renderer bundle < 5MB | ✅ PASS | AI SDK in main process, ~67KB only |
| VI.1 | No `any` without comment | ✅ PASS | All types explicit |
| VI.2 | Functions max 50 lines | ✅ PASS | Design follows limit |
| VI.2 | Files max 400 lines | ✅ PASS | Services split appropriately |
| VI.4 | >80% unit coverage | ⏳ TBD | Enforce during implementation |

## Project Structure

### Documentation (this feature)

```text
specs/028-ai-provider-abstraction/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 implementation guide
├── contracts/
│   ├── ipc-channels.md     # IPC contract definitions
│   └── service-interfaces.md # Service interface contracts
├── checklists/
│   └── requirements.md     # Specification quality checklist
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── ipc/
│   │   └── ai-handlers.ts          # IPC handler registration
│   └── services/
│       └── ai/
│           ├── index.ts              # Service exports
│           ├── credential-service.ts  # safeStorage wrapper
│           ├── provider-service.ts    # Provider CRUD
│           ├── capability-service.ts  # Capability detection
│           ├── ai-service.ts          # AI SDK integration
│           ├── usage-service.ts       # Usage tracking
│           ├── onboarding-service.ts  # Onboarding analytics
│           └── registries/
│               ├── openai-registry.ts    # Static capabilities
│               └── anthropic-registry.ts # Static capabilities
├── renderer/
│   └── features/
│       └── ai-provider/
│           ├── index.ts              # Feature exports
│           ├── store.ts              # Zustand store
│           ├── hooks.ts              # React hooks
│           └── components/
│               ├── ProviderSettings.tsx
│               ├── ProviderList.tsx
│               ├── ProviderForm.tsx
│               ├── UsageStats.tsx
│               └── CapabilityBadge.tsx
└── shared/
    └── ai/
        ├── types.ts                  # Shared type definitions
        ├── schemas.ts                # Zod schemas
        └── ipc-channels.ts           # IPC channel definitions

tests/
├── unit/
│   └── services/
│       └── ai/
│           ├── credential-service.test.ts
│           ├── provider-service.test.ts
│           ├── capability-service.test.ts
│           ├── ai-service.test.ts
│           └── usage-service.test.ts
├── integration/
│   └── ai/
│       ├── provider-lifecycle.test.ts
│       └── credential-storage.test.ts
└── e2e/
    └── ai-provider/
        ├── configure-provider.test.ts
        └── switch-provider.test.ts
```

**Structure Decision**: Single Electron application with main/renderer process separation. All AI operations (credential storage, API calls, usage tracking) execute in main process. Renderer contains only UI components and Zustand store synchronized via IPC.

## Key Technical Decisions

### From Research Phase

1. **Credential Storage**: Electron's `safeStorage` API
   - Uses macOS Keychain natively
   - No external dependencies (keytar is archived)
   - Session-only fallback for keychain failures (FR-013)

2. **AI SDK**: Vercel AI SDK v6 (`@ai-sdk/*`)
   - Unified API across all providers
   - ~67KB core bundle (Constitution V compliant)
   - Native streaming support (FR-017)
   - Modular provider packages

3. **Capability Detection**: Hybrid Static + Dynamic
   - Static registry for OpenAI/Anthropic (no capability APIs)
   - Dynamic probing for Ollama (`/api/show` endpoint)
   - Cache with 5-minute TTL for local providers

## Complexity Tracking

> No Constitution violations requiring justification.

| Aspect | Complexity | Justification |
|--------|------------|---------------|
| 6 main process services | Moderate | Clear separation of concerns; each <400 lines |
| Hybrid capability detection | Low | Simple switch on provider type |
| Session-only credential fallback | Low | Required by FR-013, single if/else branch |

## Next Steps

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement in order: shared types → main services → IPC handlers → renderer UI
3. Validate SC-001 through SC-006 after implementation
