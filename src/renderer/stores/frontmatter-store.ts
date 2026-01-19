/**
 * Frontmatter Store
 *
 * Zustand store with Immer middleware for frontmatter panel state management.
 * Handles parsing, field updates, mode toggling, and bidirectional sync.
 *
 * @module renderer/stores/frontmatter-store
 */

/* eslint-disable max-lines-per-function -- Zustand store definitions are necessarily large */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FrontmatterData,
  FrontmatterSchema,
  FrontmatterField,
  FrontmatterMode,
  ChangeSource,
  FieldType,
  FieldValue,
  ValidationResult,
  FrontmatterStoreState,
  FrontmatterStore,
} from '@shared/types/frontmatter';
import {
  EMPTY_FRONTMATTER_DATA,
  EMPTY_SCHEMA,
  VALID_RESULT,
} from '@shared/types/frontmatter';
import {
  parseFrontmatter,
  serializeFrontmatter,
  validateYamlSyntax,
  getDefaultValue,
  validateField as validateFieldValue,
} from '@renderer/lib/frontmatter';

// =============================================================================
// INITIAL STATE
// =============================================================================

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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a new field with default values
 */
function createField(
  name: string,
  type: FieldType,
  order: number
): FrontmatterField {
  return {
    name,
    value: getDefaultValue(type),
    type,
    validation: VALID_RESULT,
    path: [name],
    isFromSchema: false,
    order,
  };
}

/**
 * Updates a field's value by mutating in-place (for use inside Immer drafts)
 * Uses type assertion to work around Immer's WritableDraft deep instantiation issues
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Immer WritableDraft workaround */
function updateFieldInPlace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: any,
  value: FieldValue
): void {
  // Direct mutation is safe inside Immer's set() callback
  field.value = value;
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access */

/**
 * Validates a single field and updates its validation result in-place.
 * Performance optimized - only validates the changed field, not the entire form.
 *
 * @param field - The field to validate (Immer draft)
 * @param schema - Optional schema for additional validation rules
 */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition */
function validateFieldInPlace(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: any,
  schema?: FrontmatterSchema
): void {
  const schemaProperty = schema?.properties?.[field.name];
  const validationResult = validateFieldValue(
    field.value,
    field.type,
    schemaProperty
  );

  // Update validation result in-place
  field.validation = validationResult;
}
/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unnecessary-condition */

// =============================================================================
// STORE CREATION
// =============================================================================

/**
 * Frontmatter store hook.
 * Manages frontmatter panel state including data, mode, and sync tracking.
 *
 * @example
 * ```tsx
 * const { data, mode, updateField, setMode, togglePanel } = useFrontmatterStore();
 *
 * // Parse frontmatter from document
 * parseFromDocument(documentContent);
 *
 * // Update a field value
 * updateField(['title'], 'New Title');
 *
 * // Toggle between visual and raw mode
 * setMode('raw');
 * ```
 */
export const useFrontmatterStore = create<FrontmatterStore>()(
  immer((set, get) => ({
    ...INITIAL_STATE,

    // =========================================================================
    // PARSING
    // =========================================================================

    parseFromDocument: (content: string) =>
      set((draft) => {
        const parsed = parseFrontmatter(content);
        // Use type assertion to work around Immer's WritableDraft deep instantiation issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        draft.data = parsed as any;
        draft.rawYamlDraft = parsed.rawYaml;
        draft.isDirty = false;
        draft.lastChangeSource = 'document';
      }),

    // =========================================================================
    // FIELD OPERATIONS
    // =========================================================================

    updateField: (path: string[], value: FieldValue) =>
      set((draft) => {
        if (!draft.data) return;

        const field = draft.data.fields.find(
          (f) =>
            f.path.length === path.length &&
            f.path.every((p, i) => p === path[i])
        );

        if (field) {
          updateFieldInPlace(field, value);
          // Validate only the changed field for performance (< 100ms target)
          validateFieldInPlace(field, draft.schema ?? undefined);
        }

        draft.isDirty = true;
        draft.lastChangeSource = 'panel';
      }),

    addField: (name: string, type: FieldType) =>
      set((draft) => {
        // Create new frontmatter data if it doesn't exist
        // Use type assertion to work around Immer's WritableDraft deep instantiation issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/prefer-nullish-coalescing
        if (draft.data === null) draft.data = { ...EMPTY_FRONTMATTER_DATA, exists: true, fields: [] } as any;

        // data is now guaranteed to be non-null
        const data = draft.data;

        // Check if field already exists
        const existing = data.fields.find((f) => f.name === name);
        if (existing) return;

        // Add new field at the end
        const order = data.fields.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        data.fields.push(createField(name, type, order) as any);
        draft.isDirty = true;
        draft.lastChangeSource = 'panel';
      }),

    removeField: (path: string[]) =>
      set((draft) => {
        if (!draft.data) return;

        draft.data.fields = draft.data.fields.filter(
          (f) =>
            !(
              f.path.length === path.length &&
              f.path.every((p, i) => p === path[i])
            )
        );

        draft.isDirty = true;
        draft.lastChangeSource = 'panel';
      }),

    // =========================================================================
    // MODE OPERATIONS
    // =========================================================================

    setMode: (mode: FrontmatterMode): ValidationResult => {
      const state = get();

      // If switching from raw to visual, validate YAML first
      if (state.mode === 'raw' && mode === 'visual') {
        const parseError = validateYamlSyntax(state.rawYamlDraft);
        if (parseError) {
          return {
            valid: false,
            errors: [
              {
                code: 'INVALID_FORMAT',
                message: parseError.message,
                path: [],
              },
            ],
            warnings: [],
          };
        }

        // Apply the raw YAML changes
        const applyResult = get().applyRawYaml();
        if (!applyResult.valid) {
          return applyResult;
        }
      }

      set((draft) => {
        // If switching to raw, update rawYamlDraft from current data
        if (mode === 'raw' && draft.data) {
          // Cast to FrontmatterData to work around Immer's WritableDraft issues
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
          draft.rawYamlDraft = serializeFrontmatter(draft.data as any);
        }
        draft.mode = mode;
      });

      return VALID_RESULT;
    },

    setRawYaml: (yaml: string) =>
      set((draft) => {
        draft.rawYamlDraft = yaml;
        draft.isDirty = true;
        draft.lastChangeSource = 'panel';
      }),

    applyRawYaml: (): ValidationResult => {
      const state = get();

      // Validate syntax first
      const parseError = validateYamlSyntax(state.rawYamlDraft);
      if (parseError) {
        return {
          valid: false,
          errors: [
            {
              code: 'INVALID_FORMAT',
              message: parseError.message,
              path: [],
            },
          ],
          warnings: [],
        };
      }

      // Parse and update data
      const content = `---\n${state.rawYamlDraft}\n---\n`;
      const parsed = parseFrontmatter(content);

      if (parsed.parseError) {
        return {
          valid: false,
          errors: [
            {
              code: 'INVALID_FORMAT',
              message: parsed.parseError.message,
              path: [],
            },
          ],
          warnings: [],
        };
      }

      set((draft) => {
        // Use type assertion to work around Immer's WritableDraft deep instantiation issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        draft.data = parsed as any;
        draft.isDirty = true;
        draft.lastChangeSource = 'panel';
      });

      return VALID_RESULT;
    },

    // =========================================================================
    // PANEL OPERATIONS
    // =========================================================================

    togglePanel: () =>
      set((draft) => {
        draft.isPanelOpen = !draft.isPanelOpen;
      }),

    setPanelOpen: (open: boolean) =>
      set((draft) => {
        draft.isPanelOpen = open;
      }),

    // =========================================================================
    // VALIDATION OPERATIONS
    // =========================================================================

    /**
     * Validates all fields in the frontmatter.
     * Updates each field's validation property with the result.
     */
    validateFields: () =>
      set((draft) => {
        if (!draft.data) return;

        for (const field of draft.data.fields) {
          validateFieldInPlace(field, draft.schema ?? undefined);
        }
      }),

    // =========================================================================
    // SCHEMA OPERATIONS
    // =========================================================================

    loadSchema: async (_filePath: string | null): Promise<void> => {
      set((draft) => {
        draft.isLoadingSchema = true;
        draft.schemaError = null;
      });

      try {
        // TODO: Implement full schema loading from project config or user settings (Phase 7)
        // For now, use empty schema with simulated async operation
        await Promise.resolve();
        set((draft) => {
          // Use type assertion to work around Immer's WritableDraft deep instantiation issues
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          draft.schema = EMPTY_SCHEMA as any;
          draft.isLoadingSchema = false;
        });
      } catch (error) {
        set((draft) => {
          // On error, fall back to empty schema
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
          draft.schema = EMPTY_SCHEMA as any;
          draft.schemaError =
            error instanceof Error ? error.message : 'Failed to load schema';
          draft.isLoadingSchema = false;
        });
      }
    },

    // =========================================================================
    // SERIALIZATION
    // =========================================================================

    serializeToYaml: (): string => {
      const state = get();
      if (!state.data) return '';
      return serializeFrontmatter(state.data);
    },

    // =========================================================================
    // RESET
    // =========================================================================

    reset: () => set(INITIAL_STATE),

    setChangeSource: (source: ChangeSource) =>
      set((draft) => {
        draft.lastChangeSource = source;
      }),
  }))
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Selector for frontmatter data.
 */
export const selectData = (state: FrontmatterStore): FrontmatterData | null =>
  state.data;

/**
 * Selector for frontmatter fields.
 */
export const selectFields = (
  state: FrontmatterStore
): FrontmatterField[] => state.data?.fields ?? [];

/**
 * Selector for current mode.
 */
export const selectMode = (state: FrontmatterStore): FrontmatterMode =>
  state.mode;

/**
 * Selector for panel visibility.
 */
export const selectIsPanelOpen = (state: FrontmatterStore): boolean =>
  state.isPanelOpen;

/**
 * Selector for dirty state.
 */
export const selectIsDirty = (state: FrontmatterStore): boolean =>
  state.isDirty;

/**
 * Selector for raw YAML draft.
 */
export const selectRawYamlDraft = (state: FrontmatterStore): string =>
  state.rawYamlDraft;

/**
 * Selector for whether frontmatter exists.
 */
export const selectExists = (state: FrontmatterStore): boolean =>
  state.data?.exists ?? false;

/**
 * Selector for parse errors.
 */
export const selectParseError = (
  state: FrontmatterStore
): FrontmatterData['parseError'] => state.data?.parseError ?? null;

/**
 * Selector for validation errors across all fields.
 */
export const selectHasValidationErrors = (state: FrontmatterStore): boolean =>
  state.data?.fields.some((f) => !f.validation.valid) ?? false;

/**
 * Selector for the count of validation errors across all fields.
 */
export const selectValidationErrorCount = (state: FrontmatterStore): number =>
  state.data?.fields.filter((f) => !f.validation.valid).length ?? 0;

/**
 * Selector for schema.
 */
export const selectSchema = (
  state: FrontmatterStore
): FrontmatterSchema | null => state.schema;

/**
 * Selector for last change source.
 */
export const selectLastChangeSource = (
  state: FrontmatterStore
): ChangeSource => state.lastChangeSource;
