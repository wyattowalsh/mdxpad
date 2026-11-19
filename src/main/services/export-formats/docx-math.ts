import {
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSubSuperScript,
  MathSubScript,
  MathSuperScript,
  type MathComponent,
} from 'docx';

import { endsMatrix, readMatrix, readRawGroup } from './docx-math-matrix';
import {
  ACCENTS,
  ATOM_COMMANDS,
  DELIMITER_COMMANDS,
  NEGATED,
  STYLE_COMMANDS,
  SYMBOLS,
  TEXT_COMMANDS,
} from './docx-math-symbols';
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

function groupedCommand(cursor: Cursor, name: string): MathComponent[] | null {
  if (DELIMITER_COMMANDS.has(name)) {
    skipDelimiter(cursor);
    return [];
  }
  if (STYLE_COMMANDS.has(name)) {
    return [];
  }
  if (ATOM_COMMANDS.has(name) || TEXT_COMMANDS.has(name)) {
    return readGroup(cursor);
  }
  if (name === 'begin') {
    return readMatrix(cursor, (current, env) => readSequence(current, null, env));
  }
  if (name === 'xrightarrow') {
    return readStretchArrow(cursor, '→');
  }
  if (name === 'xleftarrow') {
    return readStretchArrow(cursor, '←');
  }
  if (name === 'end') {
    readRawGroup(cursor);
    return [];
  }
  if (name === 'cancel' || name === 'bcancel' || name === 'xcancel') return readCancel(cursor);
  return null;
}

function readCancel(cursor: Cursor): MathComponent[] {
  return readGroup(cursor).map((part) => {
    if (!(part instanceof MathRun)) return part;
    let struck = '';
    for (const char of mathRunText(part)) struck += `${char}\u0336`;
    return new MathRun(struck);
  });
}

function commandComponents(cursor: Cursor, name: string): MathComponent[] {
  const grouped = groupedCommand(cursor, name);
  if (grouped !== null) {
    return grouped;
  }
  if (name === 'overbrace') {
    return readBraceSpan(cursor, true);
  }
  if (name === 'underbrace') {
    return readBraceSpan(cursor, false);
  }
  if (name === 'overset' || name === 'stackrel') {
    return readStack(cursor, true);
  }
  if (name === 'underset') {
    return readStack(cursor, false);
  }
  if (name === 'binom' || name === 'dbinom' || name === 'tbinom') {
    return readBinom(cursor);
  }
  if (name === 'pmod') {
    return readMod(cursor, true);
  }
  if (name === 'bmod' || name === 'mod') {
    return readMod(cursor, false);
  }
  if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') {
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

function readMod(cursor: Cursor, parenthesized: boolean): MathComponent[] {
  if (!parenthesized) {
    return [new MathRun('mod')];
  }
  return [
    new MathRoundBrackets({
      children: [new MathRun('mod '), ...readGroup(cursor)],
    }),
  ];
}

function readBraceSpan(cursor: Cursor, upper: boolean): MathComponent[] {
  const body = readGroup(cursor);
  const brace = [new MathRun(upper ? '\u23DE' : '\u23DF')];
  if (upper) {
    return [new MathLimitUpper({ children: body, limit: brace })];
  }
  return [new MathLimitLower({ children: body, limit: brace })];
}

function readStretchArrow(cursor: Cursor, arrow: string): MathComponent[] {
  const below = readOptionalBracket(cursor);
  const above = readGroup(cursor);
  const base = [new MathRun(arrow)];
  if (below !== null && above.length > 0) {
    return [new MathSubSuperScript({ children: base, subScript: below, superScript: above })];
  }
  if (below !== null) {
    return [new MathLimitLower({ children: base, limit: below })];
  }
  if (above.length > 0) {
    return [new MathLimitUpper({ children: base, limit: above })];
  }
  return base;
}

function readStack(cursor: Cursor, upper: boolean): MathComponent[] {
  const annotation = readGroup(cursor);
  const base = readGroup(cursor);
  if (upper) {
    return [new MathLimitUpper({ children: base, limit: annotation })];
  }
  return [new MathLimitLower({ children: base, limit: annotation })];
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

function readSequence(cursor: Cursor, stop: string | null, untilEnd?: string): MathComponent[] {
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
    if (untilEnd !== undefined && endsMatrix(cursor, untilEnd)) {
      break;
    }
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
      components.push(char === '^'
        ? new MathSuperScript({ children: base.base, superScript: script })
        : new MathSubScript({ children: base.base, subScript: script }));
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
