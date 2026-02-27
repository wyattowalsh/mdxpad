/**
 * Built-in Slash Command Definitions
 *
 * Defines the default slash commands available in the editor.
 * Each command specifies a label, description, and insertion template.
 *
 * @module renderer/lib/editor/extensions/slash-command-definitions
 */

// =============================================================================
// Types
// =============================================================================

/**
 * A slash command definition.
 */
export interface SlashCommand {
  /** Command name (without leading `/`) */
  readonly name: string;
  /** Display label in the completion menu */
  readonly label: string;
  /** Description shown in the completion detail */
  readonly description: string;
  /** Category for grouping (optional) */
  readonly category?: string;
  /** Text to insert when the command is selected */
  readonly template: string;
  /**
   * Number of characters to offset the cursor back from the end
   * of the inserted text. Defaults to 0 (cursor at end).
   */
  readonly cursorOffset?: number;
}

// =============================================================================
// Built-in Commands
// =============================================================================

export const BUILTIN_SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'heading',
    label: 'Heading',
    description: 'Insert a heading (H2)',
    category: 'Structure',
    template: '## ',
  },
  {
    name: 'code',
    label: 'Code Block',
    description: 'Insert a fenced code block',
    category: 'Code',
    template: '```\n\n```',
    cursorOffset: 4,
  },
  {
    name: 'image',
    label: 'Image',
    description: 'Insert an image',
    category: 'Media',
    template: '![alt text](url)',
    cursorOffset: 1,
  },
  {
    name: 'table',
    label: 'Table',
    description: 'Insert a Markdown table',
    category: 'Structure',
    template: '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |',
  },
  {
    name: 'divider',
    label: 'Divider',
    description: 'Insert a horizontal rule',
    category: 'Structure',
    template: '---\n',
  },
  {
    name: 'quote',
    label: 'Blockquote',
    description: 'Insert a blockquote',
    category: 'Structure',
    template: '> ',
  },
  {
    name: 'list',
    label: 'Bullet List',
    description: 'Insert a bulleted list',
    category: 'Structure',
    template: '- ',
  },
  {
    name: 'todo',
    label: 'Todo Item',
    description: 'Insert a task list item',
    category: 'Structure',
    template: '- [ ] ',
  },
  {
    name: 'mermaid',
    label: 'Mermaid Diagram',
    description: 'Insert a Mermaid diagram block',
    category: 'Code',
    template: '```mermaid\ngraph TD\n  A --> B\n```',
    cursorOffset: 4,
  },
  {
    name: 'math',
    label: 'Math Block',
    description: 'Insert a LaTeX math block',
    category: 'Code',
    template: '$$\n\n$$',
    cursorOffset: 3,
  },
  {
    name: 'component',
    label: 'Component',
    description: 'Insert an MDX component',
    category: 'MDX',
    template: '<Component>\n  \n</Component>',
    cursorOffset: 13,
  },
] as const;
