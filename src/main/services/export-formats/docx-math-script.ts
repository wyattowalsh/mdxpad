import {
  MathCurlyBrackets,
  MathFraction,
  MathLimitLower,
  MathLimitUpper,
  MathPreSubSuperScript,
  MathIntegral,
  MathRadical,
  MathRoundBrackets,
  MathRun,
  MathSquareBrackets,
  MathSubScript,
  MathSubSuperScript,
  MathSum,
  MathSuperScript,
  type MathComponent,
} from 'docx';

function nestedRoot(value: object): readonly unknown[] | null {
  const root: unknown = Object.getOwnPropertyDescriptor(value, 'root')?.value;
  return Array.isArray(root) ? root : null;
}

function isMathComponent(value: object): value is MathComponent {
  return (
    value instanceof MathRun ||
    value instanceof MathFraction ||
    value instanceof MathSubScript ||
    value instanceof MathSuperScript ||
    value instanceof MathSubSuperScript ||
    value instanceof MathRadical ||
    value instanceof MathRoundBrackets ||
    value instanceof MathSquareBrackets ||
    value instanceof MathCurlyBrackets ||
    value instanceof MathLimitUpper ||
    value instanceof MathLimitLower ||
    value instanceof MathSum ||
    value instanceof MathIntegral
  );
}

function collectMath(node: object): MathComponent[] {
  const root = nestedRoot(node);
  if (root === null) {
    return [];
  }
  const children: MathComponent[] = [];
  for (const item of root) {
    if (typeof item === 'object' && item !== null && isMathComponent(item)) {
      children.push(item);
    }
  }
  return children;
}

function pairedScripts(component: MathComponent): {
  base: MathComponent[];
  sub?: MathComponent[];
  sup?: MathComponent[];
} | null {
  const subscript = component instanceof MathSubScript;
  const superscript = component instanceof MathSuperScript;
  if (!subscript && !superscript) {
    return null;
  }
  const root = nestedRoot(component);
  const baseNode = root?.[1];
  const scriptNode = root?.[2];
  if (typeof baseNode !== 'object' || baseNode === null) {
    return null;
  }
  if (typeof scriptNode !== 'object' || scriptNode === null) {
    return null;
  }
  const base = collectMath(baseNode);
  const scripts = collectMath(scriptNode);
  return subscript ? { base, sub: scripts } : { base, sup: scripts };
}

export function scriptBase(
  components: MathComponent[],
  plain: string,
): { plain: string; base: MathComponent[] } {
  const trimmed = plain.trimEnd();
  if (trimmed.length > 0) {
    return { plain: trimmed.slice(0, -1), base: [new MathRun(trimmed.slice(-1))] };
  }
  const previous = components.pop();
  return { plain: '', base: previous ? [previous] : [new MathRun('')] };
}

export function takePrimes(source: string, index: number): { next: number; mark: MathRun } {
  let next = index;
  while (source[next] === "'") next += 1;
  return { next, mark: new MathRun('′'.repeat(next - index)) };
}

function xmlName(value: object): string {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'rootKey');
  if (typeof descriptor?.value !== 'string') {
    return '';
  }
  return descriptor.value;
}

function naryKind(component: MathComponent): 'sum' | 'integral' | null {
  if (component instanceof MathSum) {
    return 'sum';
  }
  if (component instanceof MathIntegral) {
    return 'integral';
  }
  const text = mathRunString(component);
  if (text === '∑') {
    return 'sum';
  }
  if (text === '∫') {
    return 'integral';
  }
  return null;
}

function naryScripts(component: MathComponent): {
  sub?: readonly MathComponent[];
  sup?: readonly MathComponent[];
} {
  const root = nestedRoot(component);
  const found: { sub?: MathComponent[]; sup?: MathComponent[] } = {};
  if (root === null) {
    return found;
  }
  for (const item of root) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const name = xmlName(item);
    if (name === 'm:sub') {
      found.sub = collectMath(item);
    } else if (name === 'm:sup') {
      found.sup = collectMath(item);
    }
  }
  return found;
}

function attachNary(
  kind: 'sum' | 'integral',
  existing: { sub?: readonly MathComponent[]; sup?: readonly MathComponent[] },
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent {
  const sub = mark === '_' ? script : existing.sub;
  const sup = mark === '^' ? script : existing.sup;
  const options = {
    children: [new MathRun('')],
    ...(sub === undefined ? {} : { subScript: sub }),
    ...(sup === undefined ? {} : { superScript: sup }),
  };
  return kind === 'sum' ? new MathSum(options) : new MathIntegral(options);
}

export function attachScript(
  base: readonly MathComponent[],
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent {
  const only = base.length === 1 ? base[0] : undefined;
  const kind = only === undefined ? null : naryKind(only);
  if (only !== undefined && kind !== null) {
    const existing = only instanceof MathRun ? {} : naryScripts(only);
    return attachNary(kind, existing, mark, script);
  }
  const paired = only === undefined ? null : pairedScripts(only);
  if (paired !== null) {
    const sub = mark === '_' ? script : paired.sub;
    const sup = mark === '^' ? script : paired.sup;
    if (sub !== undefined && sup !== undefined) {
      return new MathSubSuperScript({
        children: paired.base,
        subScript: sub,
        superScript: sup,
      });
    }
  }
  if (mark === '^') {
    return new MathSuperScript({ children: base, superScript: script });
  }
  return new MathSubScript({ children: base, subScript: script });
}

const INFIX = new Set(['over', 'choose', 'atop', 'brace', 'brack']);

export function infixName(source: string, index: number): string | null {
  if (source[index] !== '\\') {
    return null;
  }
  let cursor = index + 1;
  let name = '';
  while (cursor < source.length && /[A-Za-z]/.test(source[cursor] ?? '')) {
    name += source[cursor] ?? '';
    cursor += 1;
  }
  return INFIX.has(name) ? name : null;
}

export function infixComponent(
  name: string,
  numerator: readonly MathComponent[],
  denominator: readonly MathComponent[],
): MathComponent {
  const fraction = new MathFraction({ numerator, denominator });
  if (name === 'choose') {
    return new MathRoundBrackets({ children: [fraction] });
  }
  if (name === 'brace') {
    return new MathCurlyBrackets({ children: [fraction] });
  }
  if (name === 'brack') {
    return new MathSquareBrackets({ children: [fraction] });
  }
  return fraction;
}

export function takeInfix(
  cursor: { source: string; index: number },
  components: MathComponent[],
  plain: string,
  readRest: () => readonly MathComponent[],
): boolean {
  const infix = infixName(cursor.source, cursor.index);
  if (infix === null) {
    return false;
  }
  const trimmed = plain.trimEnd();
  if (trimmed.length > 0) {
    components.push(new MathRun(trimmed));
  }
  const numerator = components.splice(0, components.length);
  cursor.index += 1 + infix.length;
  while (cursor.source[cursor.index] === ' ' || cursor.source[cursor.index] === '\n') {
    cursor.index += 1;
  }
  components.push(infixComponent(infix, numerator, readRest()));
  return true;
}

export function equationTag(
  cursor: { source: string; index: number },
  readGroup: () => readonly MathComponent[],
): MathComponent[] {
  if (cursor.source[cursor.index] === '*') {
    cursor.index += 1;
  }
  return [new MathRoundBrackets({ children: readGroup() })];
}

function mathRunString(component: MathComponent): string | null {
  if (!(component instanceof MathRun)) {
    return null;
  }
  const outer = nestedRoot(component);
  const inner = outer?.[0];
  if (typeof inner !== 'object' || inner === null) {
    return null;
  }
  const text = nestedRoot(inner)?.[0];
  return typeof text === 'string' ? text : null;
}

function emptyBase(parts: readonly MathComponent[]): boolean {
  if (parts.length === 0) {
    return true;
  }
  const only = parts.length === 1 ? parts[0] : undefined;
  return only !== undefined && mathRunString(only) === '';
}

function scriptList(node: unknown): MathComponent[] | null {
  if (typeof node !== 'object' || node === null) {
    return null;
  }
  return collectMath(node);
}

function prescriptParts(component: MathComponent): { sub: MathComponent[]; sup: MathComponent[] } | null {
  if (component instanceof MathSubSuperScript) {
    const root = nestedRoot(component);
    const base = scriptList(root?.[1]);
    const sub = scriptList(root?.[2]);
    const sup = scriptList(root?.[3]);
    if (base === null || sub === null || sup === null || !emptyBase(base)) {
      return null;
    }
    return { sub, sup };
  }
  const paired = pairedScripts(component);
  if (paired === null || !emptyBase(paired.base)) {
    return null;
  }
  return { sub: paired.sub ?? [], sup: paired.sup ?? [] };
}

function prescriptBase(
  components: readonly MathComponent[],
  index: number,
): { base: MathComponent; skip: number } | null {
  let cursor = index;
  while (cursor < components.length) {
    const item = components[cursor];
    if (item === undefined) {
      return null;
    }
    const text = mathRunString(item);
    if (text !== null && text.trim().length === 0) {
      cursor += 1;
      continue;
    }
    if (text !== null && text !== text.trimStart()) {
      return { base: new MathRun(text.trimStart()), skip: cursor - index + 1 };
    }
    return { base: item, skip: cursor - index + 1 };
  }
  return null;
}

export function liftPrescripts(components: readonly MathComponent[]): MathComponent[] {
  const lifted: MathComponent[] = [];
  for (let index = 0; index < components.length; index += 1) {
    const current = components[index];
    const scripts = current === undefined ? null : prescriptParts(current);
    const base = scripts === null ? null : prescriptBase(components, index + 1);
    if (current !== undefined && scripts !== null && base !== null) {
      lifted.push(
        new MathPreSubSuperScript({
          children: [base.base],
          subScript: scripts.sub,
          superScript: scripts.sup,
        }),
      );
      index += base.skip;
      continue;
    }
    if (current !== undefined) {
      lifted.push(current);
    }
  }
  return lifted;
}

export function pushScript(
  cursor: { source: string; index: number },
  components: MathComponent[],
  base: readonly MathComponent[],
  char: '^' | '_' | "'",
  readGroup: () => readonly MathComponent[],
): void {
  if (char === "'") {
    const primes = takePrimes(cursor.source, cursor.index);
    cursor.index = primes.next;
    components.push(attachScript(base, '^', [primes.mark]));
    return;
  }
  cursor.index += 1;
  components.push(attachScript(base, char, readGroup()));
}
