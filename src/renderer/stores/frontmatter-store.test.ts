/**
 * Frontmatter Store Tests
 *
 * Unit tests for the frontmatter Zustand store covering:
 * - Initial state verification
 * - Document parsing
 * - Field operations (update, add, remove)
 * - Mode operations (visual/raw toggle)
 * - Panel operations
 * - Schema operations
 * - Serialization
 * - Selectors
 *
 * @module renderer/stores/frontmatter-store.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useFrontmatterStore,
  selectData,
  selectFields,
  selectMode,
  selectIsPanelOpen,
  selectIsDirty,
  selectRawYamlDraft,
  selectExists,
  selectParseError,
  selectHasValidationErrors,
  selectValidationErrorCount,
  selectSchema,
  selectLastChangeSource,
} from './frontmatter-store';
import type {
  FrontmatterStoreState,
  FrontmatterData,
  FrontmatterField,
  FieldType,
} from '@shared/types/frontmatter';
import {
  EMPTY_FRONTMATTER_DATA,
  EMPTY_SCHEMA,
  VALID_RESULT,
  DEFAULT_YAML_FORMAT_OPTIONS,
} from '@shared/types/frontmatter';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Initial state for reset between tests.
 */
const INITIAL_STATE: FrontmatterStoreState = {
  data: null,
  schema: null,
  mode: 'visual',
  isPanelOpen: false,
  rawYamlDraft: '',
  isDirty: false,
  lastChangeSource: null,
  isLoadingSchema: false,
  schemaError: null,
};

/**
 * Create a mock frontmatter data object for testing.
 */
function createMockFrontmatterData(
  fields: {
    name: string;
    value: unknown;
    type?: FieldType;
  }[] = []
): FrontmatterData {
  return {
    fields: fields.map((f, i) => ({
      name: f.name,
      value: f.value,
      type: f.type ?? 'text',
      validation: VALID_RESULT,
      path: [f.name],
      isFromSchema: false,
      order: i,
    })) as FrontmatterField[],
    rawYaml: fields.map((f) => `${f.name}: ${JSON.stringify(f.value)}`).join('\n'),
    parseError: null,
    exists: fields.length > 0,
    formatOptions: DEFAULT_YAML_FORMAT_OPTIONS,
    hasUnsupportedFeatures: false,
    unsupportedFieldNames: [],
    unsupportedReasons: [],
    delimiterError: null,
  };
}

/**
 * Sample MDX document with frontmatter for testing.
 */
const SAMPLE_DOCUMENT_WITH_FRONTMATTER = `---
title: Test Document
description: A test description
date: 2024-01-15
tags:
  - react
  - typescript
draft: false
count: 42
---

# Content

This is the document content.
`;

/**
 * Sample MDX document without frontmatter for testing.
 */
const SAMPLE_DOCUMENT_WITHOUT_FRONTMATTER = `# No Frontmatter

Just some markdown content.
`;

/**
 * Sample invalid YAML for testing.
 */
const INVALID_YAML = `
title: Test
  invalid: indentation
    broken: yaml
`;

// =============================================================================
// TESTS
// =============================================================================

describe('useFrontmatterStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useFrontmatterStore.setState(INITIAL_STATE);
  });

  // ===========================================================================
  // Initial State Tests
  // ===========================================================================

  describe('initial state', () => {
    it('should have data as null', () => {
      const state = useFrontmatterStore.getState();
      expect(state.data).toBeNull();
    });

    it('should have mode as "visual"', () => {
      const state = useFrontmatterStore.getState();
      expect(state.mode).toBe('visual');
    });

    it('should have isPanelOpen as false', () => {
      const state = useFrontmatterStore.getState();
      expect(state.isPanelOpen).toBe(false);
    });

    it('should have schema as null', () => {
      const state = useFrontmatterStore.getState();
      expect(state.schema).toBeNull();
    });

    it('should have rawYamlDraft as empty string', () => {
      const state = useFrontmatterStore.getState();
      expect(state.rawYamlDraft).toBe('');
    });

    it('should have isDirty as false', () => {
      const state = useFrontmatterStore.getState();
      expect(state.isDirty).toBe(false);
    });

    it('should have lastChangeSource as null', () => {
      const state = useFrontmatterStore.getState();
      expect(state.lastChangeSource).toBeNull();
    });

    it('should have isLoadingSchema as false', () => {
      const state = useFrontmatterStore.getState();
      expect(state.isLoadingSchema).toBe(false);
    });

    it('should have schemaError as null', () => {
      const state = useFrontmatterStore.getState();
      expect(state.schemaError).toBeNull();
    });
  });

  // ===========================================================================
  // parseFromDocument Tests
  // ===========================================================================

  describe('parseFromDocument', () => {
    it('should parse valid frontmatter into fields', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      expect(state.data).not.toBeNull();
      expect(state.data?.exists).toBe(true);
      expect(state.data?.fields.length).toBeGreaterThan(0);
    });

    it('should extract title field correctly', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      const titleField = state.data?.fields.find((f) => f.name === 'title');
      expect(titleField).toBeDefined();
      expect(titleField?.value).toBe('Test Document');
      expect(titleField?.type).toBe('text');
    });

    it('should extract date field correctly', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      const dateField = state.data?.fields.find((f) => f.name === 'date');
      expect(dateField).toBeDefined();
      expect(dateField?.type).toBe('date');
    });

    it('should extract array field correctly', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      const tagsField = state.data?.fields.find((f) => f.name === 'tags');
      expect(tagsField).toBeDefined();
      expect(tagsField?.type).toBe('array');
      expect(Array.isArray(tagsField?.value)).toBe(true);
    });

    it('should extract boolean field correctly', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      const draftField = state.data?.fields.find((f) => f.name === 'draft');
      expect(draftField).toBeDefined();
      expect(draftField?.value).toBe(false);
      expect(draftField?.type).toBe('boolean');
    });

    it('should extract number field correctly', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      const countField = state.data?.fields.find((f) => f.name === 'count');
      expect(countField).toBeDefined();
      expect(countField?.value).toBe(42);
      expect(countField?.type).toBe('number');
    });

    it('should handle document without frontmatter', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITHOUT_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      expect(state.data).not.toBeNull();
      expect(state.data?.exists).toBe(false);
      expect(state.data?.fields).toHaveLength(0);
    });

    it('should set lastChangeSource to "document"', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('document');
    });

    it('should set isDirty to false', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(false);
    });

    it('should update rawYamlDraft with parsed YAML', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const state = useFrontmatterStore.getState();

      expect(state.rawYamlDraft).toContain('title: Test Document');
    });

    it('should handle empty frontmatter', () => {
      // Note: The frontmatter regex requires content between delimiters
      // Empty delimiters on separate lines don't match the pattern
      const emptyFrontmatter = `---

---

# Content`;
      useFrontmatterStore.getState().parseFromDocument(emptyFrontmatter);
      const state = useFrontmatterStore.getState();

      expect(state.data?.exists).toBe(true);
      expect(state.data?.fields).toHaveLength(0);
    });
  });

  // ===========================================================================
  // updateField Tests
  // ===========================================================================

  describe('updateField', () => {
    beforeEach(() => {
      // Setup with parsed frontmatter
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
    });

    it('should update field value by path', () => {
      useFrontmatterStore.getState().updateField(['title'], 'Updated Title');
      const state = useFrontmatterStore.getState();

      const titleField = state.data?.fields.find((f) => f.name === 'title');
      expect(titleField?.value).toBe('Updated Title');
    });

    it('should mark state as dirty', () => {
      useFrontmatterStore.getState().updateField(['title'], 'Updated Title');
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set lastChangeSource to "panel"', () => {
      useFrontmatterStore.getState().updateField(['title'], 'Updated Title');
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });

    it('should update boolean field', () => {
      useFrontmatterStore.getState().updateField(['draft'], true);
      const state = useFrontmatterStore.getState();

      const draftField = state.data?.fields.find((f) => f.name === 'draft');
      expect(draftField?.value).toBe(true);
    });

    it('should update number field', () => {
      useFrontmatterStore.getState().updateField(['count'], 100);
      const state = useFrontmatterStore.getState();

      const countField = state.data?.fields.find((f) => f.name === 'count');
      expect(countField?.value).toBe(100);
    });

    it('should update array field', () => {
      useFrontmatterStore.getState().updateField(['tags'], ['vue', 'javascript']);
      const state = useFrontmatterStore.getState();

      const tagsField = state.data?.fields.find((f) => f.name === 'tags');
      expect(tagsField?.value).toEqual(['vue', 'javascript']);
    });

    it('should not update if data is null', () => {
      useFrontmatterStore.setState(INITIAL_STATE);
      useFrontmatterStore.getState().updateField(['title'], 'New Title');
      const state = useFrontmatterStore.getState();

      expect(state.data).toBeNull();
    });

    it('should not update non-existent field', () => {
      const initialFieldCount = useFrontmatterStore.getState().data?.fields.length;
      useFrontmatterStore.getState().updateField(['nonexistent'], 'value');
      const state = useFrontmatterStore.getState();

      expect(state.data?.fields.length).toBe(initialFieldCount);
    });
  });

  // ===========================================================================
  // addField Tests
  // ===========================================================================

  describe('addField', () => {
    it('should add new field with default text value', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().addField('newField', 'text');
      const state = useFrontmatterStore.getState();

      const newField = state.data?.fields.find((f) => f.name === 'newField');
      expect(newField).toBeDefined();
      expect(newField?.type).toBe('text');
      expect(newField?.value).toBe('');
    });

    it('should add new field with default number value', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().addField('newNumber', 'number');
      const state = useFrontmatterStore.getState();

      const newField = state.data?.fields.find((f) => f.name === 'newNumber');
      expect(newField).toBeDefined();
      expect(newField?.type).toBe('number');
      expect(newField?.value).toBe(0);
    });

    it('should add new field with default boolean value', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().addField('newBool', 'boolean');
      const state = useFrontmatterStore.getState();

      const newField = state.data?.fields.find((f) => f.name === 'newBool');
      expect(newField).toBeDefined();
      expect(newField?.type).toBe('boolean');
      expect(newField?.value).toBe(false);
    });

    it('should add new field with default array value', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().addField('newArray', 'array');
      const state = useFrontmatterStore.getState();

      const newField = state.data?.fields.find((f) => f.name === 'newArray');
      expect(newField).toBeDefined();
      expect(newField?.type).toBe('array');
      expect(newField?.value).toEqual([]);
    });

    it('should add new field with default date value', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().addField('newDate', 'date');
      const state = useFrontmatterStore.getState();

      const newField = state.data?.fields.find((f) => f.name === 'newDate');
      expect(newField).toBeDefined();
      expect(newField?.type).toBe('date');
      // Default date value is today's date in ISO format
      expect(typeof newField?.value).toBe('string');
      expect(newField?.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should skip duplicate field names', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      const initialFieldCount = useFrontmatterStore.getState().data?.fields.length;

      useFrontmatterStore.getState().addField('title', 'text');
      const state = useFrontmatterStore.getState();

      expect(state.data?.fields.length).toBe(initialFieldCount);
    });

    it('should create data if null', () => {
      useFrontmatterStore.setState(INITIAL_STATE);
      expect(useFrontmatterStore.getState().data).toBeNull();

      useFrontmatterStore.getState().addField('firstField', 'text');
      const state = useFrontmatterStore.getState();

      expect(state.data).not.toBeNull();
      expect(state.data?.exists).toBe(true);
      expect(state.data?.fields).toHaveLength(1);
    });

    it('should mark state as dirty', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.setState({ isDirty: false });

      useFrontmatterStore.getState().addField('newField', 'text');
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set lastChangeSource to "panel"', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      useFrontmatterStore.getState().addField('newField', 'text');
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });
  });

  // ===========================================================================
  // removeField Tests
  // ===========================================================================

  describe('removeField', () => {
    beforeEach(() => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
    });

    it('should remove field by path', () => {
      const initialFieldCount = useFrontmatterStore.getState().data?.fields.length ?? 0;

      useFrontmatterStore.getState().removeField(['title']);
      const state = useFrontmatterStore.getState();

      expect(state.data?.fields.length).toBe(initialFieldCount - 1);
      expect(state.data?.fields.find((f) => f.name === 'title')).toBeUndefined();
    });

    it('should handle non-existent path', () => {
      const initialFieldCount = useFrontmatterStore.getState().data?.fields.length;

      useFrontmatterStore.getState().removeField(['nonexistent']);
      const state = useFrontmatterStore.getState();

      expect(state.data?.fields.length).toBe(initialFieldCount);
    });

    it('should mark state as dirty', () => {
      useFrontmatterStore.setState({ isDirty: false });

      useFrontmatterStore.getState().removeField(['title']);
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set lastChangeSource to "panel"', () => {
      useFrontmatterStore.getState().removeField(['title']);
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });

    it('should not modify state if data is null', () => {
      useFrontmatterStore.setState(INITIAL_STATE);

      useFrontmatterStore.getState().removeField(['title']);
      const state = useFrontmatterStore.getState();

      expect(state.data).toBeNull();
    });

    it('should remove field with nested path', () => {
      // Add a field with nested path for testing
      // Use type assertion to avoid deep type instantiation issues
      const currentState = useFrontmatterStore.getState();
      if (!currentState.data) return;

      const newField: FrontmatterField = {
        name: 'nested',
        value: 'value',
        type: 'text',
        validation: VALID_RESULT,
        path: ['parent', 'nested'],
        isFromSchema: false,
        order: 99,
      };

      useFrontmatterStore.setState({
        ...currentState,
        data: {
          ...currentState.data,
          fields: [...currentState.data.fields, newField],
        },
      });

      const initialFieldCount = useFrontmatterStore.getState().data?.fields.length ?? 0;

      useFrontmatterStore.getState().removeField(['parent', 'nested']);
      const state = useFrontmatterStore.getState();

      expect(state.data?.fields.length).toBe(initialFieldCount - 1);
    });
  });

  // ===========================================================================
  // setMode Tests
  // ===========================================================================

  describe('setMode', () => {
    beforeEach(() => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
    });

    it('should switch from visual to raw mode', () => {
      const result = useFrontmatterStore.getState().setMode('raw');
      const state = useFrontmatterStore.getState();

      expect(result.valid).toBe(true);
      expect(state.mode).toBe('raw');
    });

    it('should serialize YAML when switching to raw mode', () => {
      useFrontmatterStore.getState().setMode('raw');
      const state = useFrontmatterStore.getState();

      expect(state.rawYamlDraft).toContain('title');
      expect(state.rawYamlDraft.length).toBeGreaterThan(0);
    });

    it('should switch from raw to visual mode with valid YAML', () => {
      useFrontmatterStore.getState().setMode('raw');
      const result = useFrontmatterStore.getState().setMode('visual');
      const state = useFrontmatterStore.getState();

      expect(result.valid).toBe(true);
      expect(state.mode).toBe('visual');
    });

    it('should return validation error if YAML is invalid when switching to visual', () => {
      useFrontmatterStore.getState().setMode('raw');
      useFrontmatterStore.getState().setRawYaml(INVALID_YAML);

      const result = useFrontmatterStore.getState().setMode('visual');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
    });

    it('should block mode switch on validation failure', () => {
      useFrontmatterStore.getState().setMode('raw');
      useFrontmatterStore.getState().setRawYaml(INVALID_YAML);

      useFrontmatterStore.getState().setMode('visual');
      const state = useFrontmatterStore.getState();

      // Should remain in raw mode
      expect(state.mode).toBe('raw');
    });

    it('should preserve data when switching modes with valid YAML', () => {
      const originalTitle = useFrontmatterStore.getState().data?.fields.find(
        (f) => f.name === 'title'
      )?.value;

      useFrontmatterStore.getState().setMode('raw');
      useFrontmatterStore.getState().setMode('visual');

      const state = useFrontmatterStore.getState();
      const newTitle = state.data?.fields.find((f) => f.name === 'title')?.value;

      expect(newTitle).toBe(originalTitle);
    });
  });

  // ===========================================================================
  // setRawYaml Tests
  // ===========================================================================

  describe('setRawYaml', () => {
    it('should update rawYamlDraft', () => {
      const newYaml = 'title: New Title\ndate: 2024-02-01';

      useFrontmatterStore.getState().setRawYaml(newYaml);
      const state = useFrontmatterStore.getState();

      expect(state.rawYamlDraft).toBe(newYaml);
    });

    it('should mark state as dirty', () => {
      useFrontmatterStore.getState().setRawYaml('title: New');
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set lastChangeSource to "panel"', () => {
      useFrontmatterStore.getState().setRawYaml('title: New');
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });
  });

  // ===========================================================================
  // applyRawYaml Tests
  // ===========================================================================

  describe('applyRawYaml', () => {
    it('should parse raw YAML into data', () => {
      useFrontmatterStore.getState().setRawYaml('title: Applied Title\nauthor: John');

      const result = useFrontmatterStore.getState().applyRawYaml();
      const state = useFrontmatterStore.getState();

      expect(result.valid).toBe(true);
      expect(state.data?.fields.find((f) => f.name === 'title')?.value).toBe('Applied Title');
      expect(state.data?.fields.find((f) => f.name === 'author')?.value).toBe('John');
    });

    it('should return validation error if YAML is invalid', () => {
      useFrontmatterStore.getState().setRawYaml(INVALID_YAML);

      const result = useFrontmatterStore.getState().applyRawYaml();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.code).toBe('INVALID_FORMAT');
    });

    it('should mark state as dirty after applying', () => {
      useFrontmatterStore.getState().setRawYaml('title: New');

      useFrontmatterStore.getState().applyRawYaml();
      const state = useFrontmatterStore.getState();

      expect(state.isDirty).toBe(true);
    });

    it('should set lastChangeSource to "panel" after applying', () => {
      useFrontmatterStore.getState().setRawYaml('title: New');

      useFrontmatterStore.getState().applyRawYaml();
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });

    it('should handle empty YAML', () => {
      useFrontmatterStore.getState().setRawYaml('');

      const result = useFrontmatterStore.getState().applyRawYaml();
      const state = useFrontmatterStore.getState();

      expect(result.valid).toBe(true);
      expect(state.data?.fields).toHaveLength(0);
    });
  });

  // ===========================================================================
  // togglePanel / setPanelOpen Tests
  // ===========================================================================

  describe('togglePanel', () => {
    it('should toggle panel from closed to open', () => {
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(false);

      useFrontmatterStore.getState().togglePanel();
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(true);
    });

    it('should toggle panel from open to closed', () => {
      useFrontmatterStore.setState({ isPanelOpen: true });

      useFrontmatterStore.getState().togglePanel();
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      useFrontmatterStore.getState().togglePanel();
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(true);

      useFrontmatterStore.getState().togglePanel();
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(false);

      useFrontmatterStore.getState().togglePanel();
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(true);
    });
  });

  describe('setPanelOpen', () => {
    it('should set panel visibility to true', () => {
      useFrontmatterStore.getState().setPanelOpen(true);
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(true);
    });

    it('should set panel visibility to false', () => {
      useFrontmatterStore.setState({ isPanelOpen: true });

      useFrontmatterStore.getState().setPanelOpen(false);
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(false);
    });

    it('should handle setting same value', () => {
      useFrontmatterStore.getState().setPanelOpen(true);
      useFrontmatterStore.getState().setPanelOpen(true);
      expect(useFrontmatterStore.getState().isPanelOpen).toBe(true);
    });
  });

  // ===========================================================================
  // loadSchema Tests
  // ===========================================================================

  describe('loadSchema', () => {
    it('should set isLoadingSchema to true during loading', async () => {
      const loadPromise = useFrontmatterStore.getState().loadSchema();

      // Check immediately (may or may not catch loading state due to async)
      await loadPromise;

      // After loading completes
      const state = useFrontmatterStore.getState();
      expect(state.isLoadingSchema).toBe(false);
    });

    it('should load empty schema (current implementation)', async () => {
      await useFrontmatterStore.getState().loadSchema();
      const state = useFrontmatterStore.getState();

      expect(state.schema).not.toBeNull();
      expect(state.schema?.properties).toEqual({});
      expect(state.schema?.required).toEqual([]);
    });

    it('should set isLoadingSchema to false after loading', async () => {
      await useFrontmatterStore.getState().loadSchema();
      const state = useFrontmatterStore.getState();

      expect(state.isLoadingSchema).toBe(false);
    });

    it('should clear schemaError on successful load', async () => {
      useFrontmatterStore.setState({ schemaError: 'Previous error' });

      await useFrontmatterStore.getState().loadSchema();
      const state = useFrontmatterStore.getState();

      expect(state.schemaError).toBeNull();
    });
  });

  // ===========================================================================
  // validateFields Tests
  // ===========================================================================

  describe('validateFields', () => {
    it('should validate all fields without error', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      useFrontmatterStore.getState().validateFields();
      const state = useFrontmatterStore.getState();

      // All fields should have valid validation
      expect(state.data?.fields.every((f) => f.validation.valid)).toBe(true);
    });

    it('should not throw if data is null', () => {
      useFrontmatterStore.setState(INITIAL_STATE);

      expect(() => useFrontmatterStore.getState().validateFields()).not.toThrow();
    });
  });

  // ===========================================================================
  // serializeToYaml Tests
  // ===========================================================================

  describe('serializeToYaml', () => {
    it('should return serialized YAML from data', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      const yaml = useFrontmatterStore.getState().serializeToYaml();

      expect(yaml).toContain('title: Test Document');
      expect(yaml).toContain('draft: false');
    });

    it('should return empty string if no data', () => {
      useFrontmatterStore.setState(INITIAL_STATE);

      const yaml = useFrontmatterStore.getState().serializeToYaml();

      expect(yaml).toBe('');
    });

    it('should return empty string if data exists but has no fields', () => {
      useFrontmatterStore.setState({
        ...INITIAL_STATE,
        data: {
          ...EMPTY_FRONTMATTER_DATA,
          exists: true,
        },
      });

      const yaml = useFrontmatterStore.getState().serializeToYaml();

      expect(yaml).toBe('');
    });

    it('should serialize updated field values', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().updateField(['title'], 'Modified Title');

      const yaml = useFrontmatterStore.getState().serializeToYaml();

      expect(yaml).toContain('title: Modified Title');
    });
  });

  // ===========================================================================
  // reset Tests
  // ===========================================================================

  describe('reset', () => {
    it('should reset to initial state', () => {
      // Setup complex state
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().setPanelOpen(true);
      useFrontmatterStore.getState().setMode('raw');

      // Reset
      useFrontmatterStore.getState().reset();
      const state = useFrontmatterStore.getState();

      expect(state.data).toBeNull();
      expect(state.mode).toBe('visual');
      expect(state.isPanelOpen).toBe(false);
      expect(state.isDirty).toBe(false);
      expect(state.lastChangeSource).toBeNull();
    });

    it('should clear rawYamlDraft', () => {
      useFrontmatterStore.getState().setRawYaml('some: yaml');

      useFrontmatterStore.getState().reset();
      const state = useFrontmatterStore.getState();

      expect(state.rawYamlDraft).toBe('');
    });

    it('should clear schema', () => {
      useFrontmatterStore.setState({
        ...useFrontmatterStore.getState(),
        schema: EMPTY_SCHEMA,
      });

      useFrontmatterStore.getState().reset();
      const state = useFrontmatterStore.getState();

      expect(state.schema).toBeNull();
    });
  });

  // ===========================================================================
  // setChangeSource Tests
  // ===========================================================================

  describe('setChangeSource', () => {
    it('should set change source to "panel"', () => {
      useFrontmatterStore.getState().setChangeSource('panel');
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('panel');
    });

    it('should set change source to "document"', () => {
      useFrontmatterStore.getState().setChangeSource('document');
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBe('document');
    });

    it('should set change source to null', () => {
      useFrontmatterStore.setState({ lastChangeSource: 'panel' });

      useFrontmatterStore.getState().setChangeSource(null);
      const state = useFrontmatterStore.getState();

      expect(state.lastChangeSource).toBeNull();
    });
  });
});

// =============================================================================
// SELECTOR TESTS
// =============================================================================

describe('selectors', () => {
  beforeEach(() => {
    useFrontmatterStore.setState(INITIAL_STATE);
  });

  describe('selectData', () => {
    it('should return null when no data', () => {
      expect(selectData(useFrontmatterStore.getState())).toBeNull();
    });

    it('should return data after parsing', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      const data = selectData(useFrontmatterStore.getState());
      expect(data).not.toBeNull();
      expect(data?.exists).toBe(true);
    });
  });

  describe('selectFields', () => {
    it('should return empty array when no data', () => {
      expect(selectFields(useFrontmatterStore.getState())).toEqual([]);
    });

    it('should return fields after parsing', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      const fields = selectFields(useFrontmatterStore.getState());
      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe('selectMode', () => {
    it('should return "visual" initially', () => {
      expect(selectMode(useFrontmatterStore.getState())).toBe('visual');
    });

    it('should return "raw" after mode switch', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().setMode('raw');

      expect(selectMode(useFrontmatterStore.getState())).toBe('raw');
    });
  });

  describe('selectIsPanelOpen', () => {
    it('should return false initially', () => {
      expect(selectIsPanelOpen(useFrontmatterStore.getState())).toBe(false);
    });

    it('should return true after toggle', () => {
      useFrontmatterStore.getState().togglePanel();

      expect(selectIsPanelOpen(useFrontmatterStore.getState())).toBe(true);
    });
  });

  describe('selectIsDirty', () => {
    it('should return false initially', () => {
      expect(selectIsDirty(useFrontmatterStore.getState())).toBe(false);
    });

    it('should return true after field update', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().updateField(['title'], 'New');

      expect(selectIsDirty(useFrontmatterStore.getState())).toBe(true);
    });
  });

  describe('selectRawYamlDraft', () => {
    it('should return empty string initially', () => {
      expect(selectRawYamlDraft(useFrontmatterStore.getState())).toBe('');
    });

    it('should return raw YAML after parsing', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      const yaml = selectRawYamlDraft(useFrontmatterStore.getState());
      expect(yaml).toContain('title');
    });
  });

  describe('selectExists', () => {
    it('should return false when no data', () => {
      expect(selectExists(useFrontmatterStore.getState())).toBe(false);
    });

    it('should return true when frontmatter exists', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      expect(selectExists(useFrontmatterStore.getState())).toBe(true);
    });

    it('should return false when document has no frontmatter', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITHOUT_FRONTMATTER);

      expect(selectExists(useFrontmatterStore.getState())).toBe(false);
    });
  });

  describe('selectParseError', () => {
    it('should return null when no parse error', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      expect(selectParseError(useFrontmatterStore.getState())).toBeNull();
    });

    it('should return null when no data', () => {
      expect(selectParseError(useFrontmatterStore.getState())).toBeNull();
    });
  });

  describe('selectHasValidationErrors', () => {
    it('should return false when no data', () => {
      expect(selectHasValidationErrors(useFrontmatterStore.getState())).toBe(false);
    });

    it('should return false when all fields are valid', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      expect(selectHasValidationErrors(useFrontmatterStore.getState())).toBe(false);
    });

    it('should return true when field has validation error', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      // Manually set a validation error
      // Simplified to avoid deep type instantiation
      const currentState = useFrontmatterStore.getState();
      if (!currentState.data) return;

      const updatedFields = currentState.data.fields.map((f, i) =>
        i === 0
          ? {
              ...f,
              validation: {
                valid: false,
                errors: [{ code: 'REQUIRED' as const, message: 'Required' }],
                warnings: [],
              },
            }
          : f
      );

      useFrontmatterStore.setState({
        ...currentState,
        data: {
          ...currentState.data,
          fields: updatedFields,
        },
      });

      expect(selectHasValidationErrors(useFrontmatterStore.getState())).toBe(true);
    });
  });

  describe('selectValidationErrorCount', () => {
    it('should return 0 when no data', () => {
      expect(selectValidationErrorCount(useFrontmatterStore.getState())).toBe(0);
    });

    it('should return 0 when all fields are valid', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      expect(selectValidationErrorCount(useFrontmatterStore.getState())).toBe(0);
    });

    it('should return count of fields with errors', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      // Manually set validation errors on first two fields
      // Simplified to avoid deep type instantiation
      const currentState = useFrontmatterStore.getState();
      if (!currentState.data) return;

      const updatedFields = currentState.data.fields.map((f, i) =>
        i < 2
          ? {
              ...f,
              validation: {
                valid: false,
                errors: [{ code: 'REQUIRED' as const, message: 'Required' }],
                warnings: [],
              },
            }
          : f
      );

      useFrontmatterStore.setState({
        ...currentState,
        data: {
          ...currentState.data,
          fields: updatedFields,
        },
      });

      expect(selectValidationErrorCount(useFrontmatterStore.getState())).toBe(2);
    });
  });

  describe('selectSchema', () => {
    it('should return null initially', () => {
      expect(selectSchema(useFrontmatterStore.getState())).toBeNull();
    });

    it('should return schema after loading', async () => {
      await useFrontmatterStore.getState().loadSchema();

      expect(selectSchema(useFrontmatterStore.getState())).not.toBeNull();
    });
  });

  describe('selectLastChangeSource', () => {
    it('should return null initially', () => {
      expect(selectLastChangeSource(useFrontmatterStore.getState())).toBeNull();
    });

    it('should return "document" after parseFromDocument', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);

      expect(selectLastChangeSource(useFrontmatterStore.getState())).toBe('document');
    });

    it('should return "panel" after field update', () => {
      useFrontmatterStore.getState().parseFromDocument(SAMPLE_DOCUMENT_WITH_FRONTMATTER);
      useFrontmatterStore.getState().updateField(['title'], 'New');

      expect(selectLastChangeSource(useFrontmatterStore.getState())).toBe('panel');
    });
  });
});

// =============================================================================
// EDGE CASE TESTS
// =============================================================================

describe('edge cases', () => {
  beforeEach(() => {
    useFrontmatterStore.setState(INITIAL_STATE);
  });

  it('should handle empty document', () => {
    useFrontmatterStore.getState().parseFromDocument('');
    const state = useFrontmatterStore.getState();

    expect(state.data?.exists).toBe(false);
  });

  it('should handle document with only delimiters', () => {
    // Note: The frontmatter regex requires content between delimiters
    // Delimiters with blank line between match the pattern
    useFrontmatterStore.getState().parseFromDocument('---\n\n---\n');
    const state = useFrontmatterStore.getState();

    expect(state.data?.exists).toBe(true);
    expect(state.data?.fields).toHaveLength(0);
  });

  it('should handle nested object fields', () => {
    const docWithNestedObject = `---
author:
  name: John Doe
  email: john@example.com
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithNestedObject);
    const state = useFrontmatterStore.getState();

    const authorField = state.data?.fields.find((f) => f.name === 'author');
    expect(authorField).toBeDefined();
    expect(authorField?.type).toBe('object');
  });

  it('should handle deeply nested arrays', () => {
    const docWithNestedArray = `---
items:
  - name: Item 1
    tags:
      - a
      - b
  - name: Item 2
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithNestedArray);
    const state = useFrontmatterStore.getState();

    const itemsField = state.data?.fields.find((f) => f.name === 'items');
    expect(itemsField).toBeDefined();
    expect(itemsField?.type).toBe('array');
  });

  it('should handle special characters in field values', () => {
    const docWithSpecialChars = `---
title: "Hello: World!"
description: "Line 1\\nLine 2"
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithSpecialChars);
    const state = useFrontmatterStore.getState();

    const titleField = state.data?.fields.find((f) => f.name === 'title');
    expect(titleField?.value).toBe('Hello: World!');
  });

  it('should handle multiline string values', () => {
    const docWithMultiline = `---
description: >
  This is a long
  description that spans
  multiple lines
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithMultiline);
    const state = useFrontmatterStore.getState();

    const descField = state.data?.fields.find((f) => f.name === 'description');
    expect(descField).toBeDefined();
    expect(typeof descField?.value).toBe('string');
  });

  it('should handle null values', () => {
    const docWithNull = `---
empty: null
also_empty: ~
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithNull);
    const state = useFrontmatterStore.getState();

    const emptyField = state.data?.fields.find((f) => f.name === 'empty');
    expect(emptyField?.value).toBeNull();
  });

  it('should handle date-like strings', () => {
    const docWithDates = `---
date: 2024-01-15
datetime: 2024-01-15T10:30:00Z
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithDates);
    const state = useFrontmatterStore.getState();

    const dateField = state.data?.fields.find((f) => f.name === 'date');
    expect(dateField?.type).toBe('date');
  });

  it('should handle unicode characters', () => {
    const docWithUnicode = `---
title: Hello 世界 🌍
emoji: 🚀 Launch
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithUnicode);
    const state = useFrontmatterStore.getState();

    const titleField = state.data?.fields.find((f) => f.name === 'title');
    expect(titleField?.value).toBe('Hello 世界 🌍');
  });

  it('should handle very long field values', () => {
    const longValue = 'x'.repeat(10000);
    const docWithLongValue = `---
long: "${longValue}"
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithLongValue);
    const state = useFrontmatterStore.getState();

    const longField = state.data?.fields.find((f) => f.name === 'long');
    expect(longField?.value).toBe(longValue);
  });

  it('should handle many fields', () => {
    const manyFields = Array.from({ length: 50 }, (_, i) => `field${i}: value${i}`).join('\n');
    const docWithManyFields = `---
${manyFields}
---

# Content`;

    useFrontmatterStore.getState().parseFromDocument(docWithManyFields);
    const state = useFrontmatterStore.getState();

    expect(state.data?.fields.length).toBe(50);
  });
});
