import { describe, expect, it } from 'vitest';

import { splitTaskItem, taskItemHtml } from './markdown-task';

describe('splitTaskItem', () => {
  it('reads a checked task and leaves a normal item alone', () => {
    expect(splitTaskItem('[x] done')).toEqual({ checked: true, body: 'done' });
    expect(splitTaskItem('[ ] todo')).toEqual({ checked: false, body: 'todo' });
    expect(splitTaskItem('plain')).toBeNull();
  });

  it('renders a disabled checkbox', () => {
    expect(taskItemHtml(true, 'done')).toContain('checked');
    expect(taskItemHtml(false, 'todo')).not.toContain('checked');
  });
});
