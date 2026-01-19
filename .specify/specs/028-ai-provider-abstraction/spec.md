# Feature Specification: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Created**: 2026-01-17
**Status**: Draft
**Input**: User description: "AI Provider Abstraction Layer - BYOK (Bring Your Own Key) architecture for AI features. Support for multiple providers (OpenAI, Anthropic, local models). Provider configuration UI with API key management. Usage tracking and cost estimation. Secure credential storage using system keychain."

## Clarifications

### Session 2026-01-17

- Q: How are rate limits from providers surfaced to users? → A: Show wait time + offer to switch providers
- Q: What AI features consume this abstraction? → A: Text generation, embeddings, image generation, agents, multiagent systems, deep agents
- Q: What is the fallback behavior when keychain is unavailable? → A: Prompt to unlock keychain; if unavailable, offer session-only credentials
- Q: Should the abstraction support streaming responses? → A: Require streaming with non-streaming fallback
- Q: How should SC-006 (95% first-provider success rate) be measured? → A: Automated onboarding analytics tracking completion rate

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure First AI Provider (Priority: P1)

A user wants to start using AI features in mdxpad by adding their first AI provider. They open the provider settings, select a provider (e.g., OpenAI), enter their API key, and save. The system securely stores the credential and validates connectivity.

**Why this priority**: Without at least one configured provider, no AI features can function. This is the foundational capability that enables all AI-powered functionality.

**Independent Test**: Can be fully tested by configuring a single provider with a valid API key and verifying that the provider appears as "connected" in the settings UI.

**Acceptance Scenarios**:

1. **Given** no providers are configured, **When** user opens AI Provider Settings, **Then** an empty state with "Add Provider" prompt is displayed
2. **Given** user selects "Add Provider", **When** they choose OpenAI and enter a valid API key, **Then** the key is stored securely and provider shows as "Connected"
3. **Given** user enters an invalid API key, **When** they attempt to save, **Then** a clear validation error is displayed without storing the invalid key (E2E test: `configure-provider.test.ts#invalid-key`)
4. **Given** user has configured a provider, **When** they restart the application, **Then** the provider configuration persists and remains connected

---

### User Story 2 - Switch Between Providers (Priority: P2)

A user has multiple AI providers configured (e.g., OpenAI and Anthropic) and wants to switch which one is used for AI features. They access a provider selector and choose their preferred provider, with the change taking effect immediately.

**Why this priority**: Multi-provider support is a core differentiator for BYOK architecture. Users need flexibility to use different providers based on their preferences, costs, or feature availability.

**Independent Test**: Can be tested by configuring two providers, switching between them, and verifying that the active provider indicator updates correctly.

**Acceptance Scenarios**:

1. **Given** user has multiple providers configured, **When** they open provider settings, **Then** all configured providers are listed with their connection status
2. **Given** user selects a different provider as active, **When** the selection is confirmed, **Then** the active provider changes immediately
3. **Given** a provider's API key becomes invalid (detected via 401 response during validation), **When** user attempts to switch to it, **Then** a re-authentication modal prompts for new API key

---

### User Story 3 - View Usage Statistics (Priority: P3)

A user wants to understand their AI usage patterns and costs. They access a usage dashboard showing request counts, token usage, and estimated costs per provider over configurable time periods.

**Why this priority**: Cost visibility helps users manage their AI spending and make informed decisions about which providers to use. Important for budget-conscious users but not blocking core functionality.

**Independent Test**: Can be tested by making several AI requests and verifying that usage metrics (request count, tokens) are accurately displayed in the usage dashboard.

**Acceptance Scenarios**:

1. **Given** user has made AI requests, **When** they open usage statistics, **Then** total requests and token usage are displayed per provider
2. **Given** user selects a time period (day/week/month/all-time), **When** the view updates, **Then** all displayed statistics (requests, tokens, costs) are filtered to the selected period
3. **Given** provider pricing is available, **When** viewing statistics, **Then** estimated costs are calculated and displayed
4. **Given** provider pricing is NOT available, **When** viewing statistics, **Then** costs display "N/A" with tooltip "Pricing not available for this model"

---

### User Story 4 - Configure Local Model Provider (Priority: P3)

A user wants to use a local AI model (e.g., Ollama, LM Studio) instead of cloud providers for privacy or offline use. They configure the local endpoint and verify connectivity.

**Why this priority**: Local model support is valuable for privacy-conscious users and offline scenarios, but is an advanced use case that builds on the core provider abstraction.

**Independent Test**: Can be tested by configuring a local model endpoint and verifying successful connection and model listing.

**Acceptance Scenarios**:

1. **Given** user selects "Local Model" provider type, **When** configuration UI appears, **Then** endpoint URL field is displayed (no API key required)
2. **Given** user enters a valid local endpoint, **When** they test connection, **Then** available models are listed
3. **Given** local endpoint is unreachable, **When** user tests connection, **Then** error displays "Cannot connect to [endpoint]" with hints: "Verify Ollama/LM Studio is running" and "Check the endpoint URL"

---

### User Story 5 - Manage API Key Security (Priority: P2)

A user wants to update or remove an existing API key, or verify that their credentials are stored securely. They can view masked key previews, rotate keys, and remove providers.

**Why this priority**: Security is critical for credential management. Users need confidence that their API keys are protected and have full control over credential lifecycle.

**Independent Test**: Can be tested by adding a provider, verifying the key is masked, updating the key, and then removing the provider entirely.

**Acceptance Scenarios**:

1. **Given** a provider is configured, **When** user views provider details, **Then** API key is displayed per FR-011 masking requirements
2. **Given** user wants to update a key, **When** they enter a new key and save, **Then** the old key is replaced in secure storage (verified: CredentialService.setCredential overwrites existing)
3. **Given** user removes a provider, **When** deletion is confirmed, **Then** all associated credentials are purged from secure storage (verified: CredentialService.clearCredential called; integration test asserts hasCredential returns null)

---

### Edge Cases

- **Keychain locked/unavailable**: Prompt user to unlock; if unavailable, offer session-only credentials (memory-only, lost on restart). Display banner: "Credentials stored in memory only - will be lost on restart."
- **Network connectivity loss during validation**: Validation times out after 10 seconds. Display error: "Unable to reach provider. Check your network connection and try again." Offer retry button.
- **Provider API changes/deprecation**: Out of scope for this iteration. Future: detect HTTP 410 Gone or version mismatch headers and display "Provider API has changed. Please update the application."
- **Rate limit errors**: Display wait time from Retry-After header if present; otherwise show "Rate limited. Try again in a few minutes." Offer list of alternate configured providers to switch to.
- **Usage tracking storage limits**: Automatic FIFO pruning when exceeding 100,000 records. Retain last 90 days. No user notification (silent pruning).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a unified interface for multiple AI providers (OpenAI, Anthropic, Ollama, LM Studio, OpenAI-compatible endpoints)
- **FR-002**: System MUST store API credentials securely using the operating system's native keychain (macOS Keychain via Electron safeStorage); see FR-013 for fallback behavior
- **FR-003**: System MUST validate provider credentials before storing (10-second timeout, 1 retry with exponential backoff) and display connection status
- **FR-004**: System MUST allow users to add, edit, and remove provider configurations
- **FR-005**: System MUST support designating one provider as the "active" provider for AI features
- **FR-006**: System MUST record usage data per provider including request count, token usage, and timestamp; retain records for 90 days maximum with 100,000 record cap (FIFO pruning)
- **FR-007**: System MUST query and display usage statistics by time period (day, week, month, all-time)
- **FR-008**: System MUST calculate and display estimated costs using hardcoded pricing tables (updated with each app release); when pricing is unavailable for a model, display "Cost: N/A"
- **FR-009**: System MUST support local model providers that don't require API keys; local endpoints must use http:// or https:// schemes with valid port numbers (1-65535); warn on non-localhost URLs
- **FR-010**: System MUST persist provider configurations across application restarts
- **FR-011**: System MUST mask sensitive credential information in the UI by default (showing format "sk-...abc123"); full key reveal via toggle is permitted without re-authentication since keychain access already validated
- **FR-012**: System MUST provide clear error messages when provider connections fail, including: error type (authentication, network, rate limit), actionable guidance, and retry option when applicable
- **FR-013**: System MUST handle keychain access failures by prompting user to unlock; if unlock fails, offer session-only credentials (memory-only, lost on restart)
- **FR-014**: System MUST provide a provider abstraction layer supporting: text generation (chat/completion), embeddings, image generation, and agent execution (single-agent, multi-agent, and autonomous deep-agent patterns all use unified `agent-execution` operation type)
- **FR-015**: System MUST display provider rate limit errors with estimated wait time (parse Retry-After header if present; otherwise display "Try again in a few minutes") and offer to switch to an alternate configured provider
- **FR-016**: System MUST detect and expose provider capability matrix (which features each provider supports)
- **FR-017**: System MUST support streaming responses for text generation, with automatic fallback to non-streaming for providers that don't support it
- **FR-018**: System MUST track onboarding completion analytics locally (provider configuration success/failure/abandonment rates)

### Key Entities

- **Provider**: Represents an AI service (OpenAI, Anthropic, local) with its configuration, credentials, and connection status
- **Credential**: Securely stored API key or authentication token associated with a provider
- **UsageRecord**: Tracks individual AI requests including provider, tokens used, timestamp, and estimated cost
- **ProviderConfig**: User-facing configuration for a provider including display name, type, and settings

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can configure a new AI provider and start using AI features within 2 minutes (timer starts when user clicks "Add Provider"; ends when provider shows "Connected" status)
- **SC-002**: API credentials are never stored in plain text or logged; all storage uses OS-native secure storage
- **SC-003**: Provider switching takes effect immediately with no application restart required
- **SC-004**: Usage statistics are accurate within 1% of actual provider-reported usage (verified by comparing local UsageService token counts against AI SDK response metadata for 100+ test requests)
- **SC-005**: System supports at least 5 different provider configurations simultaneously (implementation cap: 10 providers for UX)
- **SC-006**: 95% first-attempt provider configuration success rate (measured via OnboardingService: success = provider reaches "connected" status within single add-provider flow; failure = abandonment or error before connected status)

## Assumptions

- Users have valid API keys from their chosen AI providers (BYOK model)
- The operating system provides a functional secure credential storage mechanism (Keychain/Credential Manager/Secret Service)
- AI providers expose OpenAI-compatible or documented SDK APIs; pricing tables are bundled with app (updated per release)
- Local model providers expose OpenAI-compatible endpoints (common standard)
- Usage tracking data can be stored locally without privacy concerns (no telemetry to external services)

## Out of Scope

- Automatic API key provisioning or account creation with providers
- Billing management or payment processing
- Provider-specific advanced features (fine-tuning, embeddings configuration)
- Multi-user credential sharing or team management
- Automatic provider failover (manual switching only in this iteration)
