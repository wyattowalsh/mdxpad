import { describe, expect, it } from 'vitest';

import { insertDiagramFence, joinVoiceTranscript } from './insert-document-text';

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

describe('joinVoiceTranscript', () => {
  it('adds a space before a spoken word when the document does not end in whitespace', () => {
    expect(joinVoiceTranscript('Hello', 'there')).toBe('Hello there');
  });

  it('does not add a second space when the transcript already starts with one', () => {
    expect(joinVoiceTranscript('Hello', ' there')).toBe('Hello there');
  });
});
