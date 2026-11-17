import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExportJob } from '@shared/types/export-model';

import { announceFinishedExport } from './announce-export';

function job(status: ExportJob['status'], errorMessage?: string): ExportJob {
  return {
    status,
    format: 'pdf',
    targetPath: '/tmp/note.pdf',
    ...(errorMessage !== undefined && { errorMessage }),
  } as ExportJob;
}

describe('announceFinishedExport', () => {
  afterEach(() => {
    (window as { mdxpad?: unknown }).mdxpad = undefined;
  });

  it('posts a finished export to the system notification API', async () => {
    const show = vi.fn().mockResolvedValue({ id: '1', clicked: false });
    (window as { mdxpad?: unknown }).mdxpad = { notifications: { show } };

    announceFinishedExport(job('completed'));
    await Promise.resolve();

    expect(show).toHaveBeenCalledWith({
      title: 'Export finished',
      body: 'pdf: /tmp/note.pdf',
      urgency: 'low',
    });
  });

  it('stays quiet for a running job and when notifications are absent', () => {
    announceFinishedExport(job('running'));
    announceFinishedExport(job('failed', 'disk full'));
  });
});
