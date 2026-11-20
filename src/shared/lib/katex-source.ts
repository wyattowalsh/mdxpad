import katex from 'katex';

import { katexMathTex, renderableMathTex } from '@shared/lib/renderable-math';

import '@shared/lib/katex-mhchem';

function stripEnvironment(source: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source
    .replace(new RegExp(`\\\\begin\\{${escaped}\\}(?:\\[[^\\]]*\\])?(?:\\{[^{}]*\\})?`, 'g'), '')
    .replace(new RegExp(`\\\\end\\{${escaped}\\}`, 'g'), '');
}

function escapeText(value: string): string {
  return value
    .replaceAll('\\', '\\textbackslash{}')
    .replaceAll('{', '\\{')
    .replaceAll('}', '\\}')
    .replaceAll('%', '\\%')
    .replaceAll('&', '\\&')
    .replaceAll('_', '\\_')
    .replaceAll('#', '\\#')
    .replaceAll('^', '\\textasciicircum{}')
    .replaceAll('~', '\\textasciitilde{}');
}

function groupEnd(source: string, open: number): number | null {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '\\') {
      index += 1;
      continue;
    }
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char !== '}') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }
  return null;
}

function keptCommandEnd(value: string, index: number): number | null {
  const command = /^\\[A-Za-z]+/.exec(value.slice(index));
  if (command?.[0] === undefined) {
    return null;
  }
  let end = index + command[0].length;
  if (value[end] === '*') {
    end += 1;
  }
  while (value[end] === '[') {
    const close = value.indexOf(']', end + 1);
    if (close === -1) {
      return end;
    }
    end = close + 1;
  }
  while (value[end] === '{') {
    const close = groupEnd(value, end);
    if (close === null) {
      return end;
    }
    end = close + 1;
  }
  return end;
}

function textChunk(value: string): string {
  return value.length === 0 ? '' : `\\text{${escapeText(value)}}`;
}

function keepWords(value: string): string {
  let result = '';
  let text = '';
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '\\') {
      text += value[index] ?? '';
      continue;
    }
    const commandEnd = keptCommandEnd(value, index);
    result += textChunk(text);
    text = '';
    if (commandEnd === null) {
      const symbol = value[index + 1] ?? '';
      result += symbol === '' ? '\\' : `\\${symbol}`;
      if (symbol !== '') {
        index += 1;
      }
      continue;
    }
    result += value.slice(index, commandEnd);
    index = commandEnd - 1;
  }
  return result + textChunk(text);
}

function asText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  if (/\\[A-Za-z]/.test(trimmed)) {
    return keepWords(trimmed);
  }
  return trimmed.includes('\\') ? trimmed : `\\text{${escapeText(trimmed)}}`;
}

function isMeasure(value: string): boolean {
  return /^[\d.]+\s*(?:cm|mm|em|ex|pt|in|px|mu)?$/.test(value.trim());
}

function commandPattern(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandHead(name: string): string {
  return `\\\\${commandPattern(name)}(\\*?(?:\\[[^\\]]*\\])*)`;
}

function optionalNotes(prefix: string): string {
  return [...prefix.matchAll(/\[([^\]]*)\]/g)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((note) => note.length > 0)
    .join(', ');
}

function withNotes(body: string, prefix: string): string {
  const notes = optionalNotes(prefix);
  const text = body.trim();
  if (notes.length === 0) {
    return text;
  }
  return text.length > 0 ? `${text} (${notes})` : notes;
}

function bracedGroup(
  source: string,
  index: number
): { readonly body: string; readonly end: number } | null {
  if (source[index] !== '{') {
    return null;
  }
  const close = groupEnd(source, index);
  if (close === null) {
    return null;
  }
  return { body: source.slice(index + 1, close), end: close + 1 };
}

function commandBody(first: string, second: string | null): string {
  if (second === null) {
    return first;
  }
  if (isMeasure(first) || second.trim().length === 0) {
    return second || first;
  }
  return `${second} (${first})`;
}

function stripBare(source: string, name: string): string {
  const bare = new RegExp(`\\\\${commandPattern(name)}\\*?(?![A-Za-z])`).exec(source);
  if (bare?.[0] === undefined) {
    return source;
  }
  const rest = `${source.slice(0, bare.index)}${source.slice(bare.index + bare[0].length)}`.trim();
  if (rest.length === 0) {
    return source;
  }
  return `${source.slice(0, bare.index)}${source.slice(bare.index + bare[0].length)}`;
}

function stripCommand(source: string, name: string): string {
  const found = new RegExp(commandHead(name)).exec(source);
  if (found?.[0] === undefined) {
    return source;
  }
  const start = found.index;
  const first = bracedGroup(source, start + found[0].length);
  if (first === null) {
    return stripBare(source, name);
  }
  const second = bracedGroup(source, first.end);
  const body = commandBody(first.body, second === null ? null : second.body);
  const shown = asText(withNotes(body, found[1] ?? ''));
  const end = second === null ? first.end : second.end;
  return `${source.slice(0, start)}${shown}${source.slice(end)}`;
}

function recover(source: string, message: string): string | null {
  const missing = /No such environment: ([A-Za-z*]+)/.exec(message)?.[1];
  if (missing !== undefined) {
    const next = stripEnvironment(source, missing);
    return next === source ? null : next;
  }
  const command = /Undefined control sequence: \\([A-Za-z]+)/.exec(message)?.[1];
  if (command === undefined) {
    return null;
  }
  const next = stripCommand(source, command);
  return next === source ? null : next;
}

function redCommand(html: string): string | undefined {
  const text = /<mtext>([^<]*)<\/mtext>/.exec(html)?.[1] ?? '';
  return /^\\([A-Za-z]+)$/.exec(text)?.[1];
}

/** Prepare TeX for KaTeX, keeping words from commands KaTeX does not implement. */
export function prepareKatexSource(source: string): string {
  let current = katexMathTex(renderableMathTex(source));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const html = katex.renderToString(current, { throwOnError: true });
      const marked = html.includes('#cc0000') || html.includes('katex-error');
      const command = marked ? redCommand(html) : undefined;
      if (command === undefined) {
        return current;
      }
      const next = stripCommand(current, command);
      if (next === current) {
        return current;
      }
      current = next;
    } catch (error) {
      const next = recover(current, error instanceof Error ? error.message : '');
      if (next === null) {
        return current;
      }
      current = next;
    }
  }
  return current;
}
