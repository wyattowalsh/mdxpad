import { AlignmentType } from 'docx';

import type { MarkdownListItem } from './markdown-list';

export interface OrderedNumberingPlan {
  readonly reference: string;
  readonly delimiter: '.' | ')';
  readonly starts: number[];
}

interface NumberedFrame {
  readonly level: number;
  readonly item: MarkdownListItem;
  readonly reference?: string;
}

export function orderedDelimiter(item: MarkdownListItem): '.' | ')' | null {
  if (!item.ordered) {
    return null;
  }
  return item.delimiter === ')' ? ')' : '.';
}

function sameOrderedList(frame: NumberedFrame, item: MarkdownListItem): boolean {
  const delimiter = orderedDelimiter(item);
  return (
    delimiter !== null &&
    frame.reference !== undefined &&
    orderedDelimiter(frame.item) === delimiter
  );
}

/** The numbering definition for this item, shared by every later item in the list. */
export function orderedListReference(
  stack: readonly NumberedFrame[],
  plans: OrderedNumberingPlan[],
  item: MarkdownListItem
): string | undefined {
  const delimiter = orderedDelimiter(item);
  if (delimiter === null) {
    return undefined;
  }
  const continued = continuedReference(stack, item);
  if (continued) {
    return continued;
  }
  const parent = parentReference(stack, item);
  if (parent) {
    noteLevelStart(plans, parent, item.level, item.start);
    return parent;
  }
  return createPlan(plans, delimiter, item.level, item.start);
}

export function nextOrderedReference(
  plans: OrderedNumberingPlan[],
  previous: MarkdownListItem | null,
  previousReference: string | undefined,
  item: MarkdownListItem
): string | undefined {
  const delimiter = orderedDelimiter(item);
  if (
    previous &&
    previousReference &&
    delimiter &&
    previous.level === item.level &&
    orderedDelimiter(previous) === delimiter
  ) {
    return previousReference;
  }
  return orderedListReference([], plans, item);
}

function continuedReference(
  stack: readonly NumberedFrame[],
  item: MarkdownListItem
): string | undefined {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const frame = stack[index];
    if (!frame || frame.level < item.level) {
      return undefined;
    }
    if (frame.level === item.level && sameOrderedList(frame, item)) {
      return frame.reference;
    }
  }
  return undefined;
}

function parentReference(
  stack: readonly NumberedFrame[],
  item: MarkdownListItem
): string | undefined {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const frame = stack[index];
    if (frame && frame.level < item.level && sameOrderedList(frame, item)) {
      return frame.reference;
    }
  }
  return undefined;
}

function noteLevelStart(
  plans: readonly OrderedNumberingPlan[],
  reference: string,
  level: number,
  start: number
): void {
  const plan = plans.find((item) => item.reference === reference);
  if (!plan || plan.starts[level] !== undefined) {
    return;
  }
  plan.starts[level] = start;
}

function createPlan(
  plans: OrderedNumberingPlan[],
  delimiter: '.' | ')',
  level: number,
  start: number
): string {
  const reference = `mdx-ol-${plans.length + 1}`;
  const starts: number[] = [];
  starts[level] = start;
  plans.push({ reference, delimiter, starts });
  return reference;
}

function levelText(level: number, delimiter: '.' | ')'): string {
  return `%${level + 1}${delimiter}`;
}

function numberingLevels(delimiter: '.' | ')', starts: readonly number[]) {
  return [0, 1, 2, 3, 4, 5].map((level) => ({
    level,
    format: 'decimal' as const,
    text: levelText(level, delimiter),
    alignment: AlignmentType.START,
    start: starts[level] ?? 1,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
}

/** Word list definitions, including one list for each ordered list in the document. */
export function docxNumberingConfig(plans: readonly OrderedNumberingPlan[]) {
  return [
    { reference: 'default-numbering', levels: numberingLevels('.', [1]) },
    ...plans.map((plan) => ({
      reference: plan.reference,
      levels: numberingLevels(plan.delimiter, plan.starts),
    })),
  ];
}
