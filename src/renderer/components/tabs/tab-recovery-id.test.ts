import { describe, expect, it, vi } from 'vitest';

import { autosaveDocumentId, recoveryDocumentId } from './tab-recovery-id';

describe('autosaveDocumentId', () => {
  it('uses the open file id for a saved document', () => {
    expect(
      autosaveDocumentId({
        fileId: '11111111-1111-4111-8111-111111111111',
        activeTabId: 'tab-a',
        previousId: '22222222-2222-4222-8222-222222222222',
      })
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('gives an untitled tab its own id after a saved file', () => {
    const first = autosaveDocumentId({
      fileId: null,
      activeTabId: 'tab-a',
      previousId: '11111111-1111-4111-8111-111111111111',
    });
    const again = autosaveDocumentId({
      fileId: null,
      activeTabId: 'tab-a',
      previousId: '11111111-1111-4111-8111-111111111111',
    });
    const other = autosaveDocumentId({
      fileId: null,
      activeTabId: 'tab-b',
      previousId: first,
    });

    expect(first).not.toBe('11111111-1111-4111-8111-111111111111');
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(recoveryDocumentId('tab-a', () => 'should-not-run')).toBe(first);
  });
});

describe('recoveryDocumentId', () => {
  it('creates an id once', () => {
    const createId = vi.fn(() => '33333333-3333-4333-8333-333333333333');
    expect(recoveryDocumentId('fresh-tab', createId)).toBe('33333333-3333-4333-8333-333333333333');
    expect(recoveryDocumentId('fresh-tab', createId)).toBe('33333333-3333-4333-8333-333333333333');
    expect(createId).toHaveBeenCalledOnce();
  });
});
