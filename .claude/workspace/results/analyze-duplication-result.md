# Duplication Analysis: Smart Filtering for File Tree (014)

**Analysis Date**: 2026-01-17
**Spec**: spec.md | **Plan**: plan.md | **Tasks**: tasks.md
**Focus**: Functional Requirements (FR-001 to FR-013), User Stories (US1-US5), and Tasks (T001-T024)

---

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|----|----------|-------------|---------|----------------|
| DUP-001 | MEDIUM | spec.md: FR-003 (line 116) + FR-003a (line 117) | FR-003 describes fuzzy matching, FR-003a adds case-insensitivity as a sub-requirement. While logically related, case-insensitivity could be folded into FR-003. The sub-numbering (FR-003a) creates ambiguity about whether it's a separate testable requirement. | Merge FR-003a into FR-003: "System MUST support sequential fuzzy matching (fzf-style) with case-insensitive comparison where query characters must appear in order within file/folder names, but not contiguously" |
| DUP-002 | MEDIUM | spec.md: US2 Scenario 4 (line 50) + FR-003a (line 117) | US2 Scenario 4 states "MYCOMP" or "mycomp" matches "MyComponent.tsx" (case-insensitive). FR-003a states "System MUST perform case-insensitive matching." These express the same requirement in different sections. | Keep FR-003a as normative requirement; treat US2 Scenario 4 as test case. Add cross-reference comment: "Tests FR-003a" |
| DUP-003 | MEDIUM | tasks.md: T020 (lines 337-341) + spec.md: Edge Cases (lines 104-108) | T020 explicitly lists edge cases (empty state, deep nesting, special chars, long query) that are already specified in spec.md. The task duplicates the edge case list rather than referencing it, creating maintenance burden if spec changes. | Reference spec.md edge cases rather than copying: "T020: Implement edge cases per spec.md lines 104-108" |
| DUP-004 | LOW | spec.md: US1 Scenario 4 (line 33) + FR-013 (line 127) | US1 Scenario 4: "the filter remains active and the filtered view persists" after file selection. FR-013: "System MUST persist the active filter when a file is selected." Near-identical requirement stated in scenario and requirement format. | Accept as intentional spec/test pairing pattern. US scenario serves as test case for FR-013. |
| DUP-005 | LOW | spec.md: US1 Scenario 1 (line 30) + FR-002 (line 115) | US1 Scenario 1: "only files and folders matching the query are displayed." FR-002: "System MUST filter the file tree to show only items matching the current query." Same concept in different phrasing. | Accept as intentional spec/test pairing pattern. |
| DUP-006 | LOW | spec.md: US4 Scenario 1 (line 80) + FR-006 (line 120) | US4 Scenario 1: "I press Cmd/Ctrl+Shift+F, Then the filter input receives focus." FR-006: "System MUST provide Cmd/Ctrl+Shift+F keyboard shortcut to focus the filter input." Near-identical statement. | Accept as intentional spec/test pairing pattern. |
| DUP-007 | LOW | spec.md: US5 Scenario 1 (line 96) + FR-007 (line 121) | US5 Scenario 1: "filter query is restored and applied to the file tree." FR-007: "System MUST persist the filter query across application sessions." Same persistence requirement in scenario vs. requirement format. | Accept as intentional spec/test pairing pattern. |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total Duplications Found | 7 |
| CRITICAL Severity | 0 |
| HIGH Severity | 0 |
| MEDIUM Severity | 3 |
| LOW Severity | 4 |
| Duplication Index | 3.2% (7 duplications across ~220 distinct statements) |

---

## Analysis Details

### Spec.md Duplication Patterns

The spec.md file follows a standard specification pattern where:
1. **User Stories** describe scenarios in Given/When/Then format (test-oriented)
2. **Functional Requirements (FR-xxx)** state the same requirements normatively (implementation-oriented)

This is an **intentional design pattern** (scenarios as test cases, FRs as implementation requirements) and should NOT be consolidated. Issues DUP-004 through DUP-007 reflect this pattern and are marked LOW severity.

### True Duplicates Requiring Attention

1. **DUP-001 (MEDIUM)**: FR-003 and FR-003a represent a structural issue. The sub-numbering suggests a related but distinct requirement, but case-insensitivity is intrinsic to the fuzzy matching specification. Consolidation would improve clarity.

2. **DUP-003 (MEDIUM)**: tasks.md T020 copies edge cases from spec.md rather than referencing them. This creates a maintenance burden - if edge cases are updated in spec.md, tasks.md must be manually synchronized.

### Tasks.md Quality Assessment

The tasks.md file demonstrates good organization:
- No duplicate task definitions
- Clear phase separation with proper sequencing
- No redundant gate validations
- User story tagging ([US1], [US2], etc.) provides traceability
- Dependency graph accurately reflects task relationships

### Plan.md Quality Assessment

The plan.md file has:
- No duplicate sections
- Clean separation of concerns (summary, context, structure, complexity)
- Constitution check table is comprehensive without redundancy
- No duplicate project structure definitions

### Cross-Document Consistency

| Check | Status |
|-------|--------|
| FR numbers match across spec/tasks | PASS |
| User story priorities consistent | PASS |
| Keyboard shortcut consistent | CONFLICT: spec says Cmd/Ctrl+Shift+F, tasks.md note says Mod+P due to conflict |
| Debounce timing consistent | PASS (50ms in all locations) |
| Performance targets consistent | PASS (100ms for 10k files) |

**Note**: The keyboard shortcut discrepancy (Cmd/Ctrl+Shift+F in spec vs Mod+P in tasks) is not duplication but a documented deviation. Tasks.md notes this change was made due to conflict with Find/Replace.

---

## Risk Assessment

### No High-Risk Issues

No duplications create implementation ambiguity or conflicting requirements.

### Medium-Risk Duplications (Should Fix)

- **DUP-001**: FR-003/FR-003a split creates minor ambiguity about requirement boundaries
- **DUP-002**: Case-insensitivity stated twice could lead to over-testing
- **DUP-003**: Edge case list copied to tasks creates sync maintenance burden

### Low-Risk Duplications (Acceptable)

- **DUP-004 through DUP-007**: These follow the standard spec/test pairing pattern and represent legitimate separation of concerns (requirements vs. test scenarios)

---

## Recommended Resolution Priority

1. **Before Implementation**: Fix DUP-001, DUP-003
   - Merge FR-003a into FR-003 for cleaner requirement numbering
   - Update T020 to reference spec.md edge cases by section rather than copying

2. **Documentation Enhancement**: Address DUP-002
   - Add cross-reference comment to US2 Scenario 4: "Validates FR-003a"

3. **No Action Required**: DUP-004 through DUP-007
   - These represent intentional spec/test separation
   - Maintain as-is for traceability purposes

---

## Conclusion

The Smart Filtering specification artifacts exhibit **minimal duplication (3.2% index)** with **no critical or high-severity issues**. The codebase follows good specification practices with clear separation between normative requirements (FR-xxx) and testable scenarios (User Stories).

The 3 medium-severity findings are straightforward to resolve:
1. Merge FR-003a into FR-003
2. Update T020 to reference spec.md edge cases
3. Add cross-reference comment to US2 Scenario 4

The 4 low-severity findings represent intentional design patterns and should be preserved for traceability.

**Overall Assessment**: The specification is well-structured and ready for implementation with minor cleanup recommended.
