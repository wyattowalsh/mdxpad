# Data Model Ambiguity Analysis

**Spec**: 028-ai-provider-abstraction
**Category**: Data Model
**Analyzed**: 2026-01-17

---

## 1. Provider Entity - Attribute Completeness

**Status**: Partial

**Current Definition**: "Represents an AI service (OpenAI, Anthropic, local) with its configuration, credentials, and connection status"

**Question Candidate**: What are the complete attributes for the Provider entity? Specifically:
- Does Provider have a unique identifier (UUID, auto-increment)?
- What enumerated values define "type" (openai, anthropic, local, other)?
- Is "connection status" a computed/transient property or persisted?
- Does Provider store endpoint URL for all types or only local?
- Is there a "created_at" / "updated_at" timestamp?
- Does Provider store model selection/preference?

**Impact Score**: 5

**Rationale**: Provider is the central entity. Missing attribute clarity will cause implementation divergence and schema issues.

---

## 2. Provider vs ProviderConfig Relationship

**Status**: Missing

**Current Definition**: Both "Provider" and "ProviderConfig" are listed as separate entities but their relationship is undefined.

**Question Candidate**: What is the relationship between Provider and ProviderConfig?
- Are they 1:1 (ProviderConfig is just the user-facing subset)?
- Is ProviderConfig the persisted form while Provider is the runtime object?
- Can one Provider have multiple ProviderConfigs (e.g., different profiles)?
- Should these be merged into a single entity?

**Impact Score**: 5

**Rationale**: Unclear entity boundaries create confusion about where data lives and how it's managed.

---

## 3. Credential Entity - Structure & Storage

**Status**: Partial

**Current Definition**: "Securely stored API key or authentication token associated with a provider"

**Question Candidate**: What defines the Credential entity structure?
- Is Credential a separate persisted entity or embedded within Provider?
- How is the Provider-to-Credential relationship modeled (1:1, 1:N)?
- What attributes exist beyond the key value (e.g., key_prefix for masked display, created_at, last_used)?
- For local providers with no API key, is there still a Credential record (nullable) or is it omitted?

**Impact Score**: 4

**Rationale**: Credential storage architecture affects security implementation and keychain integration patterns.

---

## 4. UsageRecord - Identity & Uniqueness

**Status**: Missing

**Current Definition**: "Tracks individual AI requests including provider, tokens used, timestamp, and estimated cost"

**Question Candidate**: How is UsageRecord uniquely identified and structured?
- What is the primary key (timestamp + provider, UUID, auto-increment)?
- What are all attributes? (request_id, model, input_tokens, output_tokens, latency_ms, success/failure, error_code?)
- Is there a foreign key relationship to Provider?
- How is "estimated cost" calculated and stored (cached or computed)?
- What precision is used for cost (cents, fractional cents)?

**Impact Score**: 4

**Rationale**: Usage tracking is critical for cost estimation feature; incomplete schema affects query capabilities.

---

## 5. Provider Identity & Uniqueness Rules

**Status**: Missing

**Current Definition**: Not specified

**Question Candidate**: What uniqueness constraints apply to Provider?
- Can a user have multiple configurations for the same provider type (e.g., two OpenAI accounts)?
- What makes a Provider unique - type alone, type + display name, or a generated ID?
- How are duplicate provider configurations detected/prevented?

**Impact Score**: 4

**Rationale**: SC-005 states "at least 5 different provider configurations" but doesn't clarify if same-type duplicates count.

---

## 6. Provider Lifecycle & State Transitions

**Status**: Missing

**Current Definition**: "connection status" mentioned but states not enumerated

**Question Candidate**: What are the valid states and transitions for a Provider?
- What are the enumerated connection states (unconfigured, validating, connected, disconnected, error, rate_limited)?
- Can a provider be "disabled" without deletion (soft disable)?
- What triggers state transitions (user action, background polling, on-demand validation)?
- Is there a "last_validated" timestamp to track staleness?

**Impact Score**: 3

**Rationale**: State machine clarity affects UI feedback and background health-check implementation.

---

## 7. UsageRecord Data Volume & Retention

**Status**: Partial

**Current Definition**: Edge case mentions "What happens when usage tracking storage exceeds reasonable limits?" but no answer provided.

**Question Candidate**: What are the data volume assumptions and retention policies for UsageRecord?
- Expected records per day/month (10, 100, 1000+)?
- Maximum retention period before automatic pruning (30 days, 1 year, unlimited)?
- Storage format (SQLite, JSON file, IndexedDB)?
- Should aggregation be pre-computed (daily/weekly rollups) or computed on-demand?

**Impact Score**: 3

**Rationale**: Local storage without retention policy can grow unbounded; affects performance and storage design.

---

## 8. Provider Configuration Persistence Format

**Status**: Missing

**Current Definition**: FR-010 says "persist provider configurations" but format unspecified

**Question Candidate**: How should provider configuration data be persisted?
- What storage mechanism (electron-store, SQLite, JSON file)?
- Is configuration stored separately from credentials (config in file, credentials in keychain)?
- What is the schema version strategy for future migrations?
- Should settings be exportable/importable (backup/restore)?

**Impact Score**: 3

**Rationale**: Storage architecture decision affects data integrity, migration paths, and backup strategies.

---

## 9. Active Provider Designation

**Status**: Partial

**Current Definition**: FR-005 says "designating one provider as the 'active' provider" but mechanism unclear

**Question Candidate**: How is the "active" provider designation modeled?
- Is "active" a boolean flag on Provider or a separate setting (activeProviderId)?
- What happens if the active provider is deleted (auto-select another, null state)?
- Is there per-feature active provider support or global only?
- Can there be zero active providers (valid state)?

**Impact Score**: 3

**Rationale**: Active provider selection affects all downstream AI feature integrations.

---

## 10. Local Provider Model Selection

**Status**: Missing

**Current Definition**: User Story 4 mentions "available models are listed" but storage not addressed

**Question Candidate**: How are available models for local providers stored and selected?
- Are discovered models cached in ProviderConfig or fetched on-demand?
- Is there a "default_model" preference per provider?
- How is model selection persisted when user picks from available models?

**Impact Score**: 2

**Rationale**: Local providers may expose many models; selection persistence affects UX consistency.

---

## Summary

| # | Topic | Status | Impact |
|---|-------|--------|--------|
| 1 | Provider Entity Attributes | Partial | 5 |
| 2 | Provider vs ProviderConfig Relationship | Missing | 5 |
| 3 | Credential Entity Structure | Partial | 4 |
| 4 | UsageRecord Identity & Structure | Missing | 4 |
| 5 | Provider Uniqueness Rules | Missing | 4 |
| 6 | Provider Lifecycle States | Missing | 3 |
| 7 | UsageRecord Volume & Retention | Partial | 3 |
| 8 | Configuration Persistence Format | Missing | 3 |
| 9 | Active Provider Designation | Partial | 3 |
| 10 | Local Provider Model Selection | Missing | 2 |

**Total Ambiguities Found**: 10
**High Impact (4-5)**: 5
**Medium Impact (2-3)**: 5
