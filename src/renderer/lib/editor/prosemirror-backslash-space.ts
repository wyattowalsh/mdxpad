import type MarkdownIt from 'markdown-it';

interface BackslashState {
  src: string;
  pos: number;
  pending: string;
}

interface MarkdownTokenizer {
  inline: {
    ruler: {
      before: (
        before: string,
        name: string,
        fn: (state: BackslashState, silent: boolean) => boolean
      ) => void;
    };
  };
}

/** A backslash does not swallow the space after it, so trailing spaces can still break the line. */
export function keepBackslashSpaces(tokenizer: MarkdownIt): void {
  const rules = tokenizer as unknown as MarkdownTokenizer;
  rules.inline.ruler.before('escape', 'literal_backslash_space', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x5c || state.src.charCodeAt(state.pos + 1) !== 0x20) {
      return false;
    }
    if (!silent) {
      state.pending += '\\';
    }
    state.pos += 1;
    return true;
  });
}
