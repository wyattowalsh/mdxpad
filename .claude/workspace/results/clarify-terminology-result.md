# Terminology Ambiguity Analysis: AI Provider Abstraction Layer

**Category**: Terminology
**Spec**: `/Users/ww/dev/projects/mdxpad-ai/.specify/specs/028-ai-provider-abstraction/spec.md`
**Analysis Date**: 2026-01-17

---

## Glossary Terms Defined

The spec provides explicit definitions in the "Key Entities" section:

| Term | Definition | Status |
|------|------------|--------|
| Provider | AI service (OpenAI, Anthropic, local) with configuration, credentials, and connection status | Clear |
| Credential | Securely stored API key or authentication token associated with a provider | Clear |
| UsageRecord | Tracks individual AI requests including provider, tokens used, timestamp, and estimated cost | Clear |
| ProviderConfig | User-facing configuration for a provider including display name, type, and settings | Clear |

---

## Ambiguity Findings

### 1. "Active provider" vs "selected provider" vs "current provider"

- **Category**: Terminology
- **Status**: Partial
- **Observation**: The spec uses "active provider" in FR-005 and the glossary input, but User Story 2 also uses "active provider indicator" and "different provider as active". The term is mostly consistent but never explicitly defined in the Key Entities section. Additionally, "currently selected provider" could be used interchangeably.
- **Question Candidate**: Should the glossary include an explicit definition for "Active provider" as the canonical term, and should synonyms like "selected provider" or "current provider" be listed as deprecated/avoided terms?
- **Impact Score**: 2
- **Rationale**: Low impact because usage is reasonably consistent throughout the spec, but explicit glossary inclusion would improve clarity.

---

### 2. "API key" vs "Credential" vs "authentication token"

- **Category**: Terminology
- **Status**: Partial
- **Observation**: The spec uses "Credential" as a formal entity but also uses "API key" extensively (16+ occurrences). The Key Entities section defines Credential as "API key or authentication token" but doesn't establish when to use which term. User scenarios consistently use "API key" while requirements use both.
- **Question Candidate**: Should "API key" be the user-facing term and "Credential" the technical/storage term? Should the glossary clarify that "Credential" is the canonical term encompassing both API keys and authentication tokens?
- **Impact Score**: 3
- **Rationale**: Medium impact because this affects UI copy, error messages, and documentation consistency. Users may be confused if the UI says "Credential" when they're thinking "API key".

---

### 3. "Local model" vs "Local Model Provider" vs "Local endpoint"

- **Category**: Terminology
- **Status**: Partial
- **Observation**: The spec uses multiple related terms:
  - "local models" (general concept)
  - "Local Model provider type" (User Story 4)
  - "local endpoint" (acceptance scenarios)
  - "Local model providers" (FR-009)

  These terms are related but not explicitly distinguished.
- **Question Candidate**: Should "Local provider" be the canonical term for this provider type, with "local model" and "local endpoint" being subsidiary terms? Or should all three be defined in the glossary with their relationships?
- **Impact Score**: 2
- **Rationale**: Low-medium impact. The context makes meaning clear, but explicit definitions would improve implementation consistency (e.g., what appears in the UI dropdown).

---

### 4. "Provider configuration" vs "ProviderConfig" vs "provider settings"

- **Category**: Terminology
- **Status**: Partial
- **Observation**: The spec defines "ProviderConfig" as a key entity but also uses:
  - "provider configurations" (FR-010, Success Criteria)
  - "provider settings" (User Story 1)
  - "AI Provider Settings" (User Story 1 acceptance scenarios)
  - "configuration UI" (User Story 4)

  It's unclear if these all refer to the same thing or if "settings" is the UI and "configuration" is the data model.
- **Question Candidate**: Should "ProviderConfig" be the data entity, "AI Provider Settings" the UI panel name, and "provider configuration" the general action/concept? Should these distinctions be explicit in the glossary?
- **Impact Score**: 3
- **Rationale**: Medium impact because this affects UI labeling, documentation, and code naming conventions.

---

### 5. "Keychain" terminology across platforms

- **Category**: Terminology
- **Status**: Clear
- **Observation**: The spec correctly lists all three platform-specific terms (macOS Keychain, Windows Credential Manager, Linux Secret Service) in FR-002. The glossary input lists only "Keychain" as a generic term.
- **Question Candidate**: N/A - No question needed. The spec handles this well.
- **Impact Score**: 1
- **Rationale**: Minimal impact. Could add "Secure storage" as a platform-agnostic umbrella term in the glossary for consistency.

---

### 6. "BYOK" (Bring Your Own Key)

- **Category**: Terminology
- **Status**: Clear
- **Observation**: Defined in the glossary input and used consistently in User Story 2 context. Only used twice in the spec (feature input and User Story 2 priority justification).
- **Question Candidate**: N/A - Well defined and consistently used.
- **Impact Score**: 1
- **Rationale**: Minimal impact. Acronym is industry-standard and properly defined.

---

### 7. "Connection status" vs "connected" vs "connection state"

- **Category**: Terminology
- **Status**: Partial
- **Observation**: The spec uses:
  - "connection status" (Key Entities - Provider)
  - "Connected" (User Story 1 acceptance)
  - "connection status" (User Story 2)
  - "connectivity" (User Story 1, Edge Cases)

  These appear to be the same concept but without explicit definition of possible states.
- **Question Candidate**: Should the glossary define "Connection status" with its possible states (e.g., Connected, Disconnected, Validating, Error)? This would clarify what "shows as Connected" means.
- **Impact Score**: 2
- **Rationale**: Low-medium impact. Affects UI design and status indicators but the general meaning is clear.

---

### 8. "Provider abstraction layer" vs "unified interface"

- **Category**: Terminology
- **Status**: Clear
- **Observation**: FR-001 uses "unified interface" and FR-014 uses "provider abstraction layer". These refer to the same architectural concept but from different perspectives (user-facing vs technical).
- **Question Candidate**: N/A - The distinction is appropriate (user-facing requirement vs architectural requirement).
- **Impact Score**: 1
- **Rationale**: Minimal impact. Both terms are appropriate in their contexts.

---

## Summary Table

| # | Term/Issue | Status | Impact | Action Required |
|---|------------|--------|--------|-----------------|
| 1 | Active provider undefined | Partial | 2 | Add to Key Entities glossary |
| 2 | API key vs Credential usage | Partial | 3 | Clarify user-facing vs technical terms |
| 3 | Local model/provider/endpoint | Partial | 2 | Standardize canonical term |
| 4 | ProviderConfig vs settings | Partial | 3 | Distinguish UI vs data model terms |
| 5 | Keychain cross-platform | Clear | 1 | No action needed |
| 6 | BYOK | Clear | 1 | No action needed |
| 7 | Connection status states | Partial | 2 | Define valid states |
| 8 | Abstraction layer vs unified interface | Clear | 1 | No action needed |

---

## Overall Assessment

| Status | Count | Terms |
|--------|-------|-------|
| Clear | 4 | Provider, Credential (entity), UsageRecord, ProviderConfig, BYOK, Keychain, Provider abstraction layer |
| Partial | 5 | Active provider, API key vs Credential (usage), Local model variants, Provider configuration variants, Connection status |
| Missing | 0 | None |

---

## Recommendations

1. **Add to glossary**: "Active provider" - The currently selected provider that will be used for AI features
2. **Clarify usage pattern**: "API key" for user-facing contexts, "Credential" for technical/storage contexts
3. **Standardize**: "Local provider" as the canonical provider type name
4. **Distinguish**: "AI Provider Settings" (UI panel) vs "ProviderConfig" (data entity)
5. **Consider defining**: Connection status states for UI consistency

---

## Questions for Clarification (Priority Order)

1. **(Impact 3)** **API key vs Credential**: When should each term be used? Is "API key" user-facing and "Credential" technical?

2. **(Impact 3)** **Provider configuration terminology**: What's the canonical UI panel name vs entity name vs action?

3. **(Impact 2)** **Active provider**: Should this be added to the formal glossary as a Key Entity?

4. **(Impact 2)** **Local provider terminology**: What's the canonical term for this provider type?

5. **(Impact 2)** **Connection status states**: Should valid states be enumerated (e.g., Connected, Disconnected, Validating, Error)?
