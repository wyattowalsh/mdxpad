/**
 * Names a preview would otherwise leave invisible.
 * A button, a suggestion list, a formula source, and a caption track
 * keep the words a reader is meant to see.
 */

export interface VisibleName {
  readonly kind: 'replace' | 'button' | 'note';
  readonly text: string;
}

function nodes(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => nodes(item));
  }
  if (value === null || value === undefined || typeof value === 'boolean') {
    return [];
  }
  return [value];
}

function parts(
  node: unknown
): { readonly type: unknown; readonly props: Record<string, unknown> } | null {
  if (node === null || typeof node !== 'object' || !('type' in node) || !('props' in node)) {
    return null;
  }
  const props = (node as { readonly props?: unknown }).props;
  if (props === null || typeof props !== 'object') {
    return null;
  }
  return {
    type: (node as { readonly type: unknown }).type,
    props: props as Record<string, unknown>,
  };
}

function nameOf(type: unknown): string | null {
  return typeof type === 'string' ? type.toLowerCase() : null;
}

function textOf(value: unknown): string {
  return nodes(value)
    .filter((node): node is string => typeof node === 'string')
    .join('')
    .trim();
}

function stringProp(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value.trim() : '';
}

function buttonName(props: Record<string, unknown>): VisibleName | undefined {
  if (textOf(props.children).length > 0 || nodes(props.children).some((node) => parts(node))) {
    return undefined;
  }
  const label = stringProp(props, 'aria-label') || stringProp(props, 'value');
  return label.length > 0 ? { kind: 'button', text: label } : undefined;
}

function optionLabel(node: unknown): string {
  const element = parts(node);
  if (element === null) {
    return '';
  }
  const name = nameOf(element.type);
  if (name === 'optgroup') {
    const nested = nodes(element.props.children)
      .map((child) => optionLabel(child))
      .filter((label) => label.length > 0);
    const group = stringProp(element.props, 'label');
    return [group, ...nested].filter((label) => label.length > 0).join(', ');
  }
  if (name !== 'option') {
    return '';
  }
  return (
    stringProp(element.props, 'label') ||
    textOf(element.props.children) ||
    stringProp(element.props, 'value')
  );
}

function listName(props: Record<string, unknown>): VisibleName | undefined {
  const labels = nodes(props.children)
    .map((node) => optionLabel(node))
    .filter((label) => label.length > 0);
  return labels.length > 0 ? { kind: 'replace', text: labels.join(', ') } : undefined;
}

const PRESENTED = new Set([
  'mi',
  'mn',
  'mo',
  'mtext',
  'ms',
  'mfrac',
  'msup',
  'msub',
  'msqrt',
  'mroot',
  'mrow',
  'mtable',
]);

function mathSource(node: unknown, hidden: boolean): { presented: boolean; text: string[] } {
  if (typeof node === 'string') {
    const text = node.trim();
    return { presented: false, text: hidden && text.length > 0 ? [text] : [] };
  }
  const element = parts(node);
  if (element === null) {
    return { presented: false, text: [] };
  }
  const name = nameOf(element.type) ?? '';
  const annotation = name === 'annotation' || name === 'annotation-xml';
  if (name === 'mglyph' && !hidden) {
    const alt = stringProp(element.props, 'alt');
    return { presented: false, text: alt.length > 0 ? [alt] : [] };
  }
  let presented = !hidden && !annotation && PRESENTED.has(name);
  const text: string[] = [];
  for (const child of nodes(element.props.children)) {
    const nested = mathSource(child, hidden || annotation);
    presented = presented || nested.presented;
    text.push(...nested.text);
  }
  return { presented, text };
}

function mathName(props: Record<string, unknown>): VisibleName | undefined {
  const found = nodes(props.children).map((node) => mathSource(node, false));
  const presented = found.some((item) => item.presented);
  const text = found.flatMap((item) => item.text);
  if (presented || text.length === 0) {
    return undefined;
  }
  return { kind: 'replace', text: text.join(' ') };
}

function trackLabels(node: unknown): string[] {
  const element = parts(node);
  if (element === null) {
    return [];
  }
  if (nameOf(element.type) === 'track') {
    const label = stringProp(element.props, 'label');
    return label.length > 0 ? [label] : [];
  }
  return nodes(element.props.children).flatMap((child) => trackLabels(child));
}

function frameName(props: Record<string, unknown>): VisibleName | undefined {
  if (textOf(props.children).length > 0 || nodes(props.children).some((node) => parts(node))) {
    return undefined;
  }
  const label = stringProp(props, 'title') || stringProp(props, 'alt');
  return label.length > 0 ? { kind: 'replace', text: label } : undefined;
}

function mediaNote(props: Record<string, unknown>): VisibleName | undefined {
  const labels = nodes(props.children).flatMap((node) => trackLabels(node));
  return labels.length > 0 ? { kind: 'note', text: labels.join(', ') } : undefined;
}

/** The visible name for a control, formula, or caption that would not paint its words. */
export function visibleName(type: unknown, props: unknown): VisibleName | undefined {
  const name = nameOf(type);
  if (name === null || props === null || typeof props !== 'object') {
    return undefined;
  }
  const record = props as Record<string, unknown>;
  switch (name) {
    case 'button':
      return buttonName(record);
    case 'datalist':
      return listName(record);
    case 'math':
      return mathName(record);
    case 'video':
    case 'audio':
      return mediaNote(record);
    case 'iframe':
    case 'object':
    case 'embed':
      return frameName(record);
    default:
      return undefined;
  }
}
