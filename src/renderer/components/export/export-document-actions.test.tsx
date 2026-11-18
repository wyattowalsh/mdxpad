import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExportStore } from '@renderer/stores/export-store';

import { ExportPresetActions } from './ExportPresetActions';
import { LlmsGenerationAction } from './LlmsGenerationAction';

const PRESET = {
  id: '10000000-0000-4000-8000-000000000004',
  name: 'PDF',
  format: 'pdf' as const,
  options: {},
};

describe('export actions stay on the document that started them', () => {
  beforeEach(() => {
    useExportStore.getState().reset();
  });

  it('hides an export error after another file is opened', async () => {
    let finishExport: (value: {
      ok: false;
      error: { code: 'WRITE_FAILED'; message: string };
    }) => void = () => undefined;
    const presetCrud = vi.fn().mockResolvedValue({ ok: true, presets: [PRESET] });
    Object.assign(window, {
      mdxpad: {
        exportFile: () =>
          new Promise((resolve) => {
            finishExport = resolve;
          }),
        export: {
          presetCrud,
          jobLifecycle: vi.fn().mockResolvedValue({ ok: true, jobs: [] }),
          cliInvoke: vi.fn(),
          llmsGenerate: vi.fn(),
        },
      },
    });

    const view = render(<ExportPresetActions content="# A" sourcePath="/a.md" />);
    await screen.findByRole('option', { name: 'PDF' });
    fireEvent.click(screen.getByRole('button', { name: 'Export document' }));
    expect(screen.getByRole('button', { name: /Exporting/ })).toBeTruthy();

    view.rerender(<ExportPresetActions content="# B" sourcePath="/b.md" />);
    await act(async () => {
      finishExport({
        ok: false,
        error: { code: 'WRITE_FAILED', message: 'disk full' },
      });
    });

    expect(screen.queryByText('disk full')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export document' })).toBeTruthy();
  });

  it('hides an llms result after another file is opened', async () => {
    let finishLlms: (value: {
      ok: true;
      target: 'llms.txt';
      path: string;
      bytesWritten: number;
    }) => void = () => undefined;
    Object.assign(window, {
      mdxpad: {
        export: {
          presetCrud: vi.fn().mockResolvedValue({ ok: true, presets: [] }),
          jobLifecycle: vi.fn().mockResolvedValue({ ok: true, jobs: [] }),
          cliInvoke: vi.fn(),
          llmsGenerate: () =>
            new Promise((resolve) => {
              finishLlms = resolve;
            }),
        },
      },
    });

    const view = render(<LlmsGenerationAction content="# A" sourcePath="/a.md" />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate llms file' }));
    expect(
      screen.getByRole('button', { name: 'Generate llms file' }).hasAttribute('disabled')
    ).toBe(true);

    view.rerender(<LlmsGenerationAction content="# B" sourcePath="/b.md" />);
    await act(async () => {
      finishLlms({
        ok: true,
        target: 'llms.txt',
        path: '/tmp/llms.txt',
        bytesWritten: 12,
      });
    });

    expect(screen.queryByText(/Generated llms.txt/)).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Generate llms file' }).hasAttribute('disabled')
    ).toBe(false);
  });
});
