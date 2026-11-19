import {
  MathFraction,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSubScript,
  MathSuperScript,
  type MathComponent,
} from 'docx';

import { ACCENTS, DELIMITER_COMMANDS, NEGATED, SYMBOLS, TEXT_COMMANDS } from './docx-math-symbols';
import { readCodeSpan } from './markdown-escape';
import { mathDelimiterAt, mathSpanEnd } from './markdown-math-span';

interface Cursor {
  source: string;
  index: number;
}

const LITERAL_ESCAPE: Record<string, string> = {
  '|': '‖',
  ',': '\u2009',
  ':': '\u2004',
  ';': '\u2005',
  '!': '',
  '\\': '\n',
};

export type DocxPiece =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'math'; readonly tex: string };

export function splitDocxPieces(value: string): DocxPiece[] {
  const pieces: DocxPiece[] = [];
  let index = 0;
  let textStart = 0;
  while (index < value.length) {
    if (value[index] === '`') {
      const span = readCodeSpan(value, index);
      index = span ? span.end : index + 1;
      continue;
    }
    const delimiter = mathDelimiterAt(value, index);
    const end = delimiter === null ? -1 : mathSpanEnd(value, index, delimiter);
    if (delimiter !== null && end !== -1) {
      if (index > textStart) {
        pieces.push({ kind: 'text', text: value.slice(textStart, index) });
      }
      pieces.push({
        kind: 'math',
        tex: value.slice(index + delimiter.length, end - delimiter.length),
      });
      index = end;
      textStart = index;
      continue;
    }
    index += 1;
  }
  if (textStart < value.length) {
    pieces.push({ kind: 'text', text: value.slice(textStart) });
  }
  return pieces;
}

function readEscapedSymbol(cursor: Cursor): MathComponent[] {
  const symbol = cursor.source[cursor.index] ?? '';
  if (symbol.length === 0) {
    return [new MathRun('\\')];
  }
  cursor.index += 1;
  const text = LITERAL_ESCAPE[symbol] ?? symbol;
  return text.length > 0 ? [new MathRun(text)] : [];
}

function readCommandName(cursor: Cursor): string {
  let name = '';
  while (
    cursor.index < cursor.source.length &&
    /[A-Za-z]/.test(cursor.source[cursor.index] ?? '')
  ) {
    name += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
  }
  return name;
}

function readNegation(cursor: Cursor): MathComponent[] {
  if (cursor.source[cursor.index] === '\\') {
    cursor.index += 1;
    const name = readCommandName(cursor);
    return [new MathRun(NEGATED[name] ?? `¬${SYMBOLS[name] ?? name}`)];
  }
  const symbol = cursor.source[cursor.index] ?? '';
  if (symbol.length === 0) {
    return [new MathRun('¬')];
  }
  cursor.index += 1;
  return [new MathRun(NEGATED[symbol] ?? `¬${symbol}`)];
}

function skipDelimiter(cursor: Cursor): void {
  if (cursor.source[cursor.index] === '.') {
    cursor.index += 1;
  }
}

function commandComponents(cursor: Cursor, name: string): MathComponent[] {
  if (DELIMITER_COMMANDS.has(name)) {
    skipDelimiter(cursor);
    return [];
  }
  if (name === 'begin' || name === 'end') {
    readGroup(cursor);
    return [];
  }
  if (TEXT_COMMANDS.has(name)) {
    return readGroup(cursor);
  }
  if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
    return readBinom(cursor);
  }
  if (name === 'frac') {
    return [
      new MathFraction({
        numerator: readGroup(cursor),
        denominator: readGroup(cursor),
      }),
    ];
  }
  if (name === 'sqrt') {
    return readRadical(cursor);
  }
  if (name === 'not') {
    return readNegation(cursor);
  }
  const accent = ACCENTS[name];
  if (accent !== undefined) {
    return readAccent(cursor, accent);
  }
  const symbol = SYMBOLS[name];
  return [new MathRun(symbol ?? name)];
}

function readCommand(cursor: Cursor): MathComponent[] {
  cursor.index += 1;
  const name = readCommandName(cursor);
  if (name.length === 0) {
    return readEscapedSymbol(cursor);
  }
  return commandComponents(cursor, name);
}

function readOptionalBracket(cursor: Cursor): MathComponent[] | null {
  if (cursor.source[cursor.index] !== '[') {
    return null;
  }
  cursor.index += 1;
  const parts = readSequence(cursor, ']');
  if (cursor.source[cursor.index] === ']') {
    cursor.index += 1;
  }
  return parts;
}

function nestedRoot(value: object): readonly unknown[] | null {
  const root: unknown = Object.getOwnPropertyDescriptor(value, 'root')?.value;
  return Array.isArray(root) ? root : null;
}

function mathRunText(run: MathRun): string {
  const outer = nestedRoot(run);
  const inner = outer?.[0];
  if (typeof inner !== 'object' || inner === null) {
    return '';
  }
  const text = nestedRoot(inner)?.[0];
  return typeof text === 'string' ? text : '';
}

function readAccent(cursor: Cursor, mark: string): MathComponent[] {
  const parts = readGroup(cursor);
  const last = parts[parts.length - 1];
  if (last instanceof MathRun) {
    parts[parts.length - 1] = new MathRun(`${mathRunText(last)}${mark}`);
    return parts;
  }
  return [...parts, new MathRun(mark)];
}

function readBinom(cursor: Cursor): MathComponent[] {
  return [
    new MathRoundBrackets({
      children: [
        new MathFraction({
          numerator: readGroup(cursor),
          denominator: readGroup(cursor),
        }),
      ],
    }),
  ];
}

function readRadical(cursor: Cursor): MathComponent[] {
  const degree = readOptionalBracket(cursor);
  const children = readGroup(cursor);
  if (degree === null) {
    return [new MathRadical({ children })];
  }
  return [new MathRadical({ children, degree })];
}

function readGroup(cursor: Cursor): MathComponent[] {
  if (cursor.index >= cursor.source.length) {
    return [];
  }
  if (cursor.source[cursor.index] !== '{') {
    return readToken(cursor);
  }
  cursor.index += 1;
  const parts = readSequence(cursor, '}');
  if (cursor.source[cursor.index] === '}') {
    cursor.index += 1;
  }
  return parts;
}

function readToken(cursor: Cursor): MathComponent[] {
  if (cursor.source[cursor.index] === '\\') {
    return readCommand(cursor);
  }
  const char = cursor.source[cursor.index] ?? '';
  cursor.index += 1;
  return char.length > 0 ? [new MathRun(char)] : [];
}

function scriptBase(
  components: MathComponent[],
  plain: string
): { plain: string; base: MathComponent[] } {
  if (plain.length > 0) {
    return { plain: plain.slice(0, -1), base: [new MathRun(plain.slice(-1))] };
  }
  const previous = components.pop();
  return { plain, base: previous ? [previous] : [new MathRun('')] };
}

function readSequence(cursor: Cursor, stop: string | null): MathComponent[] {
  const components: MathComponent[] = [];
  let plain = '';
  const flush = (): void => {
    if (plain.length > 0) {
      components.push(new MathRun(plain));
      plain = '';
    }
  };
  while (cursor.index < cursor.source.length) {
    const char = cursor.source[cursor.index] ?? '';
    if (stop !== null && char === stop) {
      break;
    }
    if (char === '\\') {
      flush();
      components.push(...readCommand(cursor));
      continue;
    }
    if (char === '{') {
      flush();
      components.push(...readGroup(cursor));
      continue;
    }
    if (char === '^' || char === '_') {
      const base = scriptBase(components, plain);
      plain = base.plain;
      flush();
      cursor.index += 1;
      const script = readGroup(cursor);
      components.push(
        char === '^'
          ? new MathSuperScript({ children: base.base, superScript: script })
          : new MathSubScript({ children: base.base, subScript: script })
      );
      continue;
    }
    plain += char;
    cursor.index += 1;
  }
  flush();
  return components;
}

export function mathComponents(tex: string): MathComponent[] {
  const components = readSequence({ source: tex, index: 0 }, null);
  return components.length > 0 ? components : [new MathRun(tex)];
}
