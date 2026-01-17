/**
 * Outline Store Tests
 *
 * Tests for the outline store including AST transformation,
 * section collapse, and state management.
 *
 * @module renderer/stores/outline-store.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useOutlineStore,
  selectSections,
  selectHeadingsSection,
  selectComponentsSection,
  selectFrontmatterSection,
  selectIsParsing,
  selectParseError,
  selectLastUpdated,
  selectHasContent,
} from './outline-store';
import type { OutlineAST, OutlineItem } from '@shared/types/outline';
import { INITIAL_OUTLINE_STATE, buildHeadingHierarchy } from '@shared/types/outline';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock OutlineAST for testing.
 */
function createMockAST(options: {
  headings?: Array<{ depth: 1 | 2 | 3 | 4 | 5 | 6; text: string; line?: number }>;
  components?: Array<{ name: string; line?: number }>;
  frontmatter?: Record<string, unknown> | null;
} = {}): OutlineAST {
  const { headings = [], components = [], frontmatter = null } = options;

  return {
    headings: headings.map((h, i) => ({
      depth: h.depth,
      text: h.text,
      position: { line: h.line ?? i + 1, column: 1 },
    })),
    components: components.map((c, i) => ({
      name: c.name,
      position: { line: c.line ?? i + 10, column: 1 },
    })),
    frontmatter: frontmatter
      ? { data: frontmatter, endLine: 5 }
      : null,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('useOutlineStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useOutlineStore.getState().reset();
  });

  describe('initial state', () => {
    it('should have three sections: frontmatter, headings, components', () => {
      const state = useOutlineStore.getState();
      expect(state.sections).toHaveLength(3);
      expect(state.sections.map((s) => s.id)).toEqual([
        'frontmatter',
        'headings',
        'components',
      ]);
    });

    it('should start with all sections empty', () => {
      const state = useOutlineStore.getState();
      expect(state.sections.every((s) => s.isEmpty)).toBe(true);
      expect(state.sections.every((s) => s.items.length === 0)).toBe(true);
    });

    it('should start with all sections expanded (not collapsed)', () => {
      const state = useOutlineStore.getState();
      expect(state.sections.every((s) => !s.isCollapsed)).toBe(true);
    });

    it('should start with isParsing false', () => {
      const state = useOutlineStore.getState();
      expect(state.isParsing).toBe(false);
    });

    it('should start with parseError null', () => {
      const state = useOutlineStore.getState();
      expect(state.parseError).toBeNull();
    });

    it('should start with lastUpdated 0', () => {
      const state = useOutlineStore.getState();
      expect(state.lastUpdated).toBe(0);
    });
  });

  describe('updateFromAST', () => {
    it('should populate headings section from AST', () => {
      const ast = createMockAST({
        headings: [
          { depth: 1, text: 'Title' },
          { depth: 2, text: 'Section A' },
          { depth: 2, text: 'Section B' },
        ],
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const headingsSection = state.sections.find((s) => s.id === 'headings');
      expect(headingsSection?.items).toHaveLength(3);
      expect(headingsSection?.isEmpty).toBe(false);
      expect(headingsSection?.items[0]?.label).toBe('Title');
      expect(headingsSection?.items[0]?.level).toBe(1);
      expect(headingsSection?.items[1]?.label).toBe('Section A');
      expect(headingsSection?.items[1]?.level).toBe(2);
    });

    it('should populate components section from AST', () => {
      const ast = createMockAST({
        components: [
          { name: 'Button' },
          { name: 'Card' },
        ],
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const componentsSection = state.sections.find((s) => s.id === 'components');
      expect(componentsSection?.items).toHaveLength(2);
      expect(componentsSection?.isEmpty).toBe(false);
      expect(componentsSection?.items[0]?.label).toBe('Button');
      expect(componentsSection?.items[1]?.label).toBe('Card');
    });

    it('should populate frontmatter section from AST', () => {
      const ast = createMockAST({
        frontmatter: {
          title: 'My Document',
          date: '2024-01-15',
        },
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const fmSection = state.sections.find((s) => s.id === 'frontmatter');
      expect(fmSection?.items).toHaveLength(2);
      expect(fmSection?.isEmpty).toBe(false);
      expect(fmSection?.items[0]?.label).toBe('title: My Document');
      expect(fmSection?.items[1]?.label).toBe('date: 2024-01-15');
    });

    it('should handle empty AST', () => {
      const ast = createMockAST({});

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      expect(state.sections.every((s) => s.isEmpty)).toBe(true);
    });

    it('should update lastUpdated timestamp', () => {
      const before = Date.now();
      const ast = createMockAST({ headings: [{ depth: 1, text: 'Test' }] });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(Date.now());
    });

    it('should clear parseError on successful update', () => {
      // Set an error first
      useOutlineStore.getState().setParseError('Some error');
      expect(useOutlineStore.getState().parseError).toBe('Some error');

      // Update from AST should clear it
      const ast = createMockAST({});
      useOutlineStore.getState().updateFromAST(ast);

      expect(useOutlineStore.getState().parseError).toBeNull();
    });

    it('should set isParsing to false after update', () => {
      useOutlineStore.getState().setIsParsing(true);
      expect(useOutlineStore.getState().isParsing).toBe(true);

      const ast = createMockAST({});
      useOutlineStore.getState().updateFromAST(ast);

      expect(useOutlineStore.getState().isParsing).toBe(false);
    });

    it('should preserve section collapse state on update', () => {
      // Collapse headings section
      useOutlineStore.getState().toggleSectionCollapse('headings');
      expect(
        useOutlineStore.getState().sections.find((s) => s.id === 'headings')?.isCollapsed
      ).toBe(true);

      // Update from AST
      const ast = createMockAST({ headings: [{ depth: 1, text: 'New' }] });
      useOutlineStore.getState().updateFromAST(ast);

      // Collapse state should be preserved
      expect(
        useOutlineStore.getState().sections.find((s) => s.id === 'headings')?.isCollapsed
      ).toBe(true);
    });

    it('should generate unique IDs for outline items', () => {
      const ast = createMockAST({
        headings: [
          { depth: 1, text: 'Title', line: 1 },
          { depth: 2, text: 'Section', line: 5 },
        ],
        components: [
          { name: 'Button', line: 10 },
        ],
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const headingsSection = state.sections.find((s) => s.id === 'headings');
      const componentsSection = state.sections.find((s) => s.id === 'components');

      // Check ID format
      expect(headingsSection?.items[0]?.id).toBe('h-1-1');
      expect(headingsSection?.items[1]?.id).toBe('h-5-1');
      expect(componentsSection?.items[0]?.id).toBe('c-Button-10');
    });

    it('should store line and column positions', () => {
      const ast = createMockAST({
        headings: [{ depth: 1, text: 'Title', line: 10 }],
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const headingsSection = state.sections.find((s) => s.id === 'headings');
      expect(headingsSection?.items[0]?.line).toBe(10);
      expect(headingsSection?.items[0]?.column).toBe(1);
    });

    it('should truncate long heading labels', () => {
      const longText = 'This is a very long heading that exceeds the maximum label length limit of 40 characters';
      const ast = createMockAST({
        headings: [{ depth: 1, text: longText }],
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const headingsSection = state.sections.find((s) => s.id === 'headings');
      const label = headingsSection?.items[0]?.label ?? '';
      expect(label.length).toBeLessThanOrEqual(40);
      expect(label.endsWith('...')).toBe(true);
    });

    it('should format array frontmatter values', () => {
      const ast = createMockAST({
        frontmatter: {
          tags: ['react', 'typescript', 'mdx'],
        },
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const fmSection = state.sections.find((s) => s.id === 'frontmatter');
      expect(fmSection?.items[0]?.label).toBe('tags: [3 items]');
    });

    it('should format object frontmatter values', () => {
      const ast = createMockAST({
        frontmatter: {
          author: { name: 'John', email: 'john@example.com' },
        },
      });

      useOutlineStore.getState().updateFromAST(ast);
      const state = useOutlineStore.getState();

      const fmSection = state.sections.find((s) => s.id === 'frontmatter');
      expect(fmSection?.items[0]?.label).toBe('author: {...}');
    });
  });

  describe('setIsParsing', () => {
    it('should set isParsing to true', () => {
      useOutlineStore.getState().setIsParsing(true);
      expect(useOutlineStore.getState().isParsing).toBe(true);
    });

    it('should set isParsing to false', () => {
      useOutlineStore.getState().setIsParsing(true);
      useOutlineStore.getState().setIsParsing(false);
      expect(useOutlineStore.getState().isParsing).toBe(false);
    });
  });

  describe('setParseError', () => {
    it('should set parse error message', () => {
      useOutlineStore.getState().setParseError('Syntax error at line 5');
      expect(useOutlineStore.getState().parseError).toBe('Syntax error at line 5');
    });

    it('should clear parse error when set to null', () => {
      useOutlineStore.getState().setParseError('Some error');
      useOutlineStore.getState().setParseError(null);
      expect(useOutlineStore.getState().parseError).toBeNull();
    });

    it('should set isParsing to false when error is set', () => {
      useOutlineStore.getState().setIsParsing(true);
      useOutlineStore.getState().setParseError('Error');
      expect(useOutlineStore.getState().isParsing).toBe(false);
    });
  });

  describe('toggleSectionCollapse', () => {
    it('should collapse an expanded section', () => {
      useOutlineStore.getState().toggleSectionCollapse('headings');
      const section = useOutlineStore.getState().sections.find((s) => s.id === 'headings');
      expect(section?.isCollapsed).toBe(true);
    });

    it('should expand a collapsed section', () => {
      useOutlineStore.getState().toggleSectionCollapse('headings');
      useOutlineStore.getState().toggleSectionCollapse('headings');
      const section = useOutlineStore.getState().sections.find((s) => s.id === 'headings');
      expect(section?.isCollapsed).toBe(false);
    });

    it('should only affect the targeted section', () => {
      useOutlineStore.getState().toggleSectionCollapse('headings');
      const state = useOutlineStore.getState();

      expect(state.sections.find((s) => s.id === 'headings')?.isCollapsed).toBe(true);
      expect(state.sections.find((s) => s.id === 'components')?.isCollapsed).toBe(false);
      expect(state.sections.find((s) => s.id === 'frontmatter')?.isCollapsed).toBe(false);
    });

    it('should work with all section types', () => {
      useOutlineStore.getState().toggleSectionCollapse('frontmatter');
      expect(
        useOutlineStore.getState().sections.find((s) => s.id === 'frontmatter')?.isCollapsed
      ).toBe(true);

      useOutlineStore.getState().toggleSectionCollapse('components');
      expect(
        useOutlineStore.getState().sections.find((s) => s.id === 'components')?.isCollapsed
      ).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset sections to initial state', () => {
      // Add some content
      const ast = createMockAST({
        headings: [{ depth: 1, text: 'Title' }],
        components: [{ name: 'Button' }],
        frontmatter: { title: 'Test' },
      });
      useOutlineStore.getState().updateFromAST(ast);

      // Collapse a section
      useOutlineStore.getState().toggleSectionCollapse('headings');

      // Reset
      useOutlineStore.getState().reset();

      const state = useOutlineStore.getState();
      expect(state.sections.every((s) => s.isEmpty)).toBe(true);
      expect(state.sections.every((s) => !s.isCollapsed)).toBe(true);
    });

    it('should reset lastUpdated to 0', () => {
      const ast = createMockAST({ headings: [{ depth: 1, text: 'Title' }] });
      useOutlineStore.getState().updateFromAST(ast);
      expect(useOutlineStore.getState().lastUpdated).toBeGreaterThan(0);

      useOutlineStore.getState().reset();
      expect(useOutlineStore.getState().lastUpdated).toBe(0);
    });

    it('should reset parseError to null', () => {
      useOutlineStore.getState().setParseError('Error');
      useOutlineStore.getState().reset();
      expect(useOutlineStore.getState().parseError).toBeNull();
    });

    it('should reset isParsing to false', () => {
      useOutlineStore.getState().setIsParsing(true);
      useOutlineStore.getState().reset();
      expect(useOutlineStore.getState().isParsing).toBe(false);
    });
  });
});

describe('selectors', () => {
  beforeEach(() => {
    useOutlineStore.getState().reset();
  });

  describe('selectSections', () => {
    it('should return all sections', () => {
      const sections = selectSections(useOutlineStore.getState());
      expect(sections).toHaveLength(3);
    });
  });

  describe('selectHeadingsSection', () => {
    it('should return headings section', () => {
      const section = selectHeadingsSection(useOutlineStore.getState());
      expect(section.id).toBe('headings');
      expect(section.label).toBe('Headings');
    });

    it('should reflect updates', () => {
      const ast = createMockAST({
        headings: [{ depth: 1, text: 'Title' }],
      });
      useOutlineStore.getState().updateFromAST(ast);

      const section = selectHeadingsSection(useOutlineStore.getState());
      expect(section.items).toHaveLength(1);
    });
  });

  describe('selectComponentsSection', () => {
    it('should return components section', () => {
      const section = selectComponentsSection(useOutlineStore.getState());
      expect(section.id).toBe('components');
      expect(section.label).toBe('Components');
    });
  });

  describe('selectFrontmatterSection', () => {
    it('should return frontmatter section', () => {
      const section = selectFrontmatterSection(useOutlineStore.getState());
      expect(section.id).toBe('frontmatter');
      expect(section.label).toBe('Frontmatter');
    });
  });

  describe('selectIsParsing', () => {
    it('should return isParsing state', () => {
      expect(selectIsParsing(useOutlineStore.getState())).toBe(false);

      useOutlineStore.getState().setIsParsing(true);
      expect(selectIsParsing(useOutlineStore.getState())).toBe(true);
    });
  });

  describe('selectParseError', () => {
    it('should return parseError state', () => {
      expect(selectParseError(useOutlineStore.getState())).toBeNull();

      useOutlineStore.getState().setParseError('Error message');
      expect(selectParseError(useOutlineStore.getState())).toBe('Error message');
    });
  });

  describe('selectLastUpdated', () => {
    it('should return lastUpdated timestamp', () => {
      expect(selectLastUpdated(useOutlineStore.getState())).toBe(0);

      const ast = createMockAST({ headings: [{ depth: 1, text: 'Test' }] });
      useOutlineStore.getState().updateFromAST(ast);

      expect(selectLastUpdated(useOutlineStore.getState())).toBeGreaterThan(0);
    });
  });

  describe('selectHasContent', () => {
    it('should return false when all sections are empty', () => {
      expect(selectHasContent(useOutlineStore.getState())).toBe(false);
    });

    it('should return true when any section has content', () => {
      const ast = createMockAST({
        headings: [{ depth: 1, text: 'Title' }],
      });
      useOutlineStore.getState().updateFromAST(ast);

      expect(selectHasContent(useOutlineStore.getState())).toBe(true);
    });

    it('should return true with only frontmatter', () => {
      const ast = createMockAST({
        frontmatter: { title: 'Test' },
      });
      useOutlineStore.getState().updateFromAST(ast);

      expect(selectHasContent(useOutlineStore.getState())).toBe(true);
    });

    it('should return true with only components', () => {
      const ast = createMockAST({
        components: [{ name: 'Button' }],
      });
      useOutlineStore.getState().updateFromAST(ast);

      expect(selectHasContent(useOutlineStore.getState())).toBe(true);
    });
  });
});

// ============================================================================
// buildHeadingHierarchy Tests
// ============================================================================

describe('buildHeadingHierarchy', () => {
  /**
   * Create a flat heading outline item for testing.
   */
  function createHeading(
    level: 1 | 2 | 3 | 4 | 5 | 6,
    text: string,
    line: number
  ): OutlineItem {
    return {
      id: `h-${line}-1`,
      type: 'heading',
      label: text,
      level,
      line,
      column: 1,
      children: [],
    };
  }

  it('should return empty array for empty input', () => {
    const result = buildHeadingHierarchy([]);
    expect(result).toEqual([]);
  });

  it('should return single H1 at root level', () => {
    const headings = [createHeading(1, 'Title', 1)];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('Title');
    expect(result[0]!.children).toHaveLength(0);
  });

  it('should nest H2 under H1', () => {
    const headings = [
      createHeading(1, 'Title', 1),
      createHeading(2, 'Section', 3),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('Title');
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.label).toBe('Section');
  });

  it('should nest H3 under H2 under H1', () => {
    const headings = [
      createHeading(1, 'Title', 1),
      createHeading(2, 'Section', 3),
      createHeading(3, 'Subsection', 5),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(1);
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children[0]!.label).toBe('Subsection');
  });

  it('should handle multiple H1s', () => {
    const headings = [
      createHeading(1, 'First', 1),
      createHeading(2, 'Sub1', 2),
      createHeading(1, 'Second', 5),
      createHeading(2, 'Sub2', 6),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe('First');
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.label).toBe('Sub1');
    expect(result[1]!.label).toBe('Second');
    expect(result[1]!.children).toHaveLength(1);
    expect(result[1]!.children[0]!.label).toBe('Sub2');
  });

  it('should handle H2 without parent H1', () => {
    const headings = [createHeading(2, 'Section', 1)];
    const result = buildHeadingHierarchy(headings);

    // H2 without H1 parent goes to root
    expect(result).toHaveLength(1);
    expect(result[0]!.label).toBe('Section');
  });

  it('should handle sibling H2s under same H1', () => {
    const headings = [
      createHeading(1, 'Title', 1),
      createHeading(2, 'Section A', 3),
      createHeading(2, 'Section B', 5),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(1);
    expect(result[0]!.children).toHaveLength(2);
    expect(result[0]!.children[0]!.label).toBe('Section A');
    expect(result[0]!.children[1]!.label).toBe('Section B');
  });

  it('should handle deep nesting H1-H2-H3-H4', () => {
    const headings = [
      createHeading(1, 'H1', 1),
      createHeading(2, 'H2', 2),
      createHeading(3, 'H3', 3),
      createHeading(4, 'H4', 4),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(1);
    expect(result[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children[0]!.children).toHaveLength(1);
    expect(result[0]!.children[0]!.children[0]!.children[0]!.label).toBe('H4');
  });

  it('should handle skipped levels (H1 -> H3)', () => {
    const headings = [
      createHeading(1, 'Title', 1),
      createHeading(3, 'Skipped', 3),
    ];
    const result = buildHeadingHierarchy(headings);

    // H3 goes to root when no H2 parent exists (both at root level)
    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe('Title');
    expect(result[1]!.label).toBe('Skipped');
  });

  it('should handle complex mixed structure', () => {
    const headings = [
      createHeading(1, 'Chapter 1', 1),
      createHeading(2, 'Section 1.1', 2),
      createHeading(3, 'Sub 1.1.1', 3),
      createHeading(2, 'Section 1.2', 4),
      createHeading(1, 'Chapter 2', 5),
      createHeading(2, 'Section 2.1', 6),
    ];
    const result = buildHeadingHierarchy(headings);

    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe('Chapter 1');
    expect(result[0]!.children).toHaveLength(2);
    expect(result[0]!.children[0]!.label).toBe('Section 1.1');
    expect(result[0]!.children[0]!.children).toHaveLength(1);
    expect(result[0]!.children[1]!.label).toBe('Section 1.2');
    expect(result[1]!.label).toBe('Chapter 2');
    expect(result[1]!.children).toHaveLength(1);
  });
});
