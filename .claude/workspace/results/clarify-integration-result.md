# Integration Ambiguity Analysis for Spec 028-ai-provider-abstraction

**Analyzed**: 2026-01-17
**Category Focus**: Integration (External Services/APIs, Failure Modes, Data Formats, Protocol/Versioning)
**Spec**: 028-ai-provider-abstraction

---

## Summary

| Status | Count |
|--------|-------|
| Clear | 0 |
| Partial | 3 |
| Missing | 7 |

---

## 1. API Version Compatibility Strategy

- **Category:** Integration
- **Status:** Missing
- **Location:** Assumptions (API stability assumption)

**What's Specified:**
- "AI providers maintain reasonably stable APIs with published pricing information"

**What's Missing:**
- No strategy for handling API version changes from providers (OpenAI, Anthropic)
- No specification of whether to pin to specific API versions, auto-upgrade, or provide configurable version selection
- No deprecation handling policy

**Question Candidate:** How should the system handle API version changes from providers (OpenAI, Anthropic)? Should it pin to specific API versions, auto-upgrade, or provide configurable version selection?

**Impact Score:** 5

---

## 2. OpenAI-Compatible Endpoint Compliance Level

- **Category:** Integration
- **Status:** Partial
- **Location:** Assumptions (local model compatibility)

**What's Specified:**
- "Local model providers expose OpenAI-compatible endpoints (common standard)"

**What's Missing:**
- No specification of which OpenAI endpoints must be supported
- Different local providers (Ollama, LM Studio, llama.cpp, text-generation-webui) implement varying subsets
- No clarification on `/v1/chat/completions` vs `/v1/completions` vs `/v1/embeddings` vs `/v1/models`

**Question Candidate:** What level of OpenAI-compatible API compliance is required for local models? Should the system support only `/v1/chat/completions` or also `/v1/completions`, `/v1/embeddings`, and `/v1/models` endpoints?

**Impact Score:** 4

---

## 3. Connection Failure and Retry Behavior

- **Category:** Integration
- **Status:** Missing
- **Location:** FR-014 (uniform behavior requirement)

**What's Specified:**
- "System MUST provide a provider abstraction layer that enables AI features to work uniformly across different providers"

**What's Missing:**
- No specification for transient failure handling (network timeouts, rate limits, 5xx errors)
- No retry policy (exponential backoff, max attempts, jitter)
- No failover strategy to alternative providers
- Cloud and local providers have very different failure characteristics

**Question Candidate:** What should happen when a provider connection fails? Should the system implement automatic retries with exponential backoff, failover to alternative providers, or simply surface errors to users?

**Impact Score:** 4

---

## 4. Rate Limiting Handling

- **Category:** Integration
- **Status:** Missing
- **Location:** Not addressed

**What's Specified:**
- Mentions "published pricing information" in assumptions

**What's Missing:**
- No handling for OpenAI 429 responses or Anthropic rate limits
- No specification for request queuing or throttling
- No user notification strategy for rate limit encounters
- Different providers have different rate limiting models (TPM, RPM, tokens per day)

**Question Candidate:** How should the system handle rate limiting from cloud providers (OpenAI 429, Anthropic rate limits)? Should it queue requests, inform users of wait times, or provide rate limit status visibility?

**Impact Score:** 4

---

## 5. Authentication Protocol Details

- **Category:** Integration
- **Status:** Missing
- **Location:** FR-009, Provider entity

**What's Specified:**
- "System MUST support local model providers that don't require API keys"
- Provider entity includes "credentials"

**What's Missing:**
- No specification of authentication methods beyond API keys
- No OAuth token support for enterprise scenarios
- No Azure AD authentication (for Azure OpenAI)
- No proxy authentication for enterprise environments

**Question Candidate:** What authentication methods must be supported beyond API keys? Should the system support OAuth tokens, Azure AD authentication (for Azure OpenAI), or proxy authentication for enterprise environments?

**Impact Score:** 3

---

## 6. Local Model Discovery Protocol

- **Category:** Integration
- **Status:** Partial
- **Location:** User Story 4

**What's Specified:**
- "Given user enters a valid local endpoint, When they test connection, Then available models are listed"

**What's Missing:**
- No specification of model discovery endpoint
- Ollama uses `/api/tags`, LM Studio uses `/v1/models`
- Some providers require model names to be known in advance
- No handling for providers that don't support model listing

**Question Candidate:** How should the system discover available models from local providers? Should it call `/v1/models` endpoint, use provider-specific APIs (e.g., Ollama's `/api/tags`), or require manual model specification?

**Impact Score:** 3

---

## 7. Streaming Response Protocol

- **Category:** Integration
- **Status:** Missing
- **Location:** Not addressed

**What's Specified:**
- Nothing about streaming responses

**What's Missing:**
- No specification of Server-Sent Events (SSE) streaming support
- OpenAI and Anthropic use SSE with different event formats
- No handling for streaming failures mid-response
- No buffering or partial response recovery strategy

**Question Candidate:** Must the provider abstraction support Server-Sent Events (SSE) streaming for real-time token delivery? How should streaming failures mid-response be handled?

**Impact Score:** 4

---

## 8. Credential Storage and Transmission Security

- **Category:** Integration
- **Status:** Missing
- **Location:** Provider entity (credentials)

**What's Specified:**
- Provider entity includes "credentials" and "connection status"

**What's Missing:**
- No security requirements for API key storage
- No specification of OS keychain integration vs encrypted storage vs in-memory only
- No secure transmission requirements (TLS version, certificate validation)
- API keys are high-value secrets requiring secure handling

**Question Candidate:** How should API keys be stored securely and transmitted to providers? Should the system use OS keychain integration, encrypted storage, or in-memory only?

**Impact Score:** 5

---

## 9. Network Proxy and Corporate Firewall Support

- **Category:** Integration
- **Status:** Missing
- **Location:** Not addressed

**What's Specified:**
- Nothing about network configuration

**What's Missing:**
- No HTTP/HTTPS proxy support specification
- No proxy authentication methods
- Corporate environments often block direct API access
- No SOCKS proxy or VPN tunnel considerations

**Question Candidate:** Should the system support HTTP/HTTPS proxies for corporate environments where direct API access is blocked? What proxy authentication methods should be supported?

**Impact Score:** 3

---

## 10. API Response Format Normalization

- **Category:** Integration
- **Status:** Partial
- **Location:** FR-014

**What's Specified:**
- "System MUST provide a provider abstraction layer that enables AI features to work uniformly across different providers"

**What's Missing:**
- No normalized response schema defined
- OpenAI uses `choices[0].message.content`, Anthropic uses `content[0].text`
- No specification of which metadata to preserve/normalize (usage stats, finish reasons, tool calls)
- No error response normalization strategy

**Question Candidate:** How should the abstraction layer normalize response formats across providers (e.g., OpenAI's `choices[0].message.content` vs Anthropic's `content[0].text`)? What fields must be preserved/normalized?

**Impact Score:** 4

---

## Summary Table

| # | Ambiguity | Status | Impact |
|---|-----------|--------|--------|
| 1 | API Version Compatibility Strategy | Missing | 5 |
| 2 | OpenAI-Compatible Endpoint Compliance | Partial | 4 |
| 3 | Connection Failure and Retry Behavior | Missing | 4 |
| 4 | Rate Limiting Handling | Missing | 4 |
| 5 | Authentication Protocol Details | Missing | 3 |
| 6 | Local Model Discovery Protocol | Partial | 3 |
| 7 | Streaming Response Protocol | Missing | 4 |
| 8 | Credential Storage Security | Missing | 5 |
| 9 | Network Proxy Support | Missing | 3 |
| 10 | API Response Format Normalization | Partial | 4 |

---

## Recommended Clarification Questions (Prioritized by Impact)

1. **(Impact 5)** How should API keys be stored securely and transmitted to providers? Should the system use OS keychain integration, encrypted storage, or in-memory only?

2. **(Impact 5)** How should the system handle API version changes from providers (OpenAI, Anthropic)? Should it pin to specific API versions, auto-upgrade, or provide configurable version selection?

3. **(Impact 4)** How should the abstraction layer normalize response formats across providers? What fields must be preserved/normalized?

4. **(Impact 4)** Must the provider abstraction support Server-Sent Events (SSE) streaming for real-time token delivery? How should streaming failures mid-response be handled?

5. **(Impact 4)** What should happen when a provider connection fails? Should the system implement automatic retries with exponential backoff, failover to alternative providers, or simply surface errors to users?

---

## Conclusion

The spec has **10 integration touchpoints** analyzed:
- **0 Clear**: No integration aspects are fully specified
- **3 Partial**: OpenAI-compatible endpoint compliance, local model discovery, and response normalization have some direction but lack detail
- **7 Missing**: Critical integration concerns including API versioning, failure handling, rate limiting, streaming, security, and proxy support are not addressed

**High Impact Items (4-5):** 7 items require clarification before implementation can proceed safely.

**Critical Gap:** The most critical gaps are **credential security** (Impact 5) and **API version compatibility** (Impact 5). Without security specifications, implementation may expose API keys unsafely. Without versioning strategy, provider API changes could break the system unexpectedly.

**Recommended Action:** Address Impact 5 items (credential security, API versioning) and Impact 4 streaming/normalization items before detailed implementation planning.
