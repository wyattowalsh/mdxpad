import { describe, expect, it } from 'vitest';

import {
  insertDiagramFence,
  insertTextAtSelection,
  joinVoiceTranscript,
} from './insert-document-text';

describe('insertDiagramFence', () => {
  it('uses the fence as the whole document when the document is empty', () => {
    expect(insertDiagramFence('', '```mermaid\ngraph\n```')).toBe('```mermaid\ngraph\n```');
  });

  it('keeps existing text and separates the fence with a blank line', () => {
    expect(insertDiagramFence('# Notes', '```mermaid\ngraph\n```')).toBe(
      '# Notes\n\n```mermaid\ngraph\n```'
    );
  });
});

describe('insertTextAtSelection', () => {
  const fence = '```mermaid\ngraph\n```';

  it('inserts at the cursor and replaces a selection', () => {
    expect(insertTextAtSelection('Hello world', fence, { from: 6, to: 6 })).toBe(
      `Hello \n\n${fence}\n\nworld`
    );
    expect(insertTextAtSelection('Hello world', fence, { from: 0, to: 5 })).toBe(`${fence} world`);
  });

  it('appends when there is no cursor', () => {
    expect(insertTextAtSelection('# Notes', fence, null)).toBe(`# Notes\n\n${fence}`);
  });
});

describe('joinVoiceTranscript', () => {
  it('adds a space before a spoken word when the document does not end in whitespace', () => {
    expect(joinVoiceTranscript('Hello', 'there')).toBe('Hello there');
  });

  it('does not add a second space when the transcript already starts with one', () => {
    expect(joinVoiceTranscript('Hello', ' there')).toBe('Hello there');
  });
});
