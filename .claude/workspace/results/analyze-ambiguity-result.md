# Ambiguity Analysis: Template Library Specification

## Findings

| ID | Severity | Location(s) | Summary | Recommendation |
|---|---|---|---|---|
| A-001 | HIGH | spec.md L24, L125 | "static placeholder text is visually highlighted" and "static placeholder markers visually distinguished" lack definition of visual styling | Define specific CSS class names, colors, or design tokens. Example: "Use `className="placeholder-marker"` with dashed orange border (#FFA500)" |
| A-002 | HIGH | spec.md L98, L105 | "helpful message suggests broadening the search" and "error indicator for affected items" are vague on specific UI implementation | Specify exact error message text or indicator type. Example: "Display toast: 'No templates found. Try removing category filter or search term.'" |
| A-003 | MEDIUM | spec.md L150 | "Users can browse and select a template in under 30 seconds from opening the template browser" lacks clarity on what "selecting" means | Does "select" mean: (a) click template card, (b) confirm preview selection, (c) complete document creation? Define which action is measured. |
| A-004 | MEDIUM | spec.md L151 | "Template preview renders within 1 second of template selection" is ambiguous on whether this includes MDX compilation, parsing, or just DOM rendering | Clarify: Does 1 second cover: MDX→HTML compilation (T_compile) + DOM render (T_render)? Or just DOM render? |
| A-005 | HIGH | spec.md L118-122, L143 | "minimum set of built-in templates covering common document types" and "at least 5 common document types" → list inconsistent. FR-002 mentions "blog, documentation, presentation, and custom" but SC-006 requires 5 types: "blog post, documentation page, presentation, meeting notes, tutorial" | Consolidate to single authoritative list. Clarify which 5 are required and whether "custom" is a category or storage location. |
| A-006 | MEDIUM | spec.md L129 | "minimum set of built-in templates" in FR-018 is vague on quantity | SC-006 clarifies 5 minimum, but "minimum set" in FR-018 is ambiguous without this reference. Reword FR-018: "System MUST provide at least 5 built-in templates (per SC-006)" |
| A-007 | HIGH | plan.md L14 | Custom templates stored in `~/.mdxpad/templates/` but no specification of subdirectory structure (e.g., custom/ vs. flat) or how built-in templates are bundled/loaded | Specify: (a) Full path structure with examples (e.g., `~/.mdxpad/templates/custom/user-blog.mdxt`), (b) How app distinguishes built-in from custom at runtime, (c) Where built-in templates are bundled |
| A-008 | MEDIUM | spec.md L152 | "90% of users successfully create a document from a template on their first attempt" lacks definition of "first attempt" | Does this count: only users who succeed on try #1? Or users who succeed within N tries? Define success threshold explicitly. |
| A-009 | MEDIUM | spec.md L153 | "Search returns relevant results within 200 milliseconds for libraries with up to 100 templates" → "relevant" is undefined | Define: Does "relevant" mean fuzzy match score ≥0.6? Or exact substring match? Specify ranking algorithm or relevance criteria. |
| A-010 | MEDIUM | plan.md L18 vs spec.md L151 | "Performance Goals: Template preview < 500ms" (plan) contradicts "within 1 second" (spec) | Align specifications: Which is the requirement? 500ms (plan) or 1000ms (spec)? Spec should be authoritative; update plan.md L18 to match. |
| A-011 | MEDIUM | spec.md L132 | "professional structure" is subjective and unmeasurable | Specify what "professional" means: includes frontmatter? Headings? Link to example structures in built-in templates section. |
| A-012 | MEDIUM | spec.md L165-166 | "Dynamic variables (e.g., `{{title}}`) that prompt user for values during document creation" vs. "static markers for manual replacement" → overlap is ambiguous | Clarify: If template has both `{{title}}` and `[TODO: add content]`, which takes precedence in UI? Can users disable dynamic variable prompts? |
| A-013 | LOW | spec.md L178 | "system should handle reasonable collections gracefully" → "reasonable" is undefined | Specify: What is tested threshold? SC-008 only tests 100 restart cycles. Is "reasonable" 100 templates? 1000? Define explicit limit or testing criteria. |
| A-014 | MEDIUM | tasks.md L154 | "Reuses Spec 003 preview infrastructure" but no explicit requirement that Spec 003 exists or is complete | Add prerequisite check: Verify Spec 003 preview component is available and stable before Phase 3 begins. Document dependency version/commit. |
| A-015 | HIGH | spec.md L47 | "personal template collection" is ambiguous on scope (per-user, per-workspace, or per-installation) | Clarify: Are templates shared across workspaces? Is there a default user identity? Scope to single workspace or global app? Reference Spec 004 file system architecture. |
| A-016 | MEDIUM | spec.md L143 | Template Category definition mentions "built-in categories (Blog Post, Documentation, Presentation)" (3 types) but SC-006 requires 5 common types | Inconsistency: Which 5 are required? Current definition lists only 3 built-in + Custom. Add "Meeting Notes" and "Tutorial" to category definition in Entity section. |
| A-017 | MEDIUM | spec.md L154 | "Custom template save operation completes within 2 seconds including validation" → scope of "validation" unclear | Does this include: (a) MDX syntax validation only? (b) YAML frontmatter validation? (c) Error message generation? Specify all operations included in 2-second window. |
| A-018 | LOW | plan.md L20 | "Scale/Scope: Up to 100 templates (per SC-004), no hard limits on custom templates" → appears contradictory | Clarify: Is 100 the tested limit (performance target) or actual hard cap? Can users have >100 custom templates? Is this soft or hard limit? |
| A-019 | MEDIUM | spec.md L104 | "Support Unicode characters in all metadata fields; no language restrictions" is vague on scope | Specify: Which character sets are tested? (Latin, Cyrillic, CJK, RTL, emoji?) Or just "all valid UTF-8"? Affects validation logic. |
| A-020 | LOW | spec.md L141 | Template entity description mentions `.mdxt` file format with "YAML frontmatter containing metadata" but no schema/structure defined inline | Add `.mdxt` schema example to spec.md showing required/optional frontmatter fields (name, description, category, tags, author, variables). |

## Summary

- **Total Issues**: 20
- **High Severity**: 4 (blocks implementation decisions)
- **Medium Severity**: 14 (requires clarification before coding)
- **Low Severity**: 2 (minor inconsistencies)

### Critical Blockers (Must Resolve Before Phase 1)

1. **A-005 / A-016**: Built-in template category list contradicts itself. FR-002 lists 3 categories; SC-006 requires 5 types. Choose authoritative list.
2. **A-007**: Custom template storage path structure is completely unspecified. Implementation cannot start without this definition.
3. **A-015**: Scope of "personal template collection" is ambiguous. Affects where templates are stored and how they're managed.
4. **A-001, A-002**: Visual design for placeholder markers and error messages lacks concrete specifications. Affects component implementation.

### Recommended Resolution Order

1. **Resolve template category list** (A-005, A-016): Consolidate to single source of truth
2. **Define storage architecture** (A-007): Create detailed path structure with examples
3. **Clarify collection scope** (A-015): Per-user? Per-workspace? Global?
4. **Add design specifications** (A-001, A-002): CSS classes, colors, error message text
5. **Define validation scope** (A-017): Exactly what operations are included in 2-second requirement
6. **Align performance targets** (A-010): Choose 500ms or 1000ms for preview rendering
7. **Specify measurement definitions** (A-003, A-004, A-008, A-009): Clarify what each metric measures

### Files Affected by Ambiguities

- **spec.md**: 16 issues (inconsistent category lists, vague adjectives, unmeasured criteria)
- **plan.md**: 4 issues (contradictions with spec, missing dependency specs)
- **tasks.md**: 1 issue (assumption about Spec 003 availability)

### Severity Distribution

```
HIGH (4):     A-001, A-002, A-005, A-007, A-015
MEDIUM (14):  A-003, A-004, A-006, A-008, A-009, A-010, A-011, A-012, A-014, A-016, A-017, A-019, A-020
LOW (2):      A-013, A-018
```
