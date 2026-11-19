import {
  MathCurlyBrackets,
  MathFraction,
  MathIntegral,
  MathLimitLower,
  MathLimitUpper,
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

const LIMIT_OPERATORS = new Set([
  '∏',
  '∐',
  '⋃',
  '⋂',
  '⋁',
  '⋀',
  'lim',
  'limsup',
  'liminf',
  'max',
  'min',
  'sup',
  'inf',
  'det',
  'gcd',
  'Pr',
]);

function nestedRoot(value: object): readonly unknown[] | null {
  const root: unknown = Object.getOwnPropertyDescriptor(value, 'root')?.value;
  return Array.isArray(root) ? root : null;
}

function xmlName(value: object): string {
  const descriptor = Object.getOwnPropertyDescriptor(value, 'rootKey');
  if (typeof descriptor?.value !== 'string') {
    return '';
  }
  return descriptor.value;
}

function runText(component: MathComponent): string | null {
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

function isComponent(value: object): value is MathComponent {
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

function collect(node: object): MathComponent[] {
  const root = nestedRoot(node);
  if (root === null) {
    return [];
  }
  const children: MathComponent[] = [];
  for (const item of root) {
    if (typeof item === 'object' && item !== null && isComponent(item)) {
      children.push(item);
    }
  }
  return children;
}

function naryKind(component: MathComponent): 'sum' | 'integral' | null {
  if (component instanceof MathSum) {
    return 'sum';
  }
  if (component instanceof MathIntegral) {
    return 'integral';
  }
  const text = runText(component);
  if (text === '∑') {
    return 'sum';
  }
  if (text === '∫') {
    return 'integral';
  }
  return null;
}

function namedChildren(component: MathComponent, name: string): MathComponent[] | undefined {
  const root = nestedRoot(component);
  if (root === null) {
    return undefined;
  }
  for (const item of root) {
    if (typeof item === 'object' && item !== null && xmlName(item) === name) {
      return collect(item);
    }
  }
  return undefined;
}

function attachNary(
  kind: 'sum' | 'integral',
  component: MathComponent,
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent {
  const sub = mark === '_' ? script : namedChildren(component, 'm:sub');
  const sup = mark === '^' ? script : namedChildren(component, 'm:sup');
  const options = {
    children: [new MathRun('')],
    ...(sub === undefined ? {} : { subScript: sub }),
    ...(sup === undefined ? {} : { superScript: sup }),
  };
  return kind === 'sum' ? new MathSum(options) : new MathIntegral(options);
}

function limitOperator(component: MathComponent): boolean {
  const text = runText(component);
  return text !== null && LIMIT_OPERATORS.has(text);
}

function stackLimit(
  base: readonly MathComponent[],
  sub: readonly MathComponent[] | undefined,
  sup: readonly MathComponent[] | undefined,
): MathComponent {
  const under =
    sub === undefined ? base : [new MathLimitLower({ children: base, limit: sub })];
  if (sup === undefined) {
    return under[0] ?? new MathRun('');
  }
  return new MathLimitUpper({ children: under, limit: sup });
}

function attachLimit(
  component: MathComponent,
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent | null {
  const lower = component instanceof MathLimitLower;
  const upper = component instanceof MathLimitUpper;
  if (lower || upper) {
    const base = namedChildren(component, 'm:e');
    const limit = namedChildren(component, 'm:lim');
    if (base === undefined || limit === undefined || !limitOperator(base[0] ?? new MathRun(''))) {
      return null;
    }
    const sub = mark === '_' ? script : lower ? limit : undefined;
    const sup = mark === '^' ? script : upper ? limit : undefined;
    return stackLimit(base, sub, sup);
  }
  if (!limitOperator(component)) {
    return null;
  }
  return mark === '_'
    ? new MathLimitLower({ children: [component], limit: script })
    : new MathLimitUpper({ children: [component], limit: script });
}

/** A sum, integral, product, or limit keeps its bounds on the operator. */
export function operatorScript(
  component: MathComponent,
  mark: '^' | '_',
  script: readonly MathComponent[],
): MathComponent | null {
  const kind = naryKind(component);
  if (kind !== null) {
    return attachNary(kind, component, mark, script);
  }
  return attachLimit(component, mark, script);
}
