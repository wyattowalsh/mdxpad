/**
 * AddFieldDropdown Component
 *
 * Dropdown menu for adding new frontmatter fields.
 * Shows common field suggestions and allows custom field name input.
 *
 * @module renderer/components/frontmatter/AddFieldDropdown
 */

import { memo, useState, useCallback, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@renderer/components/ui/dropdown-menu';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Plus, Type, AlignLeft, Hash, ToggleLeft, Calendar, Tags } from 'lucide-react';
import type { FieldType, CommonFieldSuggestion } from '@shared/types/frontmatter';
import { COMMON_FIELDS } from '@shared/types/frontmatter';

// =============================================================================
// TYPES
// =============================================================================

/** Props for AddFieldDropdown component. */
export interface AddFieldDropdownProps {
  readonly existingFields: readonly string[];
  readonly onAddField: (name: string, type: FieldType) => void;
  readonly disabled?: boolean;
}

// =============================================================================
// FIELD TYPE ICONS
// =============================================================================

const FIELD_TYPE_ICONS: Record<FieldType, React.ComponentType<{ className?: string }>> = {
  text: Type,
  textarea: AlignLeft,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  array: Tags,
  object: AlignLeft,
};

// =============================================================================
// SUGGESTION ITEM
// =============================================================================

interface SuggestionItemProps {
  readonly suggestion: CommonFieldSuggestion;
  readonly onSelect: (suggestion: CommonFieldSuggestion) => void;
}

const SuggestionItem = memo(function SuggestionItem(props: SuggestionItemProps): React.JSX.Element {
  const { suggestion, onSelect } = props;
  const Icon = FIELD_TYPE_ICONS[suggestion.type];
  const handleSelect = useCallback(() => onSelect(suggestion), [onSelect, suggestion]);

  return (
    <DropdownMenuItem onSelect={handleSelect} className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="font-medium">{suggestion.name}</span>
        <span className="text-xs text-muted-foreground">{suggestion.description}</span>
      </div>
    </DropdownMenuItem>
  );
});

// =============================================================================
// CUSTOM FIELD INPUT
// =============================================================================

interface CustomFieldInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly isValid: boolean;
  readonly isDuplicate: boolean;
}

const CustomFieldInput = memo(function CustomFieldInput(props: CustomFieldInputProps): React.JSX.Element {
  const { value, onChange, onSubmit, isValid, isDuplicate } = props;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), [onChange]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onSubmit();
      }
      e.stopPropagation();
    },
    [onSubmit]
  );

  return (
    <div className="p-2">
      <DropdownMenuLabel className="px-0 pb-2">Custom Field</DropdownMenuLabel>
      <div className="flex gap-2">
        <Input placeholder="Field name" value={value} onChange={handleChange} onKeyDown={handleKeyDown} className="h-8 text-sm" />
        <Button size="sm" variant="secondary" onClick={onSubmit} disabled={!isValid} className="h-8 px-3">
          Add
        </Button>
      </div>
      {isDuplicate && <p className="mt-1 text-xs text-destructive">Field already exists</p>}
    </div>
  );
});

// =============================================================================
// SUGGESTIONS LIST
// =============================================================================

interface SuggestionsListProps {
  readonly suggestions: readonly CommonFieldSuggestion[];
  readonly onSelect: (suggestion: CommonFieldSuggestion) => void;
}

const SuggestionsList = memo(function SuggestionsList(props: SuggestionsListProps): React.JSX.Element | null {
  const { suggestions, onSelect } = props;
  if (suggestions.length === 0) return null;

  return (
    <>
      <DropdownMenuLabel>Common Fields</DropdownMenuLabel>
      {suggestions.map((suggestion) => (
        <SuggestionItem key={suggestion.name} suggestion={suggestion} onSelect={onSelect} />
      ))}
      <DropdownMenuSeparator />
    </>
  );
});

// =============================================================================
// HOOKS
// =============================================================================

function useDropdownState(existingFields: readonly string[], onAddField: (name: string, type: FieldType) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFieldName, setCustomFieldName] = useState('');

  const availableSuggestions = useMemo<readonly CommonFieldSuggestion[]>(() => {
    const existingSet = new Set(existingFields);
    return COMMON_FIELDS.filter((field) => !existingSet.has(field.name));
  }, [existingFields]);

  const trimmedName = customFieldName.trim();
  const isDuplicate = trimmedName.length > 0 && existingFields.includes(trimmedName);
  const isCustomFieldValid = trimmedName.length > 0 && !isDuplicate;

  const handleSelectSuggestion = useCallback(
    (suggestion: CommonFieldSuggestion) => {
      onAddField(suggestion.name, suggestion.type);
      setIsOpen(false);
    },
    [onAddField]
  );

  const handleAddCustomField = useCallback(() => {
    if (isCustomFieldValid) {
      onAddField(trimmedName, 'text');
      setCustomFieldName('');
      setIsOpen(false);
    }
  }, [isCustomFieldValid, onAddField, trimmedName]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setCustomFieldName('');
  }, []);

  return {
    isOpen,
    customFieldName,
    setCustomFieldName,
    availableSuggestions,
    isDuplicate,
    isCustomFieldValid,
    handleSelectSuggestion,
    handleAddCustomField,
    handleOpenChange,
  };
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

function AddFieldDropdownComponent(props: AddFieldDropdownProps): React.JSX.Element {
  const { existingFields, onAddField, disabled = false } = props;
  const state = useDropdownState(existingFields, onAddField);

  return (
    <DropdownMenu open={state.isOpen} onOpenChange={state.handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="w-full justify-start gap-2">
          <Plus className="h-4 w-4" />
          Add Field
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <SuggestionsList suggestions={state.availableSuggestions} onSelect={state.handleSelectSuggestion} />
        <CustomFieldInput
          value={state.customFieldName}
          onChange={state.setCustomFieldName}
          onSubmit={state.handleAddCustomField}
          isValid={state.isCustomFieldValid}
          isDuplicate={state.isDuplicate}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const AddFieldDropdown = memo(AddFieldDropdownComponent);
AddFieldDropdown.displayName = 'AddFieldDropdown';
