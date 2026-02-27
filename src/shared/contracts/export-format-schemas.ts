import { z } from 'zod';

export const PdfExportOptionsSchema = z.object({
  margins: z
    .object({
      top: z.number().min(0),
      right: z.number().min(0),
      bottom: z.number().min(0),
      left: z.number().min(0),
    })
    .optional(),
  landscape: z.boolean().optional(),
  pageSize: z.enum(['A4', 'Letter', 'Legal']).optional(),
});
export type PdfExportOptions = z.infer<typeof PdfExportOptionsSchema>;

export const DocxExportOptionsSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  includeTableOfContents: z.boolean().optional(),
  headingBaseLevel: z.number().int().min(1).max(6).optional(),
});
export type DocxExportOptions = z.infer<typeof DocxExportOptionsSchema>;

export const EpubExportOptionsSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).optional(),
  language: z.string().min(2).optional(),
  coverUrl: z.string().url().optional(),
});
export type EpubExportOptions = z.infer<typeof EpubExportOptionsSchema>;

export const LatexExportOptionsSchema = z.object({
  documentClass: z.enum(['article', 'report', 'book', 'letter']).optional(),
  fontSize: z.enum(['10pt', '11pt', '12pt']).optional(),
  packages: z.array(z.string().min(1)).optional(),
});
export type LatexExportOptions = z.infer<typeof LatexExportOptionsSchema>;

export const PandocExportOptionsSchema = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1),
  extraArgs: z.array(z.string()).optional(),
  timeoutMs: z.number().int().positive().max(120_000).optional(),
});
export type PandocExportOptions = z.infer<typeof PandocExportOptionsSchema>;
