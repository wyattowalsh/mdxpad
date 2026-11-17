import type MarkdownIt from 'markdown-it';

interface StrikeToken {
  content: string;
}

interface StrikeState {
  src: string;
  pos: number;
  posMax: number;
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

function pushText(state: StrikeState, value: string): void {
  if (value.length === 0) {
    return;
  }
  const token = state.push('text', '', 0);
  token.content = value;
}

function hardBreak(line: string): string | null {
  if (/(?:^|[^\\])(?:\\\\)*\\$/.test(line)) {
    return line.slice(0, -1);
  }
  if (/ {2,}$/.test(line)) {
    return line.replace(/ {2,}$/, '');
  }
  return null;
}

function pushStrikeInner(state: StrikeState, inner: string): void {
  let cursor = 0;
  let pending = '';
  while (cursor < inner.length) {
    const newline = inner.indexOf('\n', cursor);
    if (newline === -1) {
      pushText(state, pending + inner.slice(cursor));
      return;
    }
    const line = inner.slice(cursor, newline);
    const broken = hardBreak(line);
    if (broken === null) {
      pending += `${line}\n`;
      cursor = newline + 1;
      continue;
    }
    pushText(state, pending + broken);
    state.push('hardbreak', 'br', 0);
    pending = '';
    cursor = newline + 1;
  }
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
    state.push('s_open', 's', 1);
    pushStrikeInner(state, inner);
    state.push('s_close', 's', -1);
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
