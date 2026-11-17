export interface ExportOptions {
  content: string;
  title?: string;
  author?: string;
  outputPath: string;
  sourcePath?: string | null | undefined;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  ok: boolean;
  outputPath?: string;
  error?: string;
  warnings: string[];
}

export interface Exporter {
  export(options: ExportOptions): Promise<ExportResult>;
  readonly format: string;
  readonly label: string;
  readonly extension: string;
  readonly mimeType: string;
}
