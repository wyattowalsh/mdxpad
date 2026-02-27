/**
 * Unit tests for Code Execution extension.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import {
  codeExecutionExtension,
  findRunnableFences,
  RUNNABLE_FENCE_REGEX,
  CLOSING_FENCE_REGEX,
} from './code-execution';

describe('RUNNABLE_FENCE_REGEX', () => {
  it('matches code fence with run flag', () => {
    expect(RUNNABLE_FENCE_REGEX.test('```js run')).toBe(true);
  });

  it('matches code fence with executable flag', () => {
    expect(RUNNABLE_FENCE_REGEX.test('```javascript executable')).toBe(true);
  });

  it('does not match plain code fence', () => {
    expect(RUNNABLE_FENCE_REGEX.test('```js')).toBe(false);
  });

  it('does not match code fence without language', () => {
    expect(RUNNABLE_FENCE_REGEX.test('``` run')).toBe(true);
  });

  it('captures language identifier', () => {
    const match = RUNNABLE_FENCE_REGEX.exec('```typescript run');
    expect(match).not.toBeNull();
    expect(match![2]).toBe('typescript');
  });

  it('captures run flag', () => {
    const match = RUNNABLE_FENCE_REGEX.exec('```js run');
    expect(match).not.toBeNull();
    expect(match![3]).toBe('run');
  });
});

describe('CLOSING_FENCE_REGEX', () => {
  it('matches closing fence', () => {
    expect(CLOSING_FENCE_REGEX.test('```')).toBe(true);
  });

  it('matches closing fence with trailing space', () => {
    expect(CLOSING_FENCE_REGEX.test('```  ')).toBe(true);
  });

  it('matches longer closing fence', () => {
    expect(CLOSING_FENCE_REGEX.test('````')).toBe(true);
  });

  it('does not match opening fence with language', () => {
    expect(CLOSING_FENCE_REGEX.test('```js')).toBe(false);
  });
});

describe('findRunnableFences', () => {
  it('finds a single runnable fence', () => {
    const doc = '```js run\nconsole.log("hello");\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(1);
    expect(fences[0]!.language).toBe('js');
    expect(fences[0]!.code).toBe('console.log("hello");');
  });

  it('finds multiple runnable fences', () => {
    const doc = '```js run\ncode1\n```\n\ntext\n\n```js executable\ncode2\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(2);
    expect(fences[0]!.code).toBe('code1');
    expect(fences[1]!.code).toBe('code2');
  });

  it('returns empty array for no runnable fences', () => {
    const doc = '```js\nregular code\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(0);
  });

  it('handles multi-line code', () => {
    const doc = '```js run\nline1\nline2\nline3\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(1);
    expect(fences[0]!.code).toBe('line1\nline2\nline3');
  });

  it('handles empty code block', () => {
    const doc = '```js run\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(1);
    expect(fences[0]!.code).toBe('');
  });

  it('records correct fenceStart and fenceEnd', () => {
    const doc = '```js run\nhello\n```';
    const fences = findRunnableFences({ toString: () => doc });

    expect(fences).toHaveLength(1);
    expect(fences[0]!.fenceStart).toBe(0);
    expect(fences[0]!.fenceEnd).toBe(doc.length);
  });
});

describe('codeExecutionExtension', () => {
  it('returns a valid extension', () => {
    const ext = codeExecutionExtension();
    expect(ext).toBeDefined();
  });

  it('creates a valid EditorState', () => {
    const state = EditorState.create({
      doc: '```js run\nconsole.log("test");\n```',
      extensions: [codeExecutionExtension()],
    });
    expect(state.doc.toString()).toContain('console.log');
  });

  it('works with an empty document', () => {
    const state = EditorState.create({
      doc: '',
      extensions: [codeExecutionExtension()],
    });
    expect(state).toBeDefined();
  });

  it('works with a document without runnable fences', () => {
    const state = EditorState.create({
      doc: '# Hello\n\nSome text\n\n```js\ncode\n```',
      extensions: [codeExecutionExtension()],
    });
    expect(state).toBeDefined();
  });
});
