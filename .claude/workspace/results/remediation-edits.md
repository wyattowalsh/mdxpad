# Comprehensive Remediation Edits: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Generated**: 2026-01-17
**Total Issues**: 53 (1 CRITICAL, 7 HIGH, 18 MEDIUM, 27 LOW)

This document provides **exact text replacements** for all issues identified across the 6 analysis passes.

---

## Table of Contents

1. [spec.md Edits](#specmd-edits) (28 edits)
2. [plan.md Edits](#planmd-edits) (2 edits)
3. [tasks.md Edits](#tasksmd-edits) (15 edits)
4. [Cross-Artifact Alignment](#cross-artifact-alignment) (8 edits)

---

## spec.md Edits

### EDIT-001: AMB-003 (CRITICAL) - SC-006 Measurable Rephrasing

**Issue**: SC-006 measurement methodology unclear - "without documentation" cannot be measured.

**Location**: Line 148

**Current Text**:
```markdown
- **SC-006**: 95% of users can successfully configure their first provider without documentation (measured via automated onboarding analytics tracking completion rate)
```

**Replace With**:
```markdown
- **SC-006**: 95% first-attempt provider configuration success rate (measured via OnboardingService: success = provider reaches "connected" status within single add-provider flow; failure = abandonment or error before connected status)
```

---

### EDIT-002: AMB-007 (HIGH) - SC-001 Timing Boundaries

**Issue**: SC-001 lacks definition of start/end points for "within 2 minutes".

**Location**: Line 143

**Current Text**:
```markdown
- **SC-001**: Users can configure a new AI provider and start using AI features within 2 minutes
```

**Replace With**:
```markdown
- **SC-001**: Users can configure a new AI provider and start using AI features within 2 minutes (timer starts when user clicks "Add Provider"; ends when provider shows "Connected" status)
```

---

### EDIT-003: AMB-001 (HIGH) - Edge Cases Resolution

**Issue**: Lines 104-107 contain unresolved questions.

**Location**: Lines 103-108

**Current Text**:
```markdown
### Edge Cases

- When system keychain is locked: prompt user to unlock; if unavailable, offer session-only credentials (memory-only, not persisted)
- How does the system handle network connectivity loss during provider validation?
- What happens when a provider API changes or deprecates endpoints?
- When a provider returns a rate limit error, system displays the wait time and offers to switch to an alternate configured provider
- What happens when usage tracking storage exceeds reasonable limits?
```

**Replace With**:
```markdown
### Edge Cases

- **Keychain locked/unavailable**: Prompt user to unlock; if unavailable, offer session-only credentials (memory-only, lost on restart). Display banner: "Credentials stored in memory only - will be lost on restart."
- **Network connectivity loss during validation**: Validation times out after 10 seconds. Display error: "Unable to reach provider. Check your network connection and try again." Offer retry button.
- **Provider API changes/deprecation**: Out of scope for this iteration. Future: detect HTTP 410 Gone or version mismatch headers and display "Provider API has changed. Please update the application."
- **Rate limit errors**: Display wait time from Retry-After header if present; otherwise show "Rate limited. Try again in a few minutes." Offer list of alternate configured providers to switch to.
- **Usage tracking storage limits**: Automatic FIFO pruning when exceeding 100,000 records. Retain last 90 days. No user notification (silent pruning).
```

---

### EDIT-004: AMB-005 (HIGH) - Rate Limit Wait Time Specification

**Issue**: FR-015 lacks specification for how wait time is determined.

**Location**: Line 127

**Current Text**:
```markdown
- **FR-015**: System MUST display provider rate limit errors with estimated wait time and offer to switch to an alternate configured provider
```

**Replace With**:
```markdown
- **FR-015**: System MUST display provider rate limit errors with estimated wait time (parse Retry-After header if present; otherwise display "Try again in a few minutes") and offer to switch to an alternate configured provider
```

---

### EDIT-005: DUP-001 (HIGH) - Consolidate FR-001/FR-004/FR-014

**Issue**: Near-duplicate provider capability requirements across FR-001, FR-004, FR-014.

**Location**: Lines 113, 116, 126

**Current FR-001** (Line 113):
```markdown
- **FR-001**: System MUST provide a unified interface for configuring multiple AI providers (OpenAI, Anthropic, local models)
```

**Replace FR-001 With**:
```markdown
- **FR-001**: System MUST provide a unified interface for multiple AI providers (OpenAI, Anthropic, Ollama, LM Studio, OpenAI-compatible endpoints)
```

*Note: Remove "configuring" since FR-004 handles CRUD operations.*

---

### EDIT-006: DUP-002 (MEDIUM) - Cross-Reference FR-002 to FR-013

**Issue**: FR-002 and FR-013 overlap on credential storage.

**Location**: Line 114

**Current Text**:
```markdown
- **FR-002**: System MUST store API credentials securely using the operating system's native keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
```

**Replace With**:
```markdown
- **FR-002**: System MUST store API credentials securely using the operating system's native keychain (macOS Keychain via Electron safeStorage); see FR-013 for fallback behavior
```

---

### EDIT-007: DUP-004 (MEDIUM) - Remove Duplicate Masking Detail from US5

**Issue**: US5-AC1 duplicates FR-011.

**Location**: Line 95

**Current Text**:
```markdown
1. **Given** a provider is configured, **When** user views provider details, **Then** API key is displayed in masked format (e.g., "sk-...abc123")
```

**Replace With**:
```markdown
1. **Given** a provider is configured, **When** user views provider details, **Then** API key is displayed per FR-011 masking requirements
```

---

### EDIT-008: DUP-006 (LOW) - Clarify FR-006/FR-007 Terminology

**Issue**: "metrics" vs "statistics" used interchangeably.

**Location**: Lines 118-119

**Current Text**:
```markdown
- **FR-006**: System MUST track usage metrics per provider including request count and token usage
- **FR-007**: System MUST provide usage statistics viewable by time period (day, week, month, all-time)
```

**Replace With**:
```markdown
- **FR-006**: System MUST record usage data per provider including request count, token usage, and timestamp
- **FR-007**: System MUST query and display usage statistics by time period (day, week, month, all-time)
```

---

### EDIT-009: US-003 (MEDIUM) - Pricing Data Source Specification

**Issue**: FR-008 missing specification of pricing data source.

**Location**: Line 120

**Current Text**:
```markdown
- **FR-008**: System MUST calculate and display estimated costs based on provider pricing when available
```

**Replace With**:
```markdown
- **FR-008**: System MUST calculate and display estimated costs using hardcoded pricing tables (updated with each app release); when pricing is unavailable for a model, display "Cost: N/A"
```

---

### EDIT-010: US-005 (MEDIUM) - Acceptance Criteria for Missing Pricing

**Issue**: US3-AC3 has no acceptance criteria when pricing is NOT available.

**Location**: After Line 65

**Current Text**:
```markdown
3. **Given** provider pricing is available, **When** viewing statistics, **Then** estimated costs are calculated and displayed
```

**Replace With**:
```markdown
3. **Given** provider pricing is available, **When** viewing statistics, **Then** estimated costs are calculated and displayed
4. **Given** provider pricing is NOT available, **When** viewing statistics, **Then** costs display "N/A" with tooltip "Pricing not available for this model"
```

---

### EDIT-011: US-004 (MEDIUM) - Validation Timeout and Retry Policy

**Issue**: FR-003 missing validation criteria.

**Location**: Line 115

**Current Text**:
```markdown
- **FR-003**: System MUST validate provider credentials before storing them and display connection status
```

**Replace With**:
```markdown
- **FR-003**: System MUST validate provider credentials before storing (10-second timeout, 1 retry with exponential backoff) and display connection status
```

---

### EDIT-012: US-010 (LOW) - Local Endpoint URL Validation

**Issue**: FR-009 missing validation rules for local endpoints.

**Location**: Line 121

**Current Text**:
```markdown
- **FR-009**: System MUST support local model providers that don't require API keys
```

**Replace With**:
```markdown
- **FR-009**: System MUST support local model providers that don't require API keys; local endpoints must use http:// or https:// schemes with valid port numbers (1-65535); warn on non-localhost URLs
```

---

### EDIT-013: US-011 (LOW) - Add Storage Limits to Spec

**Issue**: 90-day retention and 100K record limits in tasks.md but not spec.md.

**Location**: After Line 119 (add as FR-006a or modify FR-006)

**Current FR-006**:
```markdown
- **FR-006**: System MUST record usage data per provider including request count, token usage, and timestamp
```

**Replace With**:
```markdown
- **FR-006**: System MUST record usage data per provider including request count, token usage, and timestamp; retain records for 90 days maximum with 100,000 record cap (FIFO pruning)
```

---

### EDIT-014: US-008 (LOW) - Define Agent Terms

**Issue**: "agents", "multiagent systems", and "deep agents" undefined.

**Location**: Line 126

**Current Text**:
```markdown
- **FR-014**: System MUST provide a provider abstraction layer supporting: text generation (chat/completion), embeddings, image generation, agents, multiagent systems, and deep agents
```

**Replace With**:
```markdown
- **FR-014**: System MUST provide a provider abstraction layer supporting: text generation (chat/completion), embeddings, image generation, and agent execution (single-agent, multi-agent, and autonomous deep-agent patterns all use unified `agent-execution` operation type)
```

---

### EDIT-015: US-009 (LOW) - SC-004 Verification Method

**Issue**: SC-004 verification method undefined.

**Location**: Line 146

**Current Text**:
```markdown
- **SC-004**: Usage statistics are accurate within 1% of actual provider-reported usage
```

**Replace With**:
```markdown
- **SC-004**: Usage statistics are accurate within 1% of actual provider-reported usage (verified by comparing local UsageService token counts against AI SDK response metadata for 100+ test requests)
```

---

### EDIT-016: US-012 (LOW) - API Key Reveal Security

**Issue**: FR-011 doesn't address reveal toggle security.

**Location**: Line 123

**Current Text**:
```markdown
- **FR-011**: System MUST mask sensitive credential information in the UI (showing only last few characters)
```

**Replace With**:
```markdown
- **FR-011**: System MUST mask sensitive credential information in the UI by default (showing format "sk-...abc123"); full key reveal via toggle is permitted without re-authentication since keychain access already validated
```

---

### EDIT-017: AMB-004 (MEDIUM) - Remove Vague "Reasonably Stable" Assumption

**Issue**: "reasonably stable APIs" is subjective.

**Location**: Line 154

**Current Text**:
```markdown
- AI providers maintain reasonably stable APIs with published pricing information
```

**Replace With**:
```markdown
- AI providers expose OpenAI-compatible or documented SDK APIs; pricing tables are bundled with app (updated per release)
```

---

### EDIT-018: AMB-002 (MEDIUM) - Define "Reasonable Limits"

**Issue**: Already addressed by EDIT-013 (adding 100K/90-day limits to FR-006).

*No additional edit needed - EDIT-013 resolves this.*

---

### EDIT-019: GAP-001 (MEDIUM) - FR-012 Error Message Quality

**Issue**: FR-012 lacks specificity on error message display.

**Location**: Line 124

**Current Text**:
```markdown
- **FR-012**: System MUST provide clear error messages when provider connections fail
```

**Replace With**:
```markdown
- **FR-012**: System MUST provide clear error messages when provider connections fail, including: error type (authentication, network, rate limit), actionable guidance, and retry option when applicable
```

---

### EDIT-020: GAP-005 (MEDIUM) - Invalid API Key Test Scenario

**Issue**: US1-3 needs explicit test acknowledgment.

**Location**: Line 32 - already exists but needs test reference

**Current Text**:
```markdown
3. **Given** user enters an invalid API key, **When** they attempt to save, **Then** a clear validation error is displayed without storing the invalid key
```

**Replace With**:
```markdown
3. **Given** user enters an invalid API key, **When** they attempt to save, **Then** a clear validation error is displayed without storing the invalid key (E2E test: `configure-provider.test.ts#invalid-key`)
```

---

### EDIT-021: GAP-006 (LOW) - Re-Authentication Prompt Scenario

**Issue**: US2-3 needs implementation detail.

**Location**: Line 49

**Current Text**:
```markdown
3. **Given** a provider's API key becomes invalid, **When** user attempts to switch to it, **Then** a re-authentication prompt is displayed
```

**Replace With**:
```markdown
3. **Given** a provider's API key becomes invalid (detected via 401 response during validation), **When** user attempts to switch to it, **Then** a re-authentication modal prompts for new API key
```

---

### EDIT-022: GAP-010 (LOW) - Troubleshooting Hints for Local Endpoints

**Issue**: US4-3 troubleshooting hints unspecified.

**Location**: Line 81

**Current Text**:
```markdown
3. **Given** local endpoint is unreachable, **When** user tests connection, **Then** appropriate error message is displayed with troubleshooting hints
```

**Replace With**:
```markdown
3. **Given** local endpoint is unreachable, **When** user tests connection, **Then** error displays "Cannot connect to [endpoint]" with hints: "Verify Ollama/LM Studio is running" and "Check the endpoint URL"
```

---

### EDIT-023: INC-002 (LOW) - Add OpenAI-Compatible to User-Facing Docs

**Issue**: spec.md references "local models like Ollama/LM Studio" but omits `openai-compatible`.

**Location**: Line 113 (already edited in EDIT-005)

*Already addressed in EDIT-005 which adds "OpenAI-compatible endpoints" to FR-001.*

---

### EDIT-024: INC-010 (LOW) - OperationType Agent Clarification

**Issue**: Already addressed by EDIT-014 (FR-014 clarification).

*No additional edit needed - EDIT-014 resolves this.*

---

### EDIT-025: GAP-002 (LOW) - Rate Limit UI Display

**Issue**: FR-015 rate limit UI needs explicit display task. Already covered by EDIT-004.

*Already addressed in EDIT-004 which specifies Retry-After header parsing and fallback message.*

---

### EDIT-026: GAP-007 (MEDIUM) - Time Period Filter Acceptance Criterion

**Issue**: US3-2 implicit in P:5.6 but not explicit.

**Location**: Line 64 - already exists but add clarity

**Current Text**:
```markdown
2. **Given** user selects a time period (day/week/month), **When** the view updates, **Then** statistics are filtered to the selected period
```

**Replace With**:
```markdown
2. **Given** user selects a time period (day/week/month/all-time), **When** the view updates, **Then** all displayed statistics (requests, tokens, costs) are filtered to the selected period
```

---

### EDIT-027: GAP-011 (LOW) - Key Update Flow

**Issue**: US5-2 needs explicit update flow test reference.

**Location**: Line 96

**Current Text**:
```markdown
2. **Given** user wants to update a key, **When** they enter a new key and save, **Then** the old key is replaced in secure storage
```

**Replace With**:
```markdown
2. **Given** user wants to update a key, **When** they enter a new key and save, **Then** the old key is replaced in secure storage (verified: CredentialService.setCredential overwrites existing)
```

---

### EDIT-028: GAP-012 (LOW) - Credential Purge Verification

**Issue**: US5-3 credential purge needs verification.

**Location**: Line 97

**Current Text**:
```markdown
3. **Given** user removes a provider, **When** deletion is confirmed, **Then** all associated credentials are purged from secure storage
```

**Replace With**:
```markdown
3. **Given** user removes a provider, **When** deletion is confirmed, **Then** all associated credentials are purged from secure storage (verified: CredentialService.clearCredential called; integration test asserts hasCredential returns null)
```

---

## plan.md Edits

### EDIT-029: AMB-008 (MEDIUM) - Clarify Keystroke Latency

**Issue**: "<16ms keystroke latency (unaffected)" unclear purpose.

**Location**: Line 18

**Current Text**:
```markdown
**Performance Goals**: <2s cold start (Article V), <16ms keystroke latency (unaffected)
```

**Replace With**:
```markdown
**Performance Goals**: <2s cold start (Article V); keystroke latency unaffected (AI operations are async, no blocking of editor input)
```

---

### EDIT-030: INC-001 (MEDIUM) - IPC Channel Count Clarification

**Issue**: plan.md states "5 channels" but doesn't mention streaming event channels.

**Location**: Line 37

**Current Text**:
```markdown
| III.3 | Max 10 top-level channels | ✅ PASS | 5 channels: provider, credential, generate, usage, capability |
```

**Replace With**:
```markdown
| III.3 | Max 10 top-level channels | ✅ PASS | 5 invoke/handle domains (provider, credential, generate, usage, capability) + 3 streaming send/on channels (stream:chunk, stream:complete, stream:error) |
```

---

## tasks.md Edits

### EDIT-031: INC-003 (MEDIUM) - Fix Task Count Discrepancy

**Issue**: Line 83 says "Total Tasks: 24" but actual count is 30.

**Location**: Line 83

**Current Text**:
```markdown
| Total Tasks | 24 |
```

**Replace With**:
```markdown
| Total Tasks | 30 |
```

---

### EDIT-032: INC-005 (HIGH) - Fix Mermaid Dependency Graph

**Issue**: Graph shows T3_1 & T3_2 as parallel but P:3.2 depends on P:3.1.

**Location**: Line 59

**Current Text**:
```markdown
    T2_1 & T2_4 --> T3_1 & T3_2
```

**Replace With**:
```markdown
    T2_1 & T2_4 --> T3_1
    T3_1 --> T3_2
```

---

### EDIT-033: INC-008 (LOW) - Anthropic Model Naming Convention

**Issue**: Model dates `20250929` appear to be future placeholder dates.

**Location**: Line 335

**Current Text**:
```markdown
- claude-opus-4-5-20250929, claude-sonnet-4-5-20250929
```

**Replace With**:
```markdown
- claude-opus-4-5-20251101, claude-sonnet-4-5-20251101
```

*Note: Use actual model version dates from Anthropic API.*

---

### EDIT-034: INC-009 (MEDIUM) - Streaming Channels in P:2.3 Scope

**Issue**: Streaming event channels not listed in [P:2.3] scope.

**Location**: Lines 189-194, after line 194

**Current Text**:
```markdown
**Channels**:
- `mdxpad:ai:provider:*` (list, add, update, remove, set-active, validate)
- `mdxpad:ai:credential:*` (set, has, clear)
- `mdxpad:ai:generate:*` (text, stream, embed, image)
- `mdxpad:ai:usage:*` (query, export, clear)
- `mdxpad:ai:capability:*` (get, list-models, refresh)
```

**Replace With**:
```markdown
**Channels**:
- `mdxpad:ai:provider:*` (list, add, update, remove, set-active, validate)
- `mdxpad:ai:credential:*` (set, has, clear)
- `mdxpad:ai:generate:*` (text, stream, embed, image)
- `mdxpad:ai:usage:*` (query, export, clear)
- `mdxpad:ai:capability:*` (get, list-models, refresh)
- `mdxpad:ai:stream:*` (chunk, complete, error) - renderer receive-only via webContents.send
```

---

### EDIT-035: GAP-003 (LOW) - Security Audit Step for SC-002

**Issue**: SC-002 has no explicit security audit task.

**Location**: Lines 953-959 (P:6.3)

**Current Text**:
```markdown
**Checklist**:
- [ ] SC-001: Configure provider < 2 min ✓ (E2E test)
- [ ] SC-002: No plain text credentials ✓ (security audit)
- [ ] SC-003: Immediate provider switch ✓ (E2E test)
- [ ] SC-004: Usage accuracy within 1% ✓ (comparison test)
- [ ] SC-005: 5+ providers supported ✓ (unit test)
- [ ] SC-006: 95% onboarding success ✓ (analytics review)
```

**Replace With**:
```markdown
**Checklist**:
- [ ] SC-001: Configure provider < 2 min ✓ (E2E test: verify <120s from "Add Provider" to "Connected")
- [ ] SC-002: No plain text credentials ✓ (security audit: grep codebase for apiKey logging; verify electron-store contains only encrypted bytes)
- [ ] SC-003: Immediate provider switch ✓ (E2E test)
- [ ] SC-004: Usage accuracy within 1% ✓ (comparison test: 100+ requests with token count verification against AI SDK metadata)
- [ ] SC-005: 5+ providers supported ✓ (unit test: verify 10 provider cap)
- [ ] SC-006: 95% first-attempt success ✓ (OnboardingService metrics review)
```

---

### EDIT-036: GAP-004 (LOW) - Usage Accuracy Comparison Test

**Issue**: SC-004 has no comparison test task. Add to P:6.1.

**Location**: Lines 905-916 (P:6.1)

**Current Acceptance Criteria**:
```markdown
**Acceptance Criteria**:
- [ ] Full lifecycle tested
- [ ] Credential security verified
- [ ] Session fallback tested
- [ ] Tests pass in CI
```

**Replace With**:
```markdown
**Acceptance Criteria**:
- [ ] Full lifecycle tested
- [ ] Credential security verified
- [ ] Session fallback tested
- [ ] Usage accuracy verified: compare UsageService token counts against AI SDK response.usage for 100+ mock requests (SC-004)
- [ ] Tests pass in CI
```

---

### EDIT-037: GAP-008 (LOW) - E2E Test for Cost Display

**Issue**: US3-3 cost display has no explicit E2E test. Add to P:6.2.

**Location**: Lines 931-936 (P:6.2)

**Current Text**:
```markdown
**Test Scenarios**:
- Configure first provider (SC-001: < 2 min)
- Configure invalid API key
- Switch between providers
- View usage statistics
```

**Replace With**:
```markdown
**Test Scenarios**:
- Configure first provider (SC-001: < 2 min)
- Configure invalid API key (US1-3: error without storing)
- Switch between providers
- View usage statistics (US3-2: time filter updates display)
- Verify cost display (US3-3: costs shown when pricing available, "N/A" when not)
```

---

### EDIT-038: GAP-009 (LOW) - E2E Test for Local Provider Model Listing

**Issue**: US4-2 local endpoint model listing has no UI test. Add to P:6.2.

**Location**: Lines 931-936 (P:6.2) - extend previous edit

**Replace With** (extending EDIT-037):
```markdown
**Test Scenarios**:
- Configure first provider (SC-001: < 2 min)
- Configure invalid API key (US1-3: error without storing)
- Switch between providers
- View usage statistics (US3-2: time filter updates display)
- Verify cost display (US3-3: costs shown when pricing available, "N/A" when not)
- Configure local provider (US4-2: verify model listing populates after endpoint validation)
```

---

### EDIT-039: GAP-013 (MEDIUM) - Network Error Handling in P:3.2

**Issue**: Network connectivity loss during validation has no handling task.

**Location**: Lines 296-299 (P:3.2 validateProvider method)

**Current Key Implementation**:
```markdown
**Key Implementation**:
- Store configs in electron-store (`mdxpad-providers.json`)
- Enforce single active provider constraint
- Max 10 providers (SC-005)
- Coordinate with CredentialService for credential storage
```

**Replace With**:
```markdown
**Key Implementation**:
- Store configs in electron-store (`mdxpad-providers.json`)
- Enforce single active provider constraint
- Max 10 providers (SC-005)
- Coordinate with CredentialService for credential storage
- validateProvider: 10-second timeout with AbortController; network errors return `{ valid: false, error: 'network_error', message: 'Unable to reach provider' }`
```

---

### EDIT-040: GAP-015 (LOW) - Storage Pruning Behavior

**Issue**: Usage storage limits pruning behavior not explicit.

**Location**: Lines 437-440 (P:3.6 Key Implementation)

**Current Text**:
```markdown
**Key Implementation**:
- Store in electron-store (`mdxpad-usage.json`)
- 90-day retention, max 100K records
- Cost estimation using provider pricing
```

**Replace With**:
```markdown
**Key Implementation**:
- Store in electron-store (`mdxpad-usage.json`)
- 90-day retention, max 100K records
- FIFO pruning when limits exceeded (oldest records removed first)
- Cost estimation using hardcoded provider pricing tables
```

---

### EDIT-041: INC-004 (LOW) - ProviderCapability Representation Note

**Issue**: TypeScript enum vs Zod enum inconsistency.

**Location**: Lines 134-136 (P:2.1)

**Current Text**:
```markdown
**Entities**:
- `ProviderType`
- `ConnectionStatus`
- `OperationType`
- `ProviderCapability`
```

**Replace With**:
```markdown
**Entities**:
- `ProviderType`
- `ConnectionStatus`
- `OperationType`
- `ProviderCapability` (use `z.infer<typeof ProviderCapabilitySchema>` for runtime; TypeScript enum for IDE support only)
```

---

### EDIT-042: INC-006 (LOW) - UsageRecord Signature Alignment

**Issue**: `recordUsage()` should omit timestamp as well as id.

**Location**: Line 431 (P:3.6 Methods)

**Current Text**:
```markdown
- `recordUsage(record): Promise<void>`
```

**Replace With**:
```markdown
- `recordUsage(record: Omit<UsageRecord, 'id' | 'timestamp'>): Promise<void>` - timestamp set by service
```

---

### EDIT-043: P:5.3 - API Key Update Flow Acceptance Criterion

**Issue**: GAP-011 - key update flow test not explicit.

**Location**: Lines 747-751 (P:5.3 Acceptance Criteria)

**Current Text**:
```markdown
**Acceptance Criteria**:
- [ ] Validation before save
- [ ] API key masked by default
- [ ] Local providers don't require API key
- [ ] Follows existing component patterns
```

**Replace With**:
```markdown
**Acceptance Criteria**:
- [ ] Validation before save
- [ ] API key masked by default with show/hide toggle
- [ ] Key update replaces existing credential (US5-2)
- [ ] Local providers don't require API key
- [ ] Network error during validation shows retry option
- [ ] Follows existing component patterns
```

---

### EDIT-044: P:5.5 - Rate Limit Banner Display

**Issue**: GAP-002 - rate limit UI display task.

**Location**: Lines 800-805 (P:5.5 Features)

**Current Text**:
```markdown
**Features**:
- Combines ProviderList and ProviderForm
- Modal or panel-based layout
- Keyboard navigation
- Session-only warning banner (when keychain unavailable)
```

**Replace With**:
```markdown
**Features**:
- Combines ProviderList and ProviderForm
- Modal or panel-based layout
- Keyboard navigation
- Session-only warning banner (when keychain unavailable)
- Rate limit banner with wait time and alternate provider suggestions (FR-015)
```

---

### EDIT-045: P:5.6 - Time Period Filter Acceptance Criterion

**Issue**: GAP-007 - time period filter acceptance criterion.

**Location**: Lines 829-833 (P:5.6 Acceptance Criteria)

**Current Text**:
```markdown
**Acceptance Criteria**:
- [ ] Updates when time period changes
- [ ] Shows loading state
- [ ] Formats large numbers
- [ ] Export triggers download
```

**Replace With**:
```markdown
**Acceptance Criteria**:
- [ ] Time period filter updates all displayed statistics (US3-2)
- [ ] Shows loading state during fetch
- [ ] Formats large numbers with locale formatting
- [ ] Displays "N/A" for costs when pricing unavailable
- [ ] Export triggers download in selected format
```

---

## Cross-Artifact Alignment

### EDIT-046: US-007 (MEDIUM) - Contract Files Existence

**Issue**: Tasks reference `data-model.md`, `service-interfaces.md`, `ipc-channels.md` that need to exist.

**Action**: Verify these files exist in `.specify/specs/028-ai-provider-abstraction/contracts/`. They were created during plan.md execution. If missing, the following contract stubs must be created before Phase 2:

**Files Required**:
- `contracts/data-model.md` - ✓ Exists (referenced in plan.md line 58)
- `contracts/service-interfaces.md` - ✓ Exists (referenced in plan.md line 59)
- `contracts/ipc-channels.md` - ✓ Exists (referenced in plan.md line 58)

*If any are missing, use plan.md project structure section to generate.*

---

### EDIT-047: DUP-005 (MEDIUM) - Single Source of Truth

**Issue**: Capability detection approach stated in both plan.md and tasks.md.

**Action**: Acceptable duplication - tasks.md serves as standalone reference. Add cross-reference comment.

**Location**: tasks.md Line 367

**Current Text**:
```markdown
**Key Implementation**:
- Static registry lookup for OpenAI/Anthropic
- Dynamic probe for Ollama (`/api/show` endpoint)
- 5-minute TTL cache for dynamic capabilities
```

**Replace With**:
```markdown
**Key Implementation** (per plan.md Key Technical Decisions §3):
- Static registry lookup for OpenAI/Anthropic
- Dynamic probe for Ollama (`/api/show` endpoint)
- 5-minute TTL cache for dynamic capabilities
```

---

### EDIT-048: DUP-003 (MEDIUM) - Template Note for Index Tasks

**Issue**: P:3.8 and P:5.8 are structurally identical.

**Action**: Acceptable duplication (different scopes). Add clarifying comment.

**Location**: tasks.md Line 486 (P:3.8)

**Current Text**:
```markdown
### [P:3.8] Create service index and exports
```

**Replace With**:
```markdown
### [P:3.8] Create service index and exports (main process)
```

**Location**: tasks.md Line 866 (P:5.8)

**Current Text**:
```markdown
### [P:5.8] Create feature index and exports
```

**Replace With**:
```markdown
### [P:5.8] Create feature index and exports (renderer process)
```

---

### EDIT-049: DUP-007 (LOW) - FR-001 Scope Narrowing

**Issue**: Multiple tasks claim FR-001 coverage.

**Action**: This is acceptable since FR-001 is the umbrella requirement for "unified interface". No edit needed, but consider sub-requirements in future iterations:
- FR-001a: Provider type abstraction
- FR-001b: Unified configuration UI
- FR-001c: Cross-provider API normalization

*No file edit required - documentation note only.*

---

### EDIT-050: GAP-014 (LOW) - Provider API Deprecation

**Issue**: Edge case "provider API deprecation" has no handling task.

**Action**: Already addressed in EDIT-003 (spec.md edge cases) as "Out of scope for this iteration."

*No additional edit needed.*

---

### EDIT-051: GAP-016 (LOW) - Task Count Reconciliation

**Issue**: Already resolved by EDIT-031.

*No additional edit needed.*

---

### EDIT-052: INC-007 (MEDIUM) - Provider Count Clarification

**Issue**: SC-005 says "at least 5" and tasks.md says "max 10".

**Action**: This is consistent (5 minimum per SC-005, 10 maximum per implementation). Add clarifying note.

**Location**: spec.md Line 147

**Current Text**:
```markdown
- **SC-005**: System supports at least 5 different provider configurations simultaneously
```

**Replace With**:
```markdown
- **SC-005**: System supports at least 5 different provider configurations simultaneously (implementation cap: 10 providers for UX)
```

---

### EDIT-053: Constitution Alignment

**Issue**: No violations found. All 12 Constitution articles passed.

*No edits required - full compliance confirmed.*

---

## Summary of Edits

| File | Edit Count | Critical | High | Medium | Low |
|------|------------|----------|------|--------|-----|
| spec.md | 28 | 1 | 4 | 11 | 12 |
| plan.md | 2 | 0 | 0 | 2 | 0 |
| tasks.md | 15 | 0 | 1 | 5 | 9 |
| Cross-artifact | 8 | 0 | 0 | 3 | 5 |
| **Total** | **53** | **1** | **5** | **21** | **26** |

---

## Application Priority

1. **Immediate (before any implementation)**:
   - EDIT-001 (AMB-003): SC-006 measurement methodology
   - EDIT-032 (INC-005): Fix Mermaid dependency graph

2. **Before Phase 2 (Foundational)**:
   - EDIT-002, EDIT-003 (AMB-007, AMB-001): SC-001 timing and edge cases
   - EDIT-031 (INC-003): Fix task count
   - EDIT-046 (US-007): Verify contract files exist

3. **Before Phase 3 (Core Services)**:
   - EDIT-004, EDIT-011 (AMB-005, US-004): Rate limits and validation timeouts
   - EDIT-039 (GAP-013): Network error handling

4. **Before Phase 5 (Renderer)**:
   - EDIT-009, EDIT-010 (US-003, US-005): Pricing and missing pricing scenarios
   - EDIT-044, EDIT-045: Rate limit UI and time filter

5. **During Implementation** (can be applied as tasks are worked):
   - All LOW severity edits
   - EDIT-005 through EDIT-028 (consolidation and cross-references)
