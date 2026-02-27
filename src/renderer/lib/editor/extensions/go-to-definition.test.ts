/**
 * Unit tests for Go-to-Definition extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { goToDefinitionExtension, parseImports, findImportForComponent } from './go-to-definition';

describe('parseImports', () => {
  it('parses default import', () => {
    const text = "import Button from './components/Button';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.identifier).toBe('Button');
    expect(imports[0]!.path).toBe('./components/Button');
  });

  it('parses named imports', () => {
    const text = "import { Heading, Text } from './typography';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(2);
    expect(imports[0]!.identifier).toBe('Heading');
    expect(imports[1]!.identifier).toBe('Text');
    expect(imports[0]!.path).toBe('./typography');
    expect(imports[1]!.path).toBe('./typography');
  });

  it('parses default and named imports together', () => {
    const text = "import React, { useState } from 'react';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(2);
    expect(imports[0]!.identifier).toBe('React');
    expect(imports[1]!.identifier).toBe('useState');
  });

  it('parses import with alias', () => {
    const text = "import { Button as Btn } from './ui';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.identifier).toBe('Btn');
    expect(imports[0]!.path).toBe('./ui');
  });

  it('parses bare import (side-effect only)', () => {
    const text = "import './styles.css';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.identifier).toBe('');
    expect(imports[0]!.path).toBe('./styles.css');
  });

  it('parses multiple import statements', () => {
    const text = [
      "import React from 'react';",
      "import { Button } from './ui';",
      "import Layout from './layout';",
    ].join('\n');

    const imports = parseImports(text);
    expect(imports).toHaveLength(3);
  });

  it('handles single-quoted paths', () => {
    const text = "import Button from './Button';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('./Button');
  });

  it('handles double-quoted paths', () => {
    const text = 'import Button from "./Button";';
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.path).toBe('./Button');
  });

  it('records correct path positions', () => {
    const text = "import Button from './components/Button';";
    const imports = parseImports(text);

    expect(imports).toHaveLength(1);
    const imp = imports[0]!;
    expect(text.substring(imp.pathFrom, imp.pathTo)).toBe('./components/Button');
  });

  it('returns empty array for no imports', () => {
    const text = '# Hello World\n\nSome content';
    const imports = parseImports(text);

    expect(imports).toHaveLength(0);
  });

  it('handles empty string', () => {
    const imports = parseImports('');
    expect(imports).toHaveLength(0);
  });
});

describe('findImportForComponent', () => {
  const imports = parseImports(
    [
      "import Button from './Button';",
      "import { Card } from './Card';",
      "import Layout from './Layout';",
    ].join('\n')
  );

  it('finds import for a component', () => {
    const imp = findImportForComponent(imports, 'Button');
    expect(imp).toBeDefined();
    expect(imp!.path).toBe('./Button');
  });

  it('finds import for named import', () => {
    const imp = findImportForComponent(imports, 'Card');
    expect(imp).toBeDefined();
    expect(imp!.path).toBe('./Card');
  });

  it('handles dotted component names', () => {
    const imp = findImportForComponent(imports, 'Layout.Header');
    expect(imp).toBeDefined();
    expect(imp!.path).toBe('./Layout');
  });

  it('returns undefined for unknown component', () => {
    const imp = findImportForComponent(imports, 'Unknown');
    expect(imp).toBeUndefined();
  });
});

describe('goToDefinitionExtension', () => {
  it('returns a valid extension', () => {
    const ext = goToDefinitionExtension();
    expect(ext).toBeDefined();
  });

  it('accepts a custom handler', () => {
    const handler = (_path: string) => {};
    const ext = goToDefinitionExtension(handler);
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: "import Button from './Button';\n\n<Button />",
      extensions: [goToDefinitionExtension()],
    });
    expect(state.doc.toString()).toContain('Button');
  });

  it('works with empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [goToDefinitionExtension()],
    });
    expect(state).toBeDefined();
  });

  it('works with document without imports', () => {
    const state = EditorState.create({
      doc: '# Hello\n\nSome text',
      extensions: [goToDefinitionExtension()],
    });
    expect(state).toBeDefined();
  });
});
