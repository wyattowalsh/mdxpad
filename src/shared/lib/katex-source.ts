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

function asText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
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

function stripCommand(source: string, name: string): string {
  const head = commandHead(name);
  const two = new RegExp(`${head}\\{([^{}]*)\\}\\{([^{}]*)\\}`).exec(source);
  if (two?.[0] !== undefined) {
    const first = two[2] ?? '';
    const second = two[3] ?? '';
    const body = isMeasure(first) || second.trim().length === 0 ? second || first : `${second} (${first})`;
    return source.replace(two[0], asText(withNotes(body, two[1] ?? '')));
  }
  const one = new RegExp(`${head}\\{([^{}]*)\\}`).exec(source);
  if (one?.[0] !== undefined) {
    return source.replace(one[0], asText(withNotes(one[2] ?? '', one[1] ?? '')));
  }
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
