import type MarkdownIt from 'markdown-it';
import type { Token } from 'markdown-it';

function nestedMark(type: string): { name: string; open: boolean } | null {
  if (type === 'strong_open' || type === 'em_open') {
    return { name: type === 'strong_open' ? 'strong' : 'em', open: true };
  }
  if (type === 'strong_close' || type === 'em_close') {
    return { name: type === 'strong_close' ? 'strong' : 'em', open: false };
  }
  return null;
}

function flattenList(tokens: Token[]): void {
  const depth = new Map<string, number>();
  const kept: Token[] = [];
  for (const token of tokens) {
    if (token.children) {
      flattenList(token.children);
    }
    const mark = nestedMark(token.type);
    if (!mark) {
      kept.push(token);
      continue;
    }
    const current = depth.get(mark.name) ?? 0;
    if (mark.open) {
      depth.set(mark.name, current + 1);
      if (current === 0) {
        kept.push(token);
      }
      continue;
    }
    depth.set(mark.name, Math.max(0, current - 1));
    if (current <= 1) {
      kept.push(token);
    }
  }
  tokens.splice(0, tokens.length, ...kept);
}

/** An inner strong or em no longer clears the outer mark. */
export function retainNestedEmphasis(tokenizer: MarkdownIt): void {
  tokenizer.core.ruler.push('mdxpad_nested_emphasis', (state) => {
    flattenList(state.tokens);
  });
}
