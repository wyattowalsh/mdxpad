# Duplication Analysis: AI Provider Abstraction Layer

**Feature Branch**: `028-ai-provider-abstraction`
**Analysis Date**: 2026-01-17
**Files Analyzed**:
- spec.md (165 lines)
- plan.md (158 lines)
- tasks.md (977 lines)

---

## Summary

**Total Duplication Issues Found**: 7

| Severity | Count |
|----------|-------|
| High     | 1     |
| Medium   | 4     |
| Low      | 2     |

---

## Duplication Issues

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| DUP-001 | High | spec.md FR-001, FR-004, FR-014 | Near-duplicate provider capability requirements. FR-001 says "unified interface for configuring multiple AI providers", FR-004 says "allow users to add, edit, and remove provider configurations", FR-014 says "provide a provider abstraction layer supporting..." - all overlap on provider management abstraction. | Consolidate: FR-001 should cover the unified interface only, FR-004 covers CRUD operations, FR-014 covers AI operation types. Remove "configuring" from FR-001 since FR-004 handles that. |
| DUP-002 | Medium | spec.md FR-002 vs FR-013 | Overlapping credential storage requirements. FR-002 requires "store API credentials securely using the operating system's native keychain" while FR-013 handles "keychain access failures by prompting user to unlock; if unlock fails, offer session-only credentials". Both address secure credential storage. | Keep FR-002 for the happy path, FR-013 for fallback only. Add cross-reference "(see FR-013 for fallback)" to FR-002. |
| DUP-003 | Medium | tasks.md P:3.8 vs P:5.8 | Duplicate "index and exports" tasks. [P:3.8] "Create service index and exports" and [P:5.8] "Create feature index and exports" are structurally identical boilerplate tasks for different layers. | Acceptable duplication - different scopes (main vs renderer). Consider templating but no action required. |
| DUP-004 | Medium | spec.md US5 vs FR-011 | User Story 5 acceptance scenario 1 ("API key is displayed in masked format") duplicates FR-011 ("mask sensitive credential information in the UI"). | Remove explicit masking detail from US5.1, reference FR-011 instead: "...API key is displayed per FR-011". |
| DUP-005 | Medium | plan.md "Key Technical Decisions" vs tasks.md Phase 3 descriptions | Capability detection approach stated twice: plan.md says "Hybrid Static + Dynamic" with "Static registry for OpenAI/Anthropic (no capability APIs), Dynamic probing for Ollama". tasks.md P:3.4 repeats: "Static registry lookup for OpenAI/Anthropic, Dynamic probe for Ollama". | Acceptable - tasks.md serves as standalone reference. However, ensure single source of truth if approach changes. |
| DUP-006 | Low | spec.md FR-006 vs FR-007 | Slight overlap in usage tracking scope. FR-006: "track usage metrics per provider including request count and token usage". FR-007: "provide usage statistics viewable by time period". FR-006 covers tracking, FR-007 covers viewing, but "metrics" and "statistics" are used interchangeably. | Clarify terminology: FR-006 = "record" usage, FR-007 = "query/view" usage. Change FR-006 to "System MUST record usage metrics..." |
| DUP-007 | Low | tasks.md FR Coverage annotations | Multiple tasks claim coverage of FR-001: P:1.1, P:2.1, P:2.2, P:2.3, P:3.8, P:5.1, P:5.2, P:5.8. This suggests FR-001 is too broad or FR Coverage is imprecise. | Narrow FR-001 scope or use sub-requirements (FR-001a, FR-001b) to improve traceability. Currently FR-001 acts as catch-all. |

---

## Metrics

| Metric | Value |
|--------|-------|
| Requirements (FRs) | 18 |
| User Stories | 5 |
| Tasks | 30 |
| Unique FR references in tasks | 18 |
| Tasks with multiple FR coverage | 12 (40%) |
| Cross-document redundancy instances | 3 |

---

## Recommendations Summary

1. **Consolidate FR-001/FR-004/FR-014** - Highest impact, reduces requirement ambiguity
2. **Add cross-references** between related FRs (e.g., FR-002 -> FR-013) to clarify relationships
3. **Standardize terminology** - use "record" vs "query" for usage tracking distinction
4. **Consider sub-requirements** for broad FRs like FR-001 to improve traceability

---

## No Issues Found In

- Entity definitions (Provider, Credential, UsageRecord, ProviderConfig) are defined once in spec.md and referenced elsewhere
- Task dependencies are well-structured without circular or duplicate paths
- IPC channel definitions appear in one location (tasks.md P:2.3)
- Zod schema definitions appear in one location (tasks.md P:2.2)
