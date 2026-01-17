# Terminology & Consistency Analysis

**Spec File**: `/Users/ww/dev/projects/mdxpad/.specify/specs/006-application-shell/spec.md`
**Analysis Date**: 2026-01-10
**Category**: Terminology

---

## Summary

The spec introduces several terms in its Glossary section and Key Entities. Analysis compares these against:
- Constitution Glossary (canonical source)
- Previous specs (002-005) for consistency
- Usage within the spec itself

Overall: **Partial coverage** - The spec defines key terms but has some inconsistencies with prior specs and missing canonical definitions.

---

## Term-by-Term Analysis

### 1. Document

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Definition** | "Represents the currently open file with: fileId (UUID for tracking), filePath (null if untitled), fileName (display name), content (current editor content), savedContent (content at last save), isDirty (derived: content !== savedContent)" |
| **Issue** | Term "Document" overlaps with but differs from Spec 004's "FileState" which has similar fields (handle, content, savedContent, dirty). Spec 002 also uses "document" loosely (e.g., "new document is created", "document content changes") without formal definition. |
| **Question Candidate** | Should "Document" be aligned with the existing "FileState" entity from Spec 004, or should they remain distinct? If distinct, what is the relationship between Document and FileState? |
| **Impact Score** | 4 |

---

### 2. Dirty / isDirty

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Spec Definition** | "A document is 'dirty' when it has unsaved changes (current content differs from last saved content)" |
| **Notes** | This is consistent with Spec 004's "dirty state" concept (FR-005: "track dirty state by comparing current content with last saved content"). Constitution Section 7.3 also mentions "dirty" in context of auto-save. |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |

---

### 3. File Handle

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Definition** | "An object containing fileId, filePath, and fileName that identifies a saved document" |
| **Issue** | Spec 004 defines "FileHandle" as "Represents a reference to a file, containing unique id, path (null for untitled), and display name". The definitions are equivalent but use slightly different field names (fileId vs id, filePath vs path, fileName vs display name). |
| **Question Candidate** | Should the File Handle definition use the exact field names from Spec 004's FileHandle type (id, path, displayName) for consistency? |
| **Impact Score** | 3 |

---

### 4. Split Ratio

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Spec Definition** | "A value from 0 to 1 representing the position of the divider (0 = all preview, 1 = all editor)" |
| **Notes** | New term, not used in previous specs. Definition is complete and unambiguous. |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |

---

### 5. Untitled

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Spec Definition** | "A document that has never been saved and has no associated file path" |
| **Notes** | Consistent with usage in Spec 004 ("untitled document", "Untitled" as display name). |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |

---

### 6. Layout (Key Entity)

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Definition** | "Represents the visual arrangement with: splitRatio (0-1, position of divider), previewVisible (boolean), editorWidth (derived from splitRatio and container)" |
| **Issue** | Spec 005 introduces `uiLayoutStore` for "UI-only state like panel visibility" (per clarification). This spec's "Layout" entity appears to serve the same purpose but with different structure. |
| **Question Candidate** | Should the Layout entity be implemented as an extension of Spec 005's `uiLayoutStore`, or is this a separate store? What fields from uiLayoutStore should be reused vs. extended? |
| **Impact Score** | 4 |

---

### 7. Settings (Key Entity)

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Definition** | "User preferences with: theme ('light' | 'dark' | 'system'), zoomLevel (50-200), recentFiles (array of paths), other future preferences" |
| **Issue** | Spec 005 already defines zoom level persistence (FR-044: "persist zoom level to localStorage") and recent commands (RecentCommands entity). Spec 004 defines "recent files list with maximum 10 entries" (FR-013). This creates potential overlap: should zoom/recent be in Settings or in their respective stores? |
| **Question Candidate** | Should Settings consolidate zoom level (from uiLayoutStore), recent files (from file system), and theme into a single store, or should each remain in its domain-specific store with Settings providing a facade? |
| **Impact Score** | 3 |

---

### 8. Status (Key Entity)

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Spec Definition** | "Derived display information with: displayName (fileName or 'Untitled'), dirtyIndicator (boolean), cursorPosition ({line, column}), errorCount (number from preview state)" |
| **Notes** | New entity type. Definition is complete. Error count references "preview state" which is well-defined in Spec 003's PreviewState entity. |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |

---

### 9. Editor vs. MDXEditor vs. CodeMirror

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Usage** | Uses "editor" (lowercase) throughout, "CodeMirror editor" in Executive Summary, "MDXEditor" in Assumptions |
| **Issue** | Inconsistent naming. Spec 002 uses "editor" generically and defines EditorState. The spec refers to "MDXEditor" in assumptions but this component name is not formally defined anywhere. Constitution uses "CodeMirror 6" as the technology. |
| **Question Candidate** | What is the canonical component name for the editor: "MDXEditor", "Editor", or something else? Should the spec use one consistent term? |
| **Impact Score** | 2 |

---

### 10. Preview Pane vs. PreviewPane

| Attribute | Value |
|-----------|-------|
| **Status** | Partial |
| **Spec Usage** | Uses "preview pane" (two words), "preview" alone, "preview rendering", and "PreviewPane" (PascalCase component name in Assumptions) |
| **Issue** | Minor inconsistency between prose ("preview pane") and component name ("PreviewPane"). Spec 003 also uses both forms. |
| **Question Candidate** | N/A (minor - component naming convention is clear) |
| **Impact Score** | 1 |

---

### 11. Command Palette vs. command palette

| Attribute | Value |
|-----------|-------|
| **Status** | Clear |
| **Spec Usage** | Uses "command palette" (lowercase) consistently |
| **Notes** | Matches Spec 005 usage. Component name is "CommandPalette" (PascalCase) per standard React conventions. |
| **Question Candidate** | N/A |
| **Impact Score** | 1 |

---

### 12. Missing Constitution Glossary Alignment

| Attribute | Value |
|-----------|-------|
| **Status** | Missing |
| **Issue** | The Constitution defines canonical terms (IPC, MDX, contextIsolation, Tier 1/2/3 Plugin) that are not referenced in this spec's glossary. While some terms (IPC) are used in the spec, they rely on implicit understanding rather than explicit reference to the Constitution glossary. |
| **Question Candidate** | Should the spec's glossary explicitly reference or inherit from the Constitution glossary for terms like "IPC"? |
| **Impact Score** | 2 |

---

## Deprecated/Synonym Terms to Avoid

| Preferred Term | Avoid Using |
|----------------|-------------|
| Document | file state, current file (as entity name) |
| Dirty | unsaved changes (when referring to the boolean state) |
| File Handle | file reference, file info |
| Split Ratio | divider position, pane ratio |
| Untitled | new document (when referring to save state) |

---

## Recommendations

1. **High Priority (Impact 4)**
   - Clarify relationship between "Document" entity and Spec 004's "FileState" entity
   - Clarify relationship between "Layout" entity and Spec 005's "uiLayoutStore"

2. **Medium Priority (Impact 3)**
   - Align File Handle field names with Spec 004's FileHandle type definition
   - Clarify Settings store boundaries vs. domain-specific stores

3. **Low Priority (Impact 1-2)**
   - Establish canonical component name for the editor (MDXEditor vs. Editor)
   - Consider referencing Constitution glossary for IPC and other shared terms
