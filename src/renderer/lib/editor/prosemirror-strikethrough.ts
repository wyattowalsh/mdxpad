import type MarkdownIt from 'markdown-it';

interface StrikeToken {
  content: string;
}

interface StrikeState {
  src: string;
  pos: number;
  posMax: number;
  md: {
    inline: {
      tokenize: (state: StrikeState) => void;
    };
  };
  push: (type: string, tag: string, nesting: number) => StrikeToken;
}

interface MarkdownTokenizer {
  inline: {
    ruler: {
      before: (
        before: string,
        name: string,
        fn: (state: StrikeState, silent: boolean) => boolean
      ) => void;
    };
  };
}

function strikethroughRule(state: StrikeState, silent: boolean): boolean {
  const start = state.pos;
  if (start + 1 >= state.posMax) {
    return false;
  }
  if (state.src.charCodeAt(start) !== 0x7e || state.src.charCodeAt(start + 1) !== 0x7e) {
    return false;
  }
  const end = state.src.indexOf('~~', start + 2);
  const inner = end === -1 ? '' : state.src.slice(start + 2, end);
  if (end < 0 || end >= state.posMax || end <= start + 2 || inner.includes('\n\n')) {
    return false;
  }
  if (!silent) {
    const max = state.posMax;
    state.push('s_open', 's', 1);
    state.pos = start + 2;
    state.posMax = end;
    state.md.inline.tokenize(state);
    state.push('s_close', 's', -1);
    state.posMax = max;
  }
  state.pos = end + 2;
  return true;
}

export function enableStrikethrough(tokenizer: MarkdownIt): void {
  const ruler = tokenizer as unknown as MarkdownTokenizer;
  try {
    ruler.inline.ruler.before('emphasis', 'mdxpad_strikethrough', strikethroughRule);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('already exists')) {
      throw error;
    }
  }
}
