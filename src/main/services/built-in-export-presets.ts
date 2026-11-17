/**
 * Presets the export panel can select before the user creates their own.
 */

import type { ExportPreset } from '@shared/types/export-model';

export const BUILT_IN_EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'HTML',
    format: 'html',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Markdown',
    format: 'markdown',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'MDX',
    format: 'mdx',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'PDF',
    format: 'pdf',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    name: 'Word',
    format: 'docx',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    name: 'EPUB',
    format: 'epub',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    name: 'LaTeX',
    format: 'latex',
    options: {},
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    name: 'Pandoc',
    format: 'pandoc',
    options: {},
  },
];
