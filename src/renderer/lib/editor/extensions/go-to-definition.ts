/**
 * Go-to-Definition Extension for CodeMirror
 *
 * Enables Cmd+Click navigation on import paths and component
 * usage in MDX files. Shows tooltips on hover with file paths.
 *
 * @module renderer/lib/editor/extensions/go-to-definition
 */

import { type Extension } from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
  type Tooltip,
} from '@codemirror/view';

// =============================================================================
// Types
// =============================================================================

/**
 * An import definition found in the document.
 */
export interface ImportDefinition {
  /** The imported identifier (e.g., "Button") */
  readonly identifier: string;
  /** The import path (e.g., "./components/Button") */
  readonly path: string;
  /** Start position of the import path in the document */
  readonly pathFrom: number;
  /** End position of the import path in the document */
  readonly pathTo: number;
  /** Start position of the full import statement */
  readonly statementFrom: number;
  /** End position of the full import statement */
  readonly statementTo: number;
}

/**
 * Callback when a definition is requested.
 */
export type GoToDefinitionHandler = (path: string) => void;

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex to match ES module import statements.
 * Captures: default import, named imports, and module path.
 */
const IMPORT_REGEX =
  /import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s+from\s+)?['"]([^'"]+)['"]/g;

/**
 * Regex to match JSX component usage (PascalCase identifiers).
 */
const COMPONENT_USAGE_REGEX = /(?<=<\/?)([A-Z][a-zA-Z0-9.]*)/g;

// =============================================================================
// Import Parsing
// =============================================================================

/**
 * Parse named import aliases (e.g., "Foo as Bar" -> "Bar").
 */
function parseNamedIdentifiers(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const parts = s.split(/\s+as\s+/);
      return parts.length > 1 ? (parts[1]?.trim() ?? s.trim()) : s.trim();
    });
}

/**
 * Build an ImportDefinition from parsed import components.
 */
function buildImportDef(
  identifier: string,
  path: string,
  pathFrom: number,
  pathTo: number,
  statementFrom: number,
  statementTo: number
): ImportDefinition {
  return { identifier, path, pathFrom, pathTo, statementFrom, statementTo };
}

/**
 * Parse all import definitions from document text.
 */
export function parseImports(text: string): ImportDefinition[] {
  const imports: ImportDefinition[] = [];
  const regex = new RegExp(IMPORT_REGEX.source, 'g');

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const defaultImport = match[1] ?? null;
    const namedImportsRaw = match[2] ?? null;
    const importPath = match[3];

    if (!importPath) continue;

    const statementFrom = match.index;
    const statementTo = statementFrom + fullMatch.length;
    const pathStart = fullMatch.lastIndexOf(importPath);
    const pathFrom = statementFrom + pathStart;
    const pathTo = pathFrom + importPath.length;

    if (defaultImport) {
      imports.push(
        buildImportDef(defaultImport, importPath, pathFrom, pathTo, statementFrom, statementTo)
      );
    }

    if (namedImportsRaw) {
      for (const name of parseNamedIdentifiers(namedImportsRaw)) {
        imports.push(
          buildImportDef(name, importPath, pathFrom, pathTo, statementFrom, statementTo)
        );
      }
    }

    if (!defaultImport && !namedImportsRaw) {
      imports.push(buildImportDef('', importPath, pathFrom, pathTo, statementFrom, statementTo));
    }
  }

  return imports;
}

/**
 * Find the import definition for a component name.
 */
export function findImportForComponent(
  imports: ImportDefinition[],
  componentName: string
): ImportDefinition | undefined {
  // Handle dotted names like "Layout.Header" -> "Layout"
  const baseName = componentName.split('.')[0] ?? componentName;
  return imports.find((imp) => imp.identifier === baseName);
}

// =============================================================================
// Decorations
// =============================================================================

const importPathMark = Decoration.mark({ class: 'cm-import-path' });

/**
 * Build decorations for clickable import paths.
 */
function buildImportDecorations(text: string): DecorationSet {
  const imports = parseImports(text);
  const decorations = imports.map((imp) => importPathMark.range(imp.pathFrom, imp.pathTo));

  // Deduplicate by position (multiple identifiers can share the same path)
  const seen = new Set<string>();
  const unique = decorations.filter((d) => {
    const key = `${d.from}-${d.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return Decoration.set(unique, true);
}

// =============================================================================
// Hover Tooltip
// =============================================================================

/**
 * Create a hover tooltip showing the import path for components.
 */
function createImportHoverTooltip(view: EditorView, pos: number, _side: -1 | 1): Tooltip | null {
  const text = view.state.doc.toString();
  const imports = parseImports(text);

  // Check if hovering over an import path
  for (const imp of imports) {
    if (pos >= imp.pathFrom && pos <= imp.pathTo) {
      return {
        pos: imp.pathFrom,
        end: imp.pathTo,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-goto-tooltip';
          dom.style.cssText = 'padding:4px 8px;font-size:11px;font-family:monospace;';
          dom.textContent = `Cmd+Click to open: ${imp.path}`;
          return { dom };
        },
      };
    }
  }

  // Check if hovering over a component usage
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const regex = new RegExp(COMPONENT_USAGE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(lineText)) !== null) {
    const componentName = match[1];
    if (!componentName) continue;
    const from = line.from + match.index;
    const to = from + componentName.length;

    if (pos >= from && pos <= to) {
      const imp = findImportForComponent(imports, componentName);
      if (imp) {
        return {
          pos: from,
          end: to,
          above: true,
          create() {
            const dom = document.createElement('div');
            dom.className = 'cm-goto-tooltip';
            dom.style.cssText = 'padding:4px 8px;font-size:11px;font-family:monospace;';
            dom.textContent = `Imported from: ${imp.path}`;
            return { dom };
          },
        };
      }
    }
  }

  return null;
}

// =============================================================================
// Click Handler
// =============================================================================

/**
 * Create a Cmd+Click handler for go-to-definition.
 */
function createClickHandler(onGoTo: GoToDefinitionHandler) {
  return EditorView.domEventHandlers({
    click(event: MouseEvent, view: EditorView) {
      // Only handle Cmd+Click (or Ctrl+Click on non-Mac)
      if (!event.metaKey && !event.ctrlKey) return false;

      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;

      const text = view.state.doc.toString();
      const imports = parseImports(text);

      // Check if clicking on an import path
      for (const imp of imports) {
        if (pos >= imp.pathFrom && pos <= imp.pathTo) {
          event.preventDefault();
          onGoTo(imp.path);
          return true;
        }
      }

      // Check if clicking on a component usage
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const regex = new RegExp(COMPONENT_USAGE_REGEX.source, 'g');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const componentName = match[1];
        if (!componentName) continue;
        const from = line.from + match.index;
        const to = from + componentName.length;

        if (pos >= from && pos <= to) {
          const imp = findImportForComponent(imports, componentName);
          if (imp) {
            event.preventDefault();
            onGoTo(imp.path);
            return true;
          }
        }
      }

      return false;
    },
  });
}

// =============================================================================
// Styles
// =============================================================================

const goToDefinitionStyles = EditorView.baseTheme({
  '.cm-import-path': {
    textDecoration: 'underline',
    textDecorationColor: '#666',
    cursor: 'pointer',
  },
  '.cm-import-path:hover': {
    textDecorationColor: '#aaa',
  },
});

// =============================================================================
// Extension
// =============================================================================

/**
 * Go-to-definition extension for CodeMirror.
 *
 * Enables Cmd+Click on import paths and component usage to navigate
 * to the imported file. Shows tooltips on hover with the file path.
 *
 * @param onGoTo - Callback invoked with the import path when navigating
 * @returns CodeMirror Extension
 *
 * @example
 * ```typescript
 * import { goToDefinitionExtension } from './go-to-definition';
 *
 * const ext = goToDefinitionExtension((path) => {
 *   console.log('Navigate to:', path);
 * });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op default
const noopHandler: GoToDefinitionHandler = () => {};

export function goToDefinitionExtension(onGoTo: GoToDefinitionHandler = noopHandler): Extension {
  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildImportDecorations(view.state.doc.toString());
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildImportDecorations(update.state.doc.toString());
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return [
    decorationPlugin,
    hoverTooltip(createImportHoverTooltip, { hideOnChange: true }),
    createClickHandler(onGoTo),
    goToDefinitionStyles,
  ];
}
