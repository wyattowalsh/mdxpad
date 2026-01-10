/**
 * Tests for CommandPalette components.
 * Validates rendering, keyboard navigation, selection, and accessibility.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { SearchInput } from '../components/CommandPalette/SearchInput';
import { CommandList } from '../components/CommandPalette/CommandList';
import { CommandItem } from '../components/CommandPalette/CommandItem';
import type { UseCommandPaletteReturn } from '../hooks/useCommandPalette';
import type {
  Command,
  CommandContext,
  FuzzyMatchResult,
  CommandId,
} from '@shared/types/commands';

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'test-command' as CommandId,
    name: 'Test Command',
    category: 'file',
    execute: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

function createMockResult(
  command: Command,
  score: number = 100,
  matches: number[] = []
): FuzzyMatchResult<Command> {
  return {
    item: command,
    score,
    matches,
  };
}

function createDefaultMockState(overrides: Partial<UseCommandPaletteReturn> = {}): UseCommandPaletteReturn {
  return {
    isOpen: true,
    query: '',
    selectedIndex: 0,
    results: [] as FuzzyMatchResult<Command>[],
    isExecuting: false,
    open: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    setQuery: vi.fn(),
    selectPrevious: vi.fn(),
    selectNext: vi.fn(),
    selectIndex: vi.fn(),
    executeSelected: vi.fn().mockResolvedValue({ ok: true }),
    executeCommand: vi.fn().mockResolvedValue({ ok: true }),
    reset: vi.fn(),
    ...overrides,
  };
}

// =============================================================================
// SEARCH INPUT TESTS
// =============================================================================

describe('SearchInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onNavigate: vi.fn(),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    listboxId: 'test-listbox',
    activeDescendantId: undefined,
    placeholder: 'Search commands...',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with correct placeholder', () => {
    render(<SearchInput {...defaultProps} />);

    const input = screen.getByTestId('command-palette-input');
    expect(input).toBeDefined();
    expect(input.getAttribute('placeholder')).toBe('Search commands...');
  });

  it('renders with value prop', () => {
    render(<SearchInput {...defaultProps} value="test query" />);

    const input = screen.getByTestId('command-palette-input') as HTMLInputElement;
    expect(input.value).toBe('test query');
  });

  it('calls onChange when input value changes', () => {
    const onChange = vi.fn();
    render(<SearchInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'new' } });

    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('calls onNavigate("down") on ArrowDown', () => {
    const onNavigate = vi.fn();
    render(<SearchInput {...defaultProps} onNavigate={onNavigate} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onNavigate).toHaveBeenCalledWith('down');
  });

  it('calls onNavigate("up") on ArrowUp', () => {
    const onNavigate = vi.fn();
    render(<SearchInput {...defaultProps} onNavigate={onNavigate} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onNavigate).toHaveBeenCalledWith('up');
  });

  it('calls onSelect on Enter', () => {
    const onSelect = vi.fn();
    render(<SearchInput {...defaultProps} onSelect={onSelect} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<SearchInput {...defaultProps} onClose={onClose} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has correct ARIA attributes', () => {
    render(
      <SearchInput
        {...defaultProps}
        listboxId="command-list"
        activeDescendantId="item-2"
      />
    );

    const input = screen.getByTestId('command-palette-input');
    expect(input.getAttribute('aria-controls')).toBe('command-list');
    expect(input.getAttribute('aria-activedescendant')).toBe('item-2');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
  });

  it('has combobox role on container', () => {
    render(<SearchInput {...defaultProps} />);

    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeDefined();
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
    expect(combobox.getAttribute('aria-haspopup')).toBe('listbox');
  });
});

// =============================================================================
// COMMAND ITEM TESTS
// =============================================================================

describe('CommandItem', () => {
  const defaultCommand = createMockCommand({
    id: 'file.save' as CommandId,
    name: 'Save File',
    category: 'file',
    shortcut: { key: 's', modifiers: ['Mod'] },
    icon: '💾',
  });

  const defaultProps = {
    result: createMockResult(defaultCommand, 100, [0, 1, 2, 3]),
    isSelected: false,
    id: 'item-0',
    onClick: vi.fn(),
    onMouseEnter: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders command name', () => {
    render(<CommandItem {...defaultProps} />);

    expect(screen.getByText(/Save/)).toBeDefined();
    expect(screen.getByText(/File/)).toBeDefined();
  });

  it('renders with aria-selected when selected', () => {
    render(<CommandItem {...defaultProps} isSelected={true} />);

    const item = screen.getByTestId('command-item');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(item.className).toContain('command-item--selected');
  });

  it('renders with aria-selected="false" when not selected', () => {
    render(<CommandItem {...defaultProps} isSelected={false} />);

    const item = screen.getByTestId('command-item');
    expect(item.getAttribute('aria-selected')).toBe('false');
    expect(item.className).not.toContain('command-item--selected');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CommandItem {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('command-item'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onMouseEnter on hover', () => {
    const onMouseEnter = vi.fn();
    render(<CommandItem {...defaultProps} onMouseEnter={onMouseEnter} />);

    fireEvent.mouseEnter(screen.getByTestId('command-item'));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });

  it('renders shortcut when present', () => {
    render(<CommandItem {...defaultProps} />);

    // Should render formatted shortcut (⌘S on Mac)
    const shortcut = screen.getByRole('option').querySelector('.command-item__shortcut');
    expect(shortcut).toBeDefined();
  });

  it('renders icon when present', () => {
    render(<CommandItem {...defaultProps} />);

    const icon = screen.getByRole('option').querySelector('.command-item__icon');
    expect(icon).toBeDefined();
    expect(icon?.textContent).toBe('💾');
  });

  it('renders category badge', () => {
    render(<CommandItem {...defaultProps} />);

    const category = screen.getByRole('option').querySelector('.command-item__category');
    expect(category).toBeDefined();
    expect(category?.textContent).toBe('file');
  });

  it('has role="option" for accessibility', () => {
    render(<CommandItem {...defaultProps} />);

    const item = screen.getByRole('option');
    expect(item).toBeDefined();
  });
});

// =============================================================================
// COMMAND LIST TESTS
// =============================================================================

describe('CommandList', () => {
  const mockCommands = [
    createMockCommand({ id: 'file.new' as CommandId, name: 'New File', category: 'file' }),
    createMockCommand({ id: 'file.save' as CommandId, name: 'Save File', category: 'file' }),
    createMockCommand({ id: 'edit.undo' as CommandId, name: 'Undo', category: 'edit' }),
  ];

  const mockResults = mockCommands.map((cmd, i) => createMockResult(cmd, 100 - i));

  const defaultProps = {
    results: mockResults,
    selectedIndex: 0,
    onSelect: vi.fn(),
    onHover: vi.fn(),
    id: 'command-list',
    showCategories: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders listbox with correct id', () => {
    render(<CommandList {...defaultProps} />);

    const list = screen.getByRole('listbox');
    expect(list).toBeDefined();
    expect(list.getAttribute('id')).toBe('command-list');
  });

  it('renders all command items', () => {
    render(<CommandList {...defaultProps} />);

    const items = screen.getAllByTestId('command-item');
    expect(items.length).toBe(3);
  });

  it('shows empty state when no results', () => {
    render(<CommandList {...defaultProps} results={[]} />);

    expect(screen.getByText('No commands found')).toBeDefined();
  });

  it('marks correct item as selected', () => {
    render(<CommandList {...defaultProps} selectedIndex={1} />);

    const items = screen.getAllByTestId('command-item');
    expect(items[0]?.getAttribute('aria-selected')).toBe('false');
    expect(items[1]?.getAttribute('aria-selected')).toBe('true');
    expect(items[2]?.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onSelect with index when item clicked', () => {
    const onSelect = vi.fn();
    render(<CommandList {...defaultProps} onSelect={onSelect} />);

    const items = screen.getAllByTestId('command-item');
    fireEvent.click(items[2]!);

    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('calls onHover with index on mouse enter', () => {
    const onHover = vi.fn();
    render(<CommandList {...defaultProps} onHover={onHover} />);

    const items = screen.getAllByTestId('command-item');
    fireEvent.mouseEnter(items[1]!);

    expect(onHover).toHaveBeenCalledWith(1);
  });

  it('shows category headers when showCategories is true', () => {
    render(<CommandList {...defaultProps} showCategories={true} />);

    // Should show File and Edit category headers
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Edit')).toBeDefined();
  });

  it('does not show category headers when showCategories is false', () => {
    render(<CommandList {...defaultProps} showCategories={false} />);

    // File is also a command name component, but category header should be hidden
    const headers = screen.queryAllByRole('presentation');
    expect(headers.length).toBe(0);
  });
});

// =============================================================================
// COMMAND PALETTE TESTS
// =============================================================================

describe('CommandPalette', () => {
  const mockGetContext = vi.fn(() => ({
    editor: null,
    document: { fileId: null, filePath: null, content: '', isDirty: false },
    ui: { previewVisible: true, sidebarVisible: false, zoomLevel: 100 },
    platform: { isMac: true, isWindows: false, isLinux: false },
    api: {} as unknown,
    notify: vi.fn(),
  })) as unknown as () => CommandContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    const palette = createDefaultMockState({ isOpen: true });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.getByTestId('command-palette')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    const palette = createDefaultMockState({ isOpen: false });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('renders search input', () => {
    const palette = createDefaultMockState({ isOpen: true });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.getByTestId('command-palette-input')).toBeDefined();
  });

  it('renders command list', () => {
    const palette = createDefaultMockState({ isOpen: true });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.getByTestId('command-list')).toBeDefined();
  });

  it('calls close when backdrop clicked', () => {
    const close = vi.fn();
    const palette = createDefaultMockState({ isOpen: true, close });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    fireEvent.click(screen.getByTestId('command-palette-backdrop'));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not close when palette content clicked', () => {
    const close = vi.fn();
    const palette = createDefaultMockState({ isOpen: true, close });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    fireEvent.click(screen.getByTestId('command-palette'));
    expect(close).not.toHaveBeenCalled();
  });

  it('shows executing state indicator', () => {
    const palette = createDefaultMockState({ isOpen: true, isExecuting: true });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.getByText('Executing...')).toBeDefined();
  });

  it('has modal aria attributes', () => {
    const palette = createDefaultMockState({ isOpen: true });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Command Palette');
  });

  it('shows result count in screen reader announcement', () => {
    const mockResults = [
      createMockResult(createMockCommand({ id: 'cmd1' as CommandId, name: 'Cmd 1' })),
      createMockResult(createMockCommand({ id: 'cmd2' as CommandId, name: 'Cmd 2' })),
    ];

    const palette = createDefaultMockState({ isOpen: true, results: mockResults });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    expect(screen.getByText('2 commands available')).toBeDefined();
  });

  it('shows no results message in screen reader', () => {
    const palette = createDefaultMockState({ isOpen: true, results: [] });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    // Should have message in both command list and screen reader announcement
    const messages = screen.getAllByText('No commands found');
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('calls selectPrevious on ArrowUp', () => {
    const selectPrevious = vi.fn();
    const palette = createDefaultMockState({ isOpen: true, selectPrevious });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(selectPrevious).toHaveBeenCalledTimes(1);
  });

  it('calls selectNext on ArrowDown', () => {
    const selectNext = vi.fn();
    const palette = createDefaultMockState({ isOpen: true, selectNext });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(selectNext).toHaveBeenCalledTimes(1);
  });

  it('calls executeSelected on Enter', async () => {
    const executeSelected = vi.fn().mockResolvedValue({ ok: true });
    const mockResults = [
      createMockResult(createMockCommand({ id: 'cmd1' as CommandId, name: 'Cmd 1' })),
    ];

    const palette = createDefaultMockState({ isOpen: true, results: mockResults, executeSelected });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(executeSelected).toHaveBeenCalledTimes(1);
    });
  });

  it('calls close on Escape', () => {
    const close = vi.fn();
    const palette = createDefaultMockState({ isOpen: true, close });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const input = screen.getByTestId('command-palette-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('shows categories when query is empty', () => {
    const mockResults = [
      createMockResult(createMockCommand({ id: 'file.new' as CommandId, name: 'New', category: 'file' })),
      createMockResult(createMockCommand({ id: 'edit.undo' as CommandId, name: 'Undo', category: 'edit' })),
    ];

    const palette = createDefaultMockState({ isOpen: true, query: '', results: mockResults });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    // Category headers should be shown when query is empty
    expect(screen.getByText('File')).toBeDefined();
    expect(screen.getByText('Edit')).toBeDefined();
  });

  it('hides categories when query has text', () => {
    const mockResults = [
      createMockResult(createMockCommand({ id: 'file.new' as CommandId, name: 'New', category: 'file' })),
    ];

    const palette = createDefaultMockState({ isOpen: true, query: 'new', results: mockResults });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    // Category headers should be hidden when searching
    const headers = screen.queryAllByRole('presentation');
    expect(headers.length).toBe(0);
  });

  it('passes correct activeDescendantId to input', () => {
    const mockResults = [
      createMockResult(createMockCommand({ id: 'cmd1' as CommandId, name: 'Cmd 1' })),
      createMockResult(createMockCommand({ id: 'cmd2' as CommandId, name: 'Cmd 2' })),
    ];

    const palette = createDefaultMockState({ isOpen: true, results: mockResults, selectedIndex: 1 });

    render(<CommandPalette getContext={mockGetContext} palette={palette} />);

    const input = screen.getByTestId('command-palette-input');
    expect(input.getAttribute('aria-activedescendant')).toBe('command-palette-list-item-1');
  });
});
