import {
  MathFraction,
  MathRadical,
  MathRun,
  MathSubScript,
  MathSuperScript,
  type MathComponent,
} from 'docx';

import { isCurrencySpan } from '@shared/lib/currency-span';

interface Cursor {
  source: string;
  index: number;
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  cdot: '·',
  times: '×',
  pm: '±',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  infty: '∞',
};

function takeMath(raw: string, start: number, delimiter: '$' | '$$'): number {
  const end = raw.indexOf(delimiter, start + delimiter.length);
  if (end === -1) {
    return -1;
  }
  const interior = raw.slice(start + delimiter.length, end);
  if (interior.length === 0 || isCurrencySpan(interior)) {
    return -1;
  }
  return end + delimiter.length;
}

export type DocxPiece =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'math'; readonly tex: string };

export function splitDocxPieces(value: string): DocxPiece[] {
  const pieces: DocxPiece[] = [];
  let index = 0;
  let textStart = 0;
  let inCode = false;
  while (index < value.length) {
    if (value[index] === '`') {
      inCode = !inCode;
      index += 1;
      continue;
    }
    const delimiter =
      !inCode && value.startsWith('$$', index)
        ? '$$'
        : !inCode && value[index] === '$'
          ? '$'
          : null;
    const end = delimiter === null ? -1 : takeMath(value, index, delimiter);
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

function readCommand(cursor: Cursor): MathComponent[] {
  cursor.index += 1;
  let name = '';
  while (
    cursor.index < cursor.source.length &&
    /[A-Za-z]/.test(cursor.source[cursor.index] ?? '')
  ) {
    name += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
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
    return [new MathRadical({ children: readGroup(cursor) })];
  }
  return [new MathRun(SYMBOLS[name] ?? name)];
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
