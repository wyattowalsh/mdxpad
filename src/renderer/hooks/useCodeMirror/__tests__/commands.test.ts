/**
 * Comprehensive tests for CodeMirror commands module.
 * Tests all 12 markdown/MDX editing commands.
 *
 * @see commands.ts for implementation
 * @see contracts/editor-api.ts for command specifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { searchKeymap } from '@codemirror/search';
import { keymap } from '@codemirror/view';
import { executeCommand, markdownKeymap, type EditorCommandName } from '../commands';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create an EditorView with initial document and selection.
 */
function createEditorView(doc: string, selectionFrom: number, selectionTo?: number): EditorView {
  const to = selectionTo ?? selectionFrom;
  const state = EditorState.create({
    doc,
    selection: { anchor: selectionFrom, head: to },
    extensions: [
      history(),
      keymap.of(searchKeymap),
      markdownKeymap,
    ],
  });

  const container = document.createElement('div');
  document.body.appendChild(container);

  return new EditorView({
    state,
    parent: container,
  });
}

/**
 * Get the current document content from an EditorView.
 */
function getDoc(view: EditorView): string {
  return view.state.doc.toString();
}

/**
 * Get the current selection from an EditorView.
 */
function getSelection(view: EditorView): { from: number; to: number } {
  const { from, to } = view.state.selection.main;
  return { from, to };
}

/**
 * Clean up EditorView by removing from DOM.
 */
function cleanup(view: EditorView): void {
  view.dom.parentElement?.removeChild(view.dom);
  view.destroy();
}

// =============================================================================
// Tests
// =============================================================================

describe('Commands Module', () => {
  describe('toggleBold', () => {
    it('should wrap plain text selection in **', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**hello** world');
      cleanup(view);
    });

    it('should remove ** when selection is already wrapped', () => {
      const view = createEditorView('**hello** world', 0, 9);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('hello world');
      cleanup(view);
    });

    it('should remove surrounding ** markers when cursor is inside bold text', () => {
      const view = createEditorView('**hello** world', 2, 7);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('hello world');
      cleanup(view);
    });

    it('should handle empty selection by inserting **** with cursor between', () => {
      const view = createEditorView('hello world', 5, 5);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('hello**** world');
      const selection = getSelection(view);
      expect(selection.from).toBe(7); // cursor between the **
      expect(selection.to).toBe(7);
      cleanup(view);
    });

    it('should handle multi-word selection', () => {
      const view = createEditorView('hello beautiful world', 0, 15);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**hello beautiful** world');
      cleanup(view);
    });

    it('should position cursor correctly after adding bold markers', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'bold');

      const selection = getSelection(view);
      expect(selection.from).toBe(2); // after opening **
      expect(selection.to).toBe(7); // before closing **
      cleanup(view);
    });

    it('should handle selection at document start', () => {
      const view = createEditorView('start', 0, 5);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**start**');
      cleanup(view);
    });

    it('should handle selection at document end', () => {
      const view = createEditorView('the end', 4, 7);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('the **end**');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 4);

      const result = executeCommand(view, 'bold');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('toggleItalic', () => {
    it('should wrap plain text selection in *', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'italic');

      expect(getDoc(view)).toBe('*hello* world');
      cleanup(view);
    });

    it('should remove * when selection is already wrapped', () => {
      const view = createEditorView('*hello* world', 0, 7);

      executeCommand(view, 'italic');

      expect(getDoc(view)).toBe('hello world');
      cleanup(view);
    });

    it('should NOT treat ** as italic (bold markers)', () => {
      const view = createEditorView('**hello** world', 0, 9);

      executeCommand(view, 'italic');

      // Should wrap in italic, not remove as italic
      expect(getDoc(view)).toBe('***hello*** world');
      cleanup(view);
    });

    it('should remove surrounding * markers when cursor is inside italic text', () => {
      const view = createEditorView('*hello* world', 1, 6);

      executeCommand(view, 'italic');

      expect(getDoc(view)).toBe('hello world');
      cleanup(view);
    });

    it('should handle empty selection', () => {
      const view = createEditorView('hello world', 5, 5);

      executeCommand(view, 'italic');

      expect(getDoc(view)).toBe('hello** world');
      const selection = getSelection(view);
      expect(selection.from).toBe(6);
      expect(selection.to).toBe(6);
      cleanup(view);
    });

    it('should position cursor correctly after adding italic markers', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'italic');

      const selection = getSelection(view);
      expect(selection.from).toBe(1);
      expect(selection.to).toBe(6);
      cleanup(view);
    });

    it('should handle text that starts with single * only on one side', () => {
      const view = createEditorView('*hello world', 0, 6);

      executeCommand(view, 'italic');

      // Should wrap entire selection
      expect(getDoc(view)).toBe('**hello* world');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 4);

      const result = executeCommand(view, 'italic');

      expect(result).toBe(true);
      cleanup(view);
    });

    // Bold+italic edge cases
    describe('bold+italic combinations', () => {
      it('should remove italic from ***text*** when entire selection is bold+italic', () => {
        const view = createEditorView('***hello*** world', 0, 11);

        executeCommand(view, 'italic');

        // Should become **hello** (bold only)
        expect(getDoc(view)).toBe('**hello** world');
        cleanup(view);
      });

      it('should remove italic when cursor is inside ***text***', () => {
        // Selection inside the text portion of ***hello***
        const view = createEditorView('***hello*** world', 3, 8);

        executeCommand(view, 'italic');

        // Should become **hello** (bold only)
        expect(getDoc(view)).toBe('**hello** world');
        cleanup(view);
      });

      it('should add italic to **text** when cursor is inside bold', () => {
        // Selection inside the text portion of **hello**
        const view = createEditorView('**hello** world', 2, 7);

        executeCommand(view, 'italic');

        // Should become ***hello*** (bold+italic)
        expect(getDoc(view)).toBe('***hello*** world');
        cleanup(view);
      });

      it('should handle single *text* (plain italic) correctly', () => {
        const view = createEditorView('*hello* world', 0, 7);

        executeCommand(view, 'italic');

        expect(getDoc(view)).toBe('hello world');
        cleanup(view);
      });

      it('should wrap plain bold **text** selection in italic', () => {
        // Select the entire **hello** including markers
        const view = createEditorView('**hello** world', 0, 9);

        executeCommand(view, 'italic');

        // Should wrap in italic to make ***hello***
        expect(getDoc(view)).toBe('***hello*** world');
        cleanup(view);
      });

      it('should handle triple asterisks with spaces: *** text ***', () => {
        // This is technically not valid markdown, but test the behavior
        const view = createEditorView('*** text *** more', 0, 12);

        executeCommand(view, 'italic');

        // Should recognize as bold+italic and remove italic
        expect(getDoc(view)).toBe('** text ** more');
        cleanup(view);
      });
    });
  });

  describe('toggleCode', () => {
    it('should wrap plain text selection in backticks', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('`hello` world');
      cleanup(view);
    });

    it('should remove backticks when selection is already wrapped', () => {
      const view = createEditorView('`code` snippet', 0, 6);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('code snippet');
      cleanup(view);
    });

    it('should remove surrounding backticks when cursor is inside code', () => {
      const view = createEditorView('`hello` world', 1, 6);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('hello world');
      cleanup(view);
    });

    it('should handle empty selection', () => {
      const view = createEditorView('hello world', 5, 5);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('hello`` world');
      const selection = getSelection(view);
      expect(selection.from).toBe(6);
      expect(selection.to).toBe(6);
      cleanup(view);
    });

    it('should handle code with special characters', () => {
      const view = createEditorView('const x = 1', 0, 11);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('`const x = 1`');
      cleanup(view);
    });

    it('should position cursor correctly after adding code markers', () => {
      const view = createEditorView('hello world', 0, 5);

      executeCommand(view, 'code');

      const selection = getSelection(view);
      expect(selection.from).toBe(1);
      expect(selection.to).toBe(6);
      cleanup(view);
    });

    it('should handle multi-line code selection (inline)', () => {
      const view = createEditorView('line1\nline2', 0, 11);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('`line1\nline2`');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 4);

      const result = executeCommand(view, 'code');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('insertLink', () => {
    it('should wrap selection as link text with [selected](url) format', () => {
      const view = createEditorView('click here for more', 6, 10);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('click [here](url) for more');
      cleanup(view);
    });

    it('should insert placeholder [link text](url) when no selection', () => {
      const view = createEditorView('hello world', 5, 5);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('hello[link text](url) world');
      cleanup(view);
    });

    it('should position cursor at "url" for immediate editing when text selected', () => {
      const view = createEditorView('click here for more', 6, 10);

      executeCommand(view, 'link');

      const selection = getSelection(view);
      // After "[here](" the url starts: from + selected.length + 3 = 6 + 4 + 3 = 13
      expect(selection.from).toBe(13);
      expect(selection.to).toBe(16);
      cleanup(view);
    });

    it('should select "link text" placeholder when no selection', () => {
      const view = createEditorView('hello world', 5, 5);

      executeCommand(view, 'link');

      const selection = getSelection(view);
      expect(selection.from).toBe(6); // after [
      expect(selection.to).toBe(15); // before ]
      cleanup(view);
    });

    it('should handle selection at document start', () => {
      const view = createEditorView('start here', 0, 5);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('[start](url) here');
      cleanup(view);
    });

    it('should handle selection at document end', () => {
      const view = createEditorView('go to end', 6, 9);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('go to [end](url)');
      cleanup(view);
    });

    it('should handle multi-word selection', () => {
      const view = createEditorView('click here now', 0, 14);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('[click here now](url)');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 4);

      const result = executeCommand(view, 'link');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('setHeading1', () => {
    it('should add # prefix to line', () => {
      const view = createEditorView('Hello World', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Hello World');
      cleanup(view);
    });

    it('should toggle off when line already has # prefix', () => {
      const view = createEditorView('# Hello World', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('Hello World');
      cleanup(view);
    });

    it('should replace ## with #', () => {
      const view = createEditorView('## Hello World', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Hello World');
      cleanup(view);
    });

    it('should replace ### with #', () => {
      const view = createEditorView('### Hello World', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Hello World');
      cleanup(view);
    });

    it('should handle line without prior heading', () => {
      const view = createEditorView('plain text', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# plain text');
      cleanup(view);
    });

    it('should work on any cursor position within the line', () => {
      const view = createEditorView('Hello World', 0, 0);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Hello World');
      cleanup(view);
    });

    it('should handle multi-line document (affect only current line)', () => {
      const view = createEditorView('Line 1\nLine 2\nLine 3', 8, 8);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('Line 1\n# Line 2\nLine 3');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'heading1');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('setHeading2', () => {
    it('should add ## prefix to line', () => {
      const view = createEditorView('Hello World', 5, 5);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('## Hello World');
      cleanup(view);
    });

    it('should toggle off when line already has ## prefix', () => {
      const view = createEditorView('## Hello World', 5, 5);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('Hello World');
      cleanup(view);
    });

    it('should replace # with ##', () => {
      const view = createEditorView('# Hello World', 5, 5);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('## Hello World');
      cleanup(view);
    });

    it('should replace ### with ##', () => {
      const view = createEditorView('### Hello World', 5, 5);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('## Hello World');
      cleanup(view);
    });

    it('should handle line without prior heading', () => {
      const view = createEditorView('plain text', 5, 5);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('## plain text');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'heading2');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('setHeading3', () => {
    it('should add ### prefix to line', () => {
      const view = createEditorView('Hello World', 5, 5);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('### Hello World');
      cleanup(view);
    });

    it('should toggle off when line already has ### prefix', () => {
      const view = createEditorView('### Hello World', 5, 5);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('Hello World');
      cleanup(view);
    });

    it('should replace # with ###', () => {
      const view = createEditorView('# Hello World', 5, 5);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('### Hello World');
      cleanup(view);
    });

    it('should replace ## with ###', () => {
      const view = createEditorView('## Hello World', 5, 5);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('### Hello World');
      cleanup(view);
    });

    it('should handle line without prior heading', () => {
      const view = createEditorView('plain text', 5, 5);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('### plain text');
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'heading3');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('undo', () => {
    it('should delegate to CodeMirror undo', () => {
      const view = createEditorView('initial', 0, 7);

      // Make a change
      executeCommand(view, 'bold');
      expect(getDoc(view)).toBe('**initial**');

      // Undo the change
      const result = executeCommand(view, 'undo');

      expect(result).toBe(true);
      expect(getDoc(view)).toBe('initial');
      cleanup(view);
    });

    it('should return false when nothing to undo', () => {
      const view = createEditorView('initial', 0, 0);

      const result = executeCommand(view, 'undo');

      // Nothing to undo, should return false
      expect(result).toBe(false);
      cleanup(view);
    });

    it('should handle multiple undos', () => {
      const view = createEditorView('text', 0, 4);

      executeCommand(view, 'bold');
      expect(getDoc(view)).toBe('**text**');

      // Select the new content and make another change
      view.dispatch({
        selection: { anchor: 0, head: 8 },
      });
      executeCommand(view, 'italic');

      // Undo first change
      executeCommand(view, 'undo');
      expect(getDoc(view)).toBe('**text**');

      // Undo second change
      executeCommand(view, 'undo');
      expect(getDoc(view)).toBe('text');
      cleanup(view);
    });
  });

  describe('redo', () => {
    it('should delegate to CodeMirror redo', () => {
      const view = createEditorView('initial', 0, 7);

      // Make a change
      executeCommand(view, 'bold');
      expect(getDoc(view)).toBe('**initial**');

      // Undo
      executeCommand(view, 'undo');
      expect(getDoc(view)).toBe('initial');

      // Redo
      const result = executeCommand(view, 'redo');

      expect(result).toBe(true);
      expect(getDoc(view)).toBe('**initial**');
      cleanup(view);
    });

    it('should return false when nothing to redo', () => {
      const view = createEditorView('initial', 0, 0);

      const result = executeCommand(view, 'redo');

      expect(result).toBe(false);
      cleanup(view);
    });

    it('should handle redo after multiple undos', () => {
      const view = createEditorView('text', 0, 4);

      // First change
      executeCommand(view, 'bold');

      // Second change
      view.dispatch({ selection: { anchor: 2, head: 6 } });
      executeCommand(view, 'italic');

      // Undo both
      executeCommand(view, 'undo');
      executeCommand(view, 'undo');
      expect(getDoc(view)).toBe('text');

      // Redo first
      executeCommand(view, 'redo');
      expect(getDoc(view)).toBe('**text**');

      // Redo second
      executeCommand(view, 'redo');
      expect(getDoc(view)).toContain('*');
      cleanup(view);
    });
  });

  describe('find', () => {
    it('should delegate to CodeMirror openSearchPanel', () => {
      const view = createEditorView('hello world', 0, 0);

      const result = executeCommand(view, 'find');

      expect(result).toBe(true);
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'find');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('findReplace', () => {
    it('should delegate to CodeMirror openSearchPanel', () => {
      const view = createEditorView('hello world', 0, 0);

      const result = executeCommand(view, 'findReplace');

      expect(result).toBe(true);
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'findReplace');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('goToLine', () => {
    it('should delegate to CodeMirror gotoLine', () => {
      const view = createEditorView('line1\nline2\nline3', 0, 0);

      const result = executeCommand(view, 'goToLine');

      expect(result).toBe(true);
      cleanup(view);
    });

    it('should return true indicating command was handled', () => {
      const view = createEditorView('test', 0, 0);

      const result = executeCommand(view, 'goToLine');

      expect(result).toBe(true);
      cleanup(view);
    });
  });

  describe('executeCommand', () => {
    const allCommands: EditorCommandName[] = [
      'bold',
      'italic',
      'code',
      'link',
      'heading1',
      'heading2',
      'heading3',
      'undo',
      'redo',
      'find',
      'findReplace',
      'goToLine',
    ];

    it('should handle all 12 command names', () => {
      allCommands.forEach((commandName) => {
        const view = createEditorView('test content', 0, 4);
        const result = executeCommand(view, commandName);
        expect(typeof result).toBe('boolean');
        cleanup(view);
      });
    });

    it('should return true for formatting commands', () => {
      const formattingCommands: EditorCommandName[] = ['bold', 'italic', 'code', 'link'];

      formattingCommands.forEach((commandName) => {
        const view = createEditorView('test', 0, 4);
        const result = executeCommand(view, commandName);
        expect(result).toBe(true);
        cleanup(view);
      });
    });

    it('should return true for heading commands', () => {
      const headingCommands: EditorCommandName[] = ['heading1', 'heading2', 'heading3'];

      headingCommands.forEach((commandName) => {
        const view = createEditorView('test', 0, 0);
        const result = executeCommand(view, commandName);
        expect(result).toBe(true);
        cleanup(view);
      });
    });

    it('should return true for search/navigation commands', () => {
      const searchCommands: EditorCommandName[] = ['find', 'findReplace', 'goToLine'];

      searchCommands.forEach((commandName) => {
        const view = createEditorView('test', 0, 0);
        const result = executeCommand(view, commandName);
        expect(result).toBe(true);
        cleanup(view);
      });
    });

    it('should actually execute bold command', () => {
      const view = createEditorView('hello', 0, 5);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**hello**');
      cleanup(view);
    });

    it('should actually execute italic command', () => {
      const view = createEditorView('hello', 0, 5);

      executeCommand(view, 'italic');

      expect(getDoc(view)).toBe('*hello*');
      cleanup(view);
    });

    it('should actually execute code command', () => {
      const view = createEditorView('hello', 0, 5);

      executeCommand(view, 'code');

      expect(getDoc(view)).toBe('`hello`');
      cleanup(view);
    });

    it('should actually execute link command', () => {
      const view = createEditorView('hello', 0, 5);

      executeCommand(view, 'link');

      expect(getDoc(view)).toBe('[hello](url)');
      cleanup(view);
    });

    it('should actually execute heading1 command', () => {
      const view = createEditorView('hello', 0, 0);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# hello');
      cleanup(view);
    });

    it('should actually execute heading2 command', () => {
      const view = createEditorView('hello', 0, 0);

      executeCommand(view, 'heading2');

      expect(getDoc(view)).toBe('## hello');
      cleanup(view);
    });

    it('should actually execute heading3 command', () => {
      const view = createEditorView('hello', 0, 0);

      executeCommand(view, 'heading3');

      expect(getDoc(view)).toBe('### hello');
      cleanup(view);
    });

    describe('onError callback', () => {
      it('should call onError callback when command throws', () => {
        const view = createEditorView('test', 0, 4);
        const onError = vi.fn();

        // Temporarily mock a command to throw
        const originalDispatch = view.dispatch.bind(view);
        view.dispatch = () => {
          throw new Error('Test error');
        };

        const result = executeCommand(view, 'bold', onError);

        expect(result).toBe(false);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'command',
            message: expect.stringContaining("Command 'bold' failed"),
            context: expect.objectContaining({
              commandName: 'bold',
              originalError: expect.any(Error),
            }),
          })
        );

        // Restore dispatch
        view.dispatch = originalDispatch;
        cleanup(view);
      });

      it('should return false when command throws', () => {
        const view = createEditorView('test', 0, 4);

        // Mock dispatch to throw
        view.dispatch = () => {
          throw new Error('Test error');
        };

        const result = executeCommand(view, 'italic');

        expect(result).toBe(false);
        cleanup(view);
      });

      it('should include error message in onError callback', () => {
        const view = createEditorView('test', 0, 4);
        const onError = vi.fn();

        view.dispatch = () => {
          throw new Error('Specific error message');
        };

        executeCommand(view, 'code', onError);

        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Specific error message'),
          })
        );

        cleanup(view);
      });

      it('should not call onError when command succeeds', () => {
        const view = createEditorView('test', 0, 4);
        const onError = vi.fn();

        executeCommand(view, 'bold', onError);

        expect(onError).not.toHaveBeenCalled();
        cleanup(view);
      });

      it('should work without onError callback (no crash)', () => {
        const view = createEditorView('test', 0, 4);

        view.dispatch = () => {
          throw new Error('Test error');
        };

        // Should not throw when no callback provided
        expect(() => executeCommand(view, 'bold')).not.toThrow();
        cleanup(view);
      });
    });
  });

  describe('markdownKeymap', () => {
    it('should create a keymap extension', () => {
      expect(markdownKeymap).toBeDefined();
    });

    it('should be usable in EditorState.create', () => {
      const state = EditorState.create({
        doc: 'test',
        extensions: [markdownKeymap],
      });

      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe('test');
    });

    it('should be usable with EditorView', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const view = new EditorView({
        state: EditorState.create({
          doc: 'test',
          extensions: [markdownKeymap],
        }),
        parent: container,
      });

      expect(view).toBeDefined();
      expect(view.state.doc.toString()).toBe('test');

      container.removeChild(view.dom);
      view.destroy();
    });

    it('should be combinable with other extensions', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const view = new EditorView({
        state: EditorState.create({
          doc: 'test',
          extensions: [
            history(),
            markdownKeymap,
          ],
        }),
        parent: container,
      });

      expect(view).toBeDefined();

      container.removeChild(view.dom);
      view.destroy();
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      const view = createEditorView('', 0, 0);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('****');
      cleanup(view);
    });

    it('should handle very long text selection', () => {
      const longText = 'a'.repeat(1000);
      const view = createEditorView(longText, 0, 1000);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe(`**${longText}**`);
      cleanup(view);
    });

    it('should handle special characters in text', () => {
      const view = createEditorView('hello <world> & "test"', 0, 22);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**hello <world> & "test"**');
      cleanup(view);
    });

    it('should handle unicode characters', () => {
      const view = createEditorView('hello 世界 emoji 🎉', 0, 17);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toContain('**');
      expect(getDoc(view)).toContain('世界');
      expect(getDoc(view)).toContain('🎉');
      cleanup(view);
    });

    it('should handle text with existing markdown', () => {
      const view = createEditorView('some *existing* **markdown**', 5, 15);

      executeCommand(view, 'bold');

      // Should wrap the selection in bold
      expect(getDoc(view)).toContain('**');
      cleanup(view);
    });

    it('should handle multiple lines with heading commands', () => {
      const view = createEditorView('Line 1\nLine 2\nLine 3', 0, 0);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Line 1\nLine 2\nLine 3');
      cleanup(view);
    });

    it('should handle cursor at end of line for heading', () => {
      const view = createEditorView('Hello', 5, 5);

      executeCommand(view, 'heading1');

      expect(getDoc(view)).toBe('# Hello');
      cleanup(view);
    });

    it('should handle whitespace-only selection', () => {
      const view = createEditorView('hello   world', 5, 8);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('hello**   **world');
      cleanup(view);
    });

    it('should handle newline in selection', () => {
      const view = createEditorView('hello\nworld', 0, 11);

      executeCommand(view, 'bold');

      expect(getDoc(view)).toBe('**hello\nworld**');
      cleanup(view);
    });
  });

  describe('selection state after commands', () => {
    it('should maintain meaningful selection after bold toggle on', () => {
      const view = createEditorView('hello', 0, 5);

      executeCommand(view, 'bold');

      const selection = getSelection(view);
      // Selection should be around the text content, not markers
      expect(selection.from).toBe(2);
      expect(selection.to).toBe(7);
      cleanup(view);
    });

    it('should maintain meaningful selection after bold toggle off', () => {
      const view = createEditorView('**hello**', 0, 9);

      executeCommand(view, 'bold');

      const selection = getSelection(view);
      // Selection should cover the remaining text
      expect(selection.from).toBe(0);
      expect(selection.to).toBe(5);
      cleanup(view);
    });

    it('should position cursor correctly for link with selection', () => {
      const view = createEditorView('example', 0, 7);

      executeCommand(view, 'link');

      const selection = getSelection(view);
      // "url" should be selected for easy replacement
      const selectedText = view.state.sliceDoc(selection.from, selection.to);
      expect(selectedText).toBe('url');
      cleanup(view);
    });

    it('should position cursor correctly for link without selection', () => {
      const view = createEditorView('', 0, 0);

      executeCommand(view, 'link');

      const selection = getSelection(view);
      // "link text" should be selected
      const selectedText = view.state.sliceDoc(selection.from, selection.to);
      expect(selectedText).toBe('link text');
      cleanup(view);
    });
  });
});
