# Ambiguity Analysis: Spec 007 - MDX Content Outline/Navigator

**Analysis Date**: 2026-01-17
**Files Analyzed**:
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/spec.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/tasks.md`
- `/Users/ww/dev/projects/mdxpad/.specify/specs/007-mdx-content-outline/plan.md`

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 3     |
| MEDIUM   | 11    |
| LOW      | 8     |
| **Total** | **22** |

---

## HIGH Severity Ambiguities

### AMB-001
- **Severity**: HIGH
- **Location**: spec.md, line 114
- **Ambiguous Text**: "Truncate with ellipsis after ~40 characters"
- **Why Ambiguous**: The tilde (~) before 40 indicates "approximately," which introduces implementation uncertainty. Should truncation occur at 38, 40, or 42 characters? Different developers may interpret this differently, leading to inconsistent behavior.
- **Recommendation**: Change to: "Truncate with ellipsis after exactly 40 characters, breaking at the nearest word boundary if within 5 characters of the limit."

### AMB-002
- **Severity**: HIGH
- **Location**: spec.md, line 117
- **Ambiguous Text**: "Outline auto-hides when window width drops below threshold (similar to preview auto-hide behavior)"
- **Why Ambiguous**: References external behavior ("similar to") without specifying the exact thresholds. FR-004 later clarifies (600px/400px) but this edge case description creates confusion about whether the behavior should exactly match preview or just be "similar."
- **Recommendation**: Change to: "Outline auto-hides when window width drops below 600px (with preview visible) or 400px (with preview hidden), matching FR-004 thresholds."

### AMB-003
- **Severity**: HIGH
- **Location**: spec.md, line 146
- **Ambiguous Text**: "System MUST distinguish between built-in components (Callout, CodeBlock, etc.) and custom/unknown components visually"
- **Why Ambiguous**: The use of "etc." makes the built-in component list incomplete. Developers cannot know which components are considered "built-in" without referencing the clarification section (Q3) much later in the document. FR-014 should be self-contained.
- **Recommendation**: Change to: "System MUST distinguish between built-in components (Callout, Note, Warning, Tip, CodeBlock, Tabs, Tab, Card, Image, Link) and custom/unknown components visually"

---

## MEDIUM Severity Ambiguities

### AMB-004
- **Severity**: MEDIUM
- **Location**: spec.md, line 12
- **Ambiguous Text**: "See document structure at a glance"
- **Why Ambiguous**: "At a glance" is subjective and unmeasurable. What constitutes "at a glance" is user-dependent and cannot be tested.
- **Recommendation**: Change to: "See document structure in a single panel view without scrolling for documents with fewer than 50 outline items"

### AMB-005
- **Severity**: MEDIUM
- **Location**: spec.md, line 37
- **Ambiguous Text**: "the heading line is briefly highlighted to help the user locate it"
- **Why Ambiguous**: "Briefly" is vague until FR-022 specifies 500ms. The acceptance criterion should be self-contained.
- **Recommendation**: Change to: "the heading line is highlighted for 500ms (flash highlight) to help the user locate it"

### AMB-006
- **Severity**: MEDIUM
- **Location**: spec.md, line 151-152
- **Ambiguous Text**: "System MUST limit displayed frontmatter to common fields, with option to expand for all fields"
- **Why Ambiguous**: "Common fields" is undefined here. While Q4 clarifies (title, date, author, tags), FR-017 should specify this directly.
- **Recommendation**: Change to: "System MUST display title, date, author, and tags fields by default, with a 'Show all' toggle to reveal additional fields"

### AMB-007
- **Severity**: MEDIUM
- **Location**: spec.md, line 174
- **Ambiguous Text**: "System MUST fall back to a lightweight parser if preview AST is unavailable"
- **Why Ambiguous**: "Lightweight parser" is undefined. What makes a parser "lightweight"? What should this fallback parser do? No implementation guidance is provided.
- **Recommendation**: Change to: "System MUST fall back to a regex-based parser that extracts heading syntax (# through ######) if preview AST is unavailable, with parsing time under 20ms for documents up to 1000 lines"

### AMB-008
- **Severity**: MEDIUM
- **Location**: spec.md, line 209
- **Ambiguous Text**: "Outline parsing must not block the main thread or cause editor input lag"
- **Why Ambiguous**: "Input lag" is subjective without quantification. How much delay constitutes "lag"? This conflicts with Constitution Article V which specifies <16ms keystroke latency.
- **Recommendation**: Change to: "Outline parsing must run asynchronously and complete without adding more than 5ms to keystroke-to-render latency"

### AMB-009
- **Severity**: MEDIUM
- **Location**: spec.md, line 210
- **Ambiguous Text**: "Debounce outline updates to avoid excessive re-parsing during rapid typing"
- **Why Ambiguous**: "Rapid typing" is undefined. "Excessive" is subjective. What debounce interval should be used?
- **Recommendation**: Change to: "Debounce outline updates with a 300ms delay after the last keystroke to avoid re-parsing more than once per user pause"

### AMB-010
- **Severity**: MEDIUM
- **Location**: tasks.md, line 192
- **Ambiguous Text**: "Add Tailwind CSS styles for outline components including panel layout (w-[250px] min-w-[150px]), item hover states, indentation, truncation, and highlight animation"
- **Why Ambiguous**: Several styling aspects are unspecified: what color for hover states? What indentation increment per level? What highlight animation duration/style?
- **Recommendation**: Change to: "Add Tailwind CSS styles for outline components: panel layout (w-[250px] min-w-[150px]), item hover (bg-gray-100 dark:bg-gray-800), indentation (pl-4 per nesting level), text truncation (truncate class), and highlight animation (bg-yellow-200 transition-colors duration-500)"

### AMB-011
- **Severity**: MEDIUM
- **Location**: plan.md, line 28
- **Ambiguous Text**: "Performance Goals: <100ms navigation response, <50ms AST extraction overhead, <500ms outline update after typing"
- **Why Ambiguous**: "After typing" is ambiguous - does this mean after each keystroke, after a pause, or after debounce completes? Conflicts with the 500ms update requirement in FR-010.
- **Recommendation**: Change to: "Performance Goals: <100ms navigation response, <50ms AST extraction overhead, <500ms outline update after debounce timer fires (300ms after last keystroke)"

### AMB-012
- **Severity**: MEDIUM
- **Location**: plan.md, line 30
- **Ambiguous Text**: "Scale/Scope: Single document, typical documents ~500 lines"
- **Why Ambiguous**: "Typical" documents is vague. What about atypical documents? What is the maximum supported document size?
- **Recommendation**: Change to: "Scale/Scope: Single document, optimized for documents up to 500 lines, must remain functional for documents up to 5000 lines with graceful degradation"

### AMB-013
- **Severity**: MEDIUM
- **Location**: spec.md, line 163
- **Ambiguous Text**: "System MUST scroll the editor to center the target line in view when possible"
- **Why Ambiguous**: "When possible" is a vague conditional. Under what circumstances is centering not possible? What happens in those cases?
- **Recommendation**: Change to: "System MUST scroll the editor to center the target line in view. If the target line is within 5 lines of the document start or end, scroll to show the line at the top or bottom of the viewport respectively."

### AMB-014
- **Severity**: MEDIUM
- **Location**: spec.md, line 70
- **Ambiguous Text**: "they see each instance with its line number"
- **Why Ambiguous**: Line number format is unspecified. Should it be "Line 42", "L42", ":42", or just "42"?
- **Recommendation**: Change to: "they see each instance labeled as 'Line N' where N is the 1-based source line number"

---

## LOW Severity Ambiguities

### AMB-015
- **Severity**: LOW
- **Location**: spec.md, line 13
- **Ambiguous Text**: "Navigate instantly"
- **Why Ambiguous**: "Instantly" is hyperbole. SC-001 correctly specifies <100ms, making this marketing language rather than a specification.
- **Recommendation**: Change to: "Navigate quickly (under 100ms response time)"

### AMB-016
- **Severity**: LOW
- **Location**: spec.md, line 19
- **Ambiguous Text**: "providing real-time updates as the user edits"
- **Why Ambiguous**: "Real-time" is technically misleading since updates are debounced to 500ms per FR-010. This is near-real-time at best.
- **Recommendation**: Change to: "providing updates within 500ms as the user edits"

### AMB-017
- **Severity**: LOW
- **Location**: spec.md, line 95
- **Ambiguous Text**: "A writer working on a complex document"
- **Why Ambiguous**: "Complex" is subjective and undefined. What makes a document complex?
- **Recommendation**: Change to: "A writer working on a document with multiple nested sections and components"

### AMB-018
- **Severity**: LOW
- **Location**: spec.md, line 229
- **Ambiguous Text**: "The preview store will be extended to expose this AST as a subscribable field"
- **Why Ambiguous**: Passive voice hides responsibility. Who extends the preview store?
- **Recommendation**: Change to: "The implementation team SHALL extend the preview store to expose the parsed AST as a subscribable field."

### AMB-019
- **Severity**: LOW
- **Location**: spec.md, line 301-303
- **Ambiguous Text**: "These receive distinct visual styling in the outline. All other components display as custom/unknown."
- **Why Ambiguous**: "Distinct visual styling" is unspecified. What visual difference distinguishes built-in from custom?
- **Recommendation**: Change to: "Built-in components display with a filled badge icon and primary text color. Custom/unknown components display with an outlined badge icon and secondary (muted) text color."

### AMB-020
- **Severity**: LOW
- **Location**: tasks.md, line 103
- **Ambiguous Text**: "⚠️ **BLOCKING**: No UI work can begin until this phase completes"
- **Why Ambiguous**: "UI work" could be interpreted narrowly (only UI components) or broadly (anything rendering to screen). Clarify exactly which tasks are blocked.
- **Recommendation**: Change to: "⚠️ **BLOCKING**: Tasks T013-T020 (Phase 3 UI components) cannot begin until Phase 2 completes"

### AMB-021
- **Severity**: LOW
- **Location**: plan.md, line 47
- **Ambiguous Text**: "Renderer bundle <5MB | ✅ TBD | Minimal new code (~2KB)"
- **Why Ambiguous**: "TBD" status contradicts the checkmark. Status should reflect actual verification state.
- **Recommendation**: Change to: "Renderer bundle <5MB | ⏳ PENDING | Estimated ~2KB new code, verification after implementation"

### AMB-022
- **Severity**: LOW
- **Location**: spec.md, line 232
- **Ambiguous Text**: "Standard MDX structure: Headings use standard markdown syntax (# through ######). Non-standard heading patterns are out of scope."
- **Why Ambiguous**: "Non-standard heading patterns" are undefined. What counts as non-standard? HTML `<h1>` tags? Setext-style headings (underlines)?
- **Recommendation**: Change to: "Standard MDX structure: Only ATX-style markdown headings (# through ######) are supported. Setext-style headings (underlines), HTML heading tags (<h1>-<h6>), and JSX heading components are out of scope."

---

## Recommendations Summary

### Critical Actions (HIGH severity)
1. Define exact truncation behavior with specific character count (AMB-001)
2. Remove "similar to" references and specify exact thresholds (AMB-002)
3. Replace "etc." with complete enumerated list in FR-014 (AMB-003)

### Important Actions (MEDIUM severity)
1. Quantify all timing-related terms ("briefly", "rapid", "lag")
2. Define "lightweight parser" fallback behavior
3. Specify styling details (colors, spacing, animations)
4. Clarify debounce timing relationships
5. Define document size constraints explicitly

### Minor Actions (LOW severity)
1. Replace marketing hyperbole with measurable claims
2. Convert passive voice to active with clear responsibility
3. Define subjective terms like "complex"
4. Correct inconsistent status indicators

---

## Files Modified

None - this is an analysis report only.
