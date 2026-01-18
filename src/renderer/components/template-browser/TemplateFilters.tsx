/**
 * Template Filters Component
 *
 * Feature: 016-template-library
 * Phase: 3 - Implementation
 *
 * Provides search and category filtering for the template browser.
 * Includes a search input, category dropdown, and clear filters button.
 */

import * as React from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Input } from '@ui/input';
import { Button } from '@ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import type { TemplateCategory } from '@shared/contracts/template-schemas';

// =============================================================================
// Types
// =============================================================================

export interface TemplateFiltersProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Current category filter (null means "All Categories") */
  categoryFilter: TemplateCategory | null;
  /** Callback when category filter changes */
  onCategoryChange: (category: TemplateCategory | null) => void;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Display names for template categories
 */
export const CATEGORY_DISPLAY_NAMES: Record<TemplateCategory, string> = {
  blog: 'Blog Posts',
  documentation: 'Documentation',
  presentation: 'Presentations',
  notes: 'Meeting Notes',
  tutorial: 'Tutorials',
  custom: 'Custom',
};

/**
 * All template categories in display order
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'blog',
  'documentation',
  'presentation',
  'notes',
  'tutorial',
  'custom',
];

// =============================================================================
// Sub-components
// =============================================================================

interface SearchInputProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function SearchInput({ value, onChange }: SearchInputProps): React.JSX.Element {
  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder="Search templates..."
        value={value}
        onChange={onChange}
        className="pl-9 pr-3"
        aria-label="Search templates"
      />
    </div>
  );
}

interface CategoryDropdownProps {
  value: TemplateCategory | null;
  onSelect: (category: TemplateCategory | null) => void;
}

function CategoryDropdown({ value, onSelect }: CategoryDropdownProps): React.JSX.Element {
  const displayText = value ? CATEGORY_DISPLAY_NAMES[value] : 'All Categories';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn('w-full sm:w-[180px] justify-between', value && 'text-foreground')}
          aria-label="Filter by category"
        >
          <span className="truncate">{displayText}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuItem
          onClick={() => onSelect(null)}
          className="flex items-center justify-between"
        >
          <span>All Categories</span>
          {value === null && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        {TEMPLATE_CATEGORIES.map((category) => (
          <DropdownMenuItem
            key={category}
            onClick={() => onSelect(category)}
            className="flex items-center justify-between"
          >
            <span>{CATEGORY_DISPLAY_NAMES[category]}</span>
            {value === category && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ClearButtonProps {
  onClick: () => void;
}

function ClearButton({ onClick }: ClearButtonProps): React.JSX.Element {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-9 px-2 sm:px-3"
      aria-label="Clear all filters"
    >
      <X className="h-4 w-4 mr-1" />
      <span className="hidden sm:inline">Clear</span>
    </Button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

/**
 * Template filters component with search input and category dropdown.
 *
 * Layout:
 * - Horizontal layout with search on left, category dropdown on right
 * - Clear filters button appears when any filter is active
 * - Responsive: stacks on smaller widths
 */
export function TemplateFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
}: TemplateFiltersProps): React.JSX.Element {
  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== null;

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onSearchChange(event.target.value),
    [onSearchChange]
  );

  const handleClearFilters = React.useCallback(() => {
    onSearchChange('');
    onCategoryChange(null);
  }, [onSearchChange, onCategoryChange]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <SearchInput value={searchQuery} onChange={handleSearchChange} />
      <CategoryDropdown value={categoryFilter} onSelect={onCategoryChange} />
      {hasActiveFilters && <ClearButton onClick={handleClearFilters} />}
    </div>
  );
}

export default TemplateFilters;
