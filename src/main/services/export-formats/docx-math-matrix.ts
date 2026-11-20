import {
  MathCurlyBrackets,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  type MathComponent,
} from 'docx';

export interface MathSource {
  source: string;
  index: number;
}

export function readRawGroup(cursor: MathSource): string {
  if (cursor.source[cursor.index] !== '{') {
    return '';
  }
  cursor.index += 1;
  let name = '';
  while (cursor.index < cursor.source.length && cursor.source[cursor.index] !== '}') {
    name += cursor.source[cursor.index] ?? '';
    cursor.index += 1;
  }
  if (cursor.source[cursor.index] === '}') {
    cursor.index += 1;
  }
  return name.trim();
}

export function endsMatrix(cursor: MathSource, name: string): boolean {
  if (!cursor.source.startsWith('\\end', cursor.index)) {
    return false;
  }
  const saved = cursor.index;
  cursor.index += 4;
  const endName = readRawGroup(cursor);
  if (endName === name) {
    return true;
  }
  cursor.index = saved;
  return false;
}

const LABELED_ENVIRONMENT = new Set([
  'abstract',
  'center',
  'claim',
  'conjecture',
  'corollary',
  'definition',
  'example',
  'exercise',
  'figure',
  'flushleft',
  'flushright',
  'lemma',
  'minipage',
  'note',
  'proof',
  'proposition',
  'quote',
  'remark',
  'solution',
  'table',
  'theorem',
  'titlepage',
  'warning',
]);

function environmentLabel(name: string): string {
  const plain = name.endsWith('*') ? name.slice(0, -1) : name;
  if (!LABELED_ENVIRONMENT.has(plain)) {
    return '';
  }
  return `${plain.charAt(0).toUpperCase()}${plain.slice(1)}. `;
}

function wrapMatrix(name: string, body: MathComponent[]): MathComponent[] {
  if (name === 'pmatrix') return [new MathRoundBrackets({ children: body })];
  if (name === 'bmatrix') return [new MathSquareBrackets({ children: body })];
  if (name === 'Bmatrix' || name === 'cases') return [new MathCurlyBrackets({ children: body })];
  if (name === 'vmatrix' || name === 'Vmatrix') {
    const bar = name === 'Vmatrix' ? '‖' : '|';
    return [new MathRun(bar), ...body, new MathRun(bar)];
  }
  const label = environmentLabel(name);
  return label.length === 0 ? body : [new MathRun(label), ...body];
}

export function readMatrix(
  cursor: MathSource,
  readBody: (cursor: MathSource, name: string) => MathComponent[]
): MathComponent[] {
  const name = readRawGroup(cursor);
  return wrapMatrix(name, readBody(cursor, name));
}
