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

function headerName(props: Record<string, unknown>): VisibleName | undefined {
  const expansion = stringProp(props, 'abbr');
  if (expansion.length === 0 || nodes(props.children).some((node) => parts(node) !== null)) {
    return undefined;
  }
  const text = textOf(props.children);
  if (expansion === text) {
    return undefined;
  }
  const shown = text.length === 0 ? expansion : `${text} (${expansion})`;
  return { kind: 'button', text: shown };
}

function textareaName(props: Record<string, unknown>): VisibleName | undefined {
  if (textOf(props.children).length > 0 || stringProp(props, 'placeholder').length > 0) {
    return undefined;
  }
  const label = stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel');
  return label.length > 0 ? { kind: 'button', text: label } : undefined;
}

function optionName(props: Record<string, unknown>): VisibleName | undefined {
  if (textOf(props.children).length > 0) {
    return undefined;
  }
  const label = stringProp(props, 'label') || stringProp(props, 'value');
  return label.length > 0 ? { kind: 'button', text: label } : undefined;
}

function summaryName(props: Record<string, unknown>): VisibleName | undefined {
  const title = stringProp(props, 'title');
  if (title.length === 0 || nodes(props.children).some((node) => parts(node) !== null)) {
    return undefined;
  }
  const text = textOf(props.children);
  if (title === text) {
    return undefined;
  }
  return { kind: 'button', text: text.length === 0 ? title : `${text} (${title})` };
}

function emptyName(
  props: Record<string, unknown>,
  keys: readonly string[],
  format: (value: string) => string
): VisibleName | undefined {
  if (
    textOf(props.children).length > 0 ||
    nodes(props.children).some((node) => parts(node) !== null)
  ) {
    return undefined;
  }
  const value = keys.map((key) => stringProp(props, key)).find((item) => item.length > 0) ?? '';
  return value.length > 0 ? { kind: 'replace', text: format(value) } : undefined;
}

function gaugeName(
  props: Record<string, unknown>,
  name: 'meter' | 'progress'
): VisibleName | undefined {
  if (
    textOf(props.children).length > 0 ||
    nodes(props.children).some((node) => parts(node) !== null)
  ) {
    return undefined;
  }
  const current = stringProp(props, 'value');
  const title =
    stringProp(props, 'title') || stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel');
  if (current.length === 0) {
    return title.length > 0 ? { kind: 'replace', text: title } : undefined;
  }
  const max = stringProp(props, 'max');
  const reading = name === 'progress' && max.length > 0 ? `${current}/${max}` : current;
  const label = title.length > 0 && !reading.includes(title) ? `${reading} (${title})` : reading;
  return { kind: 'replace', text: label };
}

function stampName(props: Record<string, unknown>): VisibleName | undefined {
  const cite = stringProp(props, 'cite');
  const stamp =
    stringProp(props, 'aria-label') ||
    stringProp(props, 'ariaLabel') ||
    stringProp(props, 'title') ||
    stringProp(props, 'dateTime') ||
    stringProp(props, 'datetime') ||
    (cite.length > 0 && !/^(?:javascript|data|file):/i.test(cite) ? cite : '');
  if (stamp.length === 0 || textOf(props.children).includes(stamp)) {
    return undefined;
  }
  return { kind: 'note', text: stamp };
}

function selectName(props: Record<string, unknown>): VisibleName | undefined {
  const label =
    stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel') || stringProp(props, 'title');
  if (label.length === 0 || textOf(props.children).includes(label)) {
    return undefined;
  }
  return { kind: 'note', text: label };
}

function choiceName(props: Record<string, unknown>, type: string): VisibleName | undefined {
  const label =
    stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel') || stringProp(props, 'title');
  if (label.length > 0) {
    return { kind: 'note', text: label };
  }
  if (type !== 'radio') {
    return undefined;
  }
  const choice = stringProp(props, 'value');
  if (choice.length === 0 || /^(?:javascript|data|file):/i.test(choice)) {
    return undefined;
  }
  return { kind: 'note', text: choice };
}

function inputName(props: Record<string, unknown>): VisibleName | undefined {
  const type = stringProp(props, 'type').toLowerCase();
  if (type === 'file' || type === 'radio' || type === 'checkbox') {
    return choiceName(props, type);
  }
  if (type === 'hidden') {
    return undefined;
  }
  if (type === 'image') {
    return imageButtonName(props);
  }
  const label =
    stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel') || stringProp(props, 'title');
  const shown = stringProp(props, 'value') || stringProp(props, 'placeholder');
  if (shown.length > 0) {
    return label.length > 0 && label !== shown ? { kind: 'note', text: label } : undefined;
  }
  return label.length > 0 ? { kind: 'button', text: label } : undefined;
}

function frameName(props: Record<string, unknown>): VisibleName | undefined {
  if (textOf(props.children).length > 0 || nodes(props.children).some((node) => parts(node))) {
    return undefined;
  }
  const label =
    stringProp(props, 'title') ||
    stringProp(props, 'alt') ||
    stringProp(props, 'aria-label') ||
    stringProp(props, 'ariaLabel');
  return label.length > 0 ? { kind: 'replace', text: label } : undefined;
}

function imageButtonName(props: Record<string, unknown>): VisibleName | undefined {
  const label =
    stringProp(props, 'alt') || stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel');
  return label.length > 0 ? { kind: 'note', text: label } : undefined;
}

function readableCite(props: Record<string, unknown>): string {
  const cite = stringProp(props, 'cite');
  if (cite.length === 0 || /^(?:javascript|data|file):/i.test(cite)) {
    return '';
  }
  return cite;
}

function hasNestedElement(value: unknown): boolean {
  return nodes(value).some((node) => parts(node) !== null);
}

function citedName(props: Record<string, unknown>): VisibleName | undefined {
  const cite = readableCite(props);
  const text = textOf(props.children);
  if (cite.length === 0 || text.includes(cite)) {
    return undefined;
  }
  if (text.length === 0 && !hasNestedElement(props.children)) {
    return { kind: 'replace', text: cite };
  }
  return { kind: 'note', text: ` (${cite})` };
}

function commandName(props: Record<string, unknown>): VisibleName | undefined {
  const text = textOf(props.children);
  const label = stringProp(props, 'label');
  const shown = text.length > 0 ? text : label;
  return shown.length > 0 ? { kind: 'replace', text: shown } : undefined;
}

function appletName(props: Record<string, unknown>): VisibleName | undefined {
  const alt = stringProp(props, 'alt');
  const text = textOf(props.children);
  if (alt.length === 0 || text.includes(alt)) {
    return undefined;
  }
  if (text.length === 0 && !hasNestedElement(props.children)) {
    return { kind: 'replace', text: alt };
  }
  return { kind: 'note', text: alt };
}

function canvasName(props: Record<string, unknown>): VisibleName | undefined {
  const text = textOf(props.children);
  const label =
    stringProp(props, 'aria-label') || stringProp(props, 'ariaLabel') || stringProp(props, 'title');
  if (label.length === 0 || text.includes(label)) {
    return undefined;
  }
  if (text.length === 0 && !nodes(props.children).some((node) => parts(node))) {
    return { kind: 'replace', text: label };
  }
  return { kind: 'note', text: ` (${label})` };
}

function mediaNote(props: Record<string, unknown>): VisibleName | undefined {
  const labels = nodes(props.children).flatMap((node) => trackLabels(node));
  return labels.length > 0 ? { kind: 'note', text: labels.join(', ') } : undefined;
}

function namedElement(name: string, record: Record<string, unknown>): VisibleName | undefined {
  switch (name) {
    case 'button':
      return buttonName(record);
    case 'input':
      return inputName(record);
    case 'textarea':
      return textareaName(record);
    case 'th':
      return headerName(record);
    case 'option':
      return optionName(record);
    case 'select':
      return selectName(record);
    case 'output':
    case 'del':
    case 'ins':
      return stampName(record);
    case 'summary':
      return summaryName(record);
    case 'time':
      return emptyName(record, ['dateTime', 'datetime'], (value) => `(${value})`);
    case 'abbr':
      return emptyName(record, ['title'], (value) => `(${value})`);
    case 'dfn':
      return emptyName(record, ['title'], (value) => value);
    case 'data':
      return emptyName(record, ['value'], (value) => value);
    case 'meter':
      return gaugeName(record, 'meter');
    case 'progress':
      return gaugeName(record, 'progress');
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
    case 'canvas':
      return canvasName(record);
    default:
      return namedExtra(name, record);
  }
}

function namedExtra(name: string, record: Record<string, unknown>): VisibleName | undefined {
  switch (name) {
    case 'q':
    case 'blockquote':
      return citedName(record);
    case 'menuitem':
      return commandName(record);
    case 'applet':
      return appletName(record);
    default:
      return undefined;
  }
}

/** The visible name for a control, formula, or caption that would not paint its words. */
export function visibleName(type: unknown, props: unknown): VisibleName | undefined {
  const name = nameOf(type);
  if (name === null || props === null || typeof props !== 'object') {
    return undefined;
  }
  return namedElement(name, props as Record<string, unknown>);
}
