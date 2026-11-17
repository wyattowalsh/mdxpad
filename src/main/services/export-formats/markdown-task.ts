export interface TaskItem {
  readonly checked: boolean;
  readonly body: string;
}

export function splitTaskItem(text: string): TaskItem | null {
  const match = /^\[([ xX])\][ \t]*([\s\S]*)$/.exec(text);
  if (!match) {
    return null;
  }
  return { checked: match[1] !== ' ', body: match[2] ?? '' };
}

export function taskItemHtml(checked: boolean, bodyHtml: string): string {
  const box = checked
    ? '<input type="checkbox" disabled checked />'
    : '<input type="checkbox" disabled />';
  return `${box} ${bodyHtml}`;
}

export function listItemHtml(text: string, renderInline: (value: string) => string): string {
  const task = splitTaskItem(text);
  if (!task) {
    return renderInline(text);
  }
  return taskItemHtml(task.checked, renderInline(task.body));
}

export function taskItemLatex(checked: boolean, body: string): string {
  const box = checked ? '$\\boxtimes$' : '$\\square$';
  return `${box} ${body}`;
}
