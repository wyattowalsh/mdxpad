# Ambiguity Analysis: 006-Application-Shell spec.md

## Summary
Analyzed spec.md (349 lines) against FR-001 to FR-042 functional requirements, SC-001 to SC-010 success criteria, and non-functional requirements for ambiguity issues.

**Total Ambiguity Issues Found: 4**

---

## Detailed Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|
| AMB-001 | HIGH | FR-006, Line 184 | "Custom titlebar region MUST be marked as a drag region" - no quantification of which DOM elements qualify or how they're identified. "Interactive elements excluded" lacks specification of which elements are interactive (buttons, links, input fields?). | Define explicit selector pattern or component prop for identifying interactive regions. Example: "All elements with `data-no-drag` attribute or `.no-drag` class are interactive regions. Button, input, and anchor elements within the drag region are non-interactive by default." |
| AMB-002 | MEDIUM | SC-003, Line 269 | "Restored within 100ms of app launch (no visible flash)" - "visible flash" is subjective. What constitutes a visible flash? Needs measurable definition (e.g., "screen rendered with default state for >16ms before preferences applied" or "DOM shows old values before update"). | Replace vague "visible flash" with objective metric: "Preferences must be applied before first paint" or "First visual frame must contain user preferences, not defaults" with acceptance test showing before/after timing. |
| AMB-003 | MEDIUM | SC-009, Line 275 | "MUST maintain at least 60 frames per second (16.67ms frame budget)" - spec says "at least 60 FPS" but then adds "with no dropped frames during continuous interaction." These are contradictory: maintaining 60 FPS allows ~1 dropped frame per second, while "no dropped frames" means 0 drops. | Clarify: either "maintain stable 60 FPS with <5% frame drops allowed" OR "zero dropped frames at 60+ FPS" - pick one and justify why. If zero drops required, acknowledge performance is much stricter than 60 FPS minimum. |
| AMB-004 | MEDIUM | FR-031b, Line 230 | "Error details popover MUST display... (4) dismiss on click outside or Escape key. Popover positioned below the error count badge with arrow pointing to badge." - "below" is positional but doesn't account for viewport edges. What happens if popover would render off-screen (e.g., error count near bottom)? Auto-position above? Clamp to viewport? | Specify collision behavior: "If positioned below would exceed viewport bounds, position above instead. Clamp horizontal position to remain fully visible within window bounds." |

---

## Requirements Coverage Assessment

### Functional Requirements (FR-001 to FR-042)
- **FR-001 to FR-005**: Clear and testable
- **FR-006**: **AMBIGUOUS** - Drag region marking not precisely defined (see AMB-001)
- **FR-007 to FR-032**: Clear with measurable criteria
- **FR-031a, FR-031b**: **AMBIGUOUS** - Popover positioning behavior incomplete (see AMB-004)
- **FR-033 to FR-042**: Clear and testable

### Success Criteria (SC-001 to SC-010)
- **SC-001**: Clear ("under 5 seconds excluding typing time")
- **SC-002**: Clear (500ms)
- **SC-003**: **AMBIGUOUS** - "Visible flash" undefined (see AMB-002)
- **SC-004 to SC-006**: Clear with precise metrics
- **SC-007**: Clear
- **SC-008**: Clear (2 seconds)
- **SC-009**: **AMBIGUOUS** - Contradictory frame rate requirements (see AMB-003)
- **SC-010**: Clear with recovery scenarios defined

### Non-Functional Requirements
- **Performance section**: Vague terms ("not cause visible jank") but not critical to implementation since more specific SCs override
- **Reliability section**: Clear with specific requirements
- **Accessibility section**: Clear requirements
- **Maintainability section**: Clear architectural directives

---

## Vague Terms Audit
The following terms appear but are either:
1. Defined by success criteria with measurable values, or
2. Used in accepted technical contexts

| Term | Location | Status | Notes |
|---|---|---|---|
| "real-time" | SC-002 | ✓ Quantified | Defined as "within 500ms of typing pause" |
| "visible jank" | NFR Performance | ⚠ Informal | Not critical; SC-009 provides measurable alternative (60 FPS) |
| "user-friendly error message" | FR-023 | ⚠ Subjective | Acceptable - implementation detail; clear intent of "not cryptic" |
| "gracefully" | FR-023 | ✓ Defined by context | Combined with SC-010 for error recovery behavior |
| "no visible flash" | SC-003 | ✗ Undefined | **AMBIGUOUS** - needs measurable definition (see AMB-002) |

---

## Unresolved Placeholders Check
✓ **PASS** - No unresolved placeholders (TODO, TKTK, ???, etc.) found in spec

---

## Testing Feasibility Assessment

| Category | Status | Notes |
|---|---|---|
| FR requirements | TESTABLE | All FRs have clear acceptance scenarios or measurable criteria |
| SC criteria | MOSTLY TESTABLE | SC-003 and SC-009 require clarification |
| Non-functional | TESTABLE | Measurable performance targets defined in SCs |

---

## Recommendations Priority

### P0 (Resolve before implementation)
1. **AMB-003** (SC-009) - Frame rate contradiction must be resolved; conflicting requirements can cause acceptance failures

### P1 (Resolve before testing)
2. **AMB-001** (FR-006) - Drag region specification needed for QA verification
3. **AMB-002** (SC-003) - "Visible flash" definition needed for performance acceptance testing

### P2 (Resolve before production)
4. **AMB-004** (FR-031b) - Popover positioning edge cases impact UX quality

---

## Conclusion

**Spec Quality: GOOD** - Ambiguity is limited to 4 issues, mostly edge cases and visual behaviors. The core 32 functional requirements and 8 core success criteria are well-defined and testable. The three high-priority issues should be resolved before implementation begins, particularly the contradictory frame rate requirement in SC-009.

### Next Steps
1. Clarify SC-009 frame rate requirement with stakeholder
2. Define SC-003 "visible flash" with technical acceptance test
3. Add drag region selector specification to FR-006
4. Add popover collision handling behavior to FR-031b
