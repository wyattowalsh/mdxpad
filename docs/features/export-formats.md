# Export Formats

MDXPad supports exporting documents to multiple formats through a modular exporter system.

## Supported Formats

| Format | Exporter | File | Extension |
|--------|----------|------|-----------|
| HTML | Built-in | `export-service.ts` | `.html` |
| Markdown | Built-in | `export-service.ts` | `.md` |
| MDX | Built-in | `export-service.ts` | `.mdx` |
| PDF | `PdfExporter` | `pdf-exporter.ts` | `.pdf` |
| Word (DOCX) | `DocxExporter` | `docx-exporter.ts` | `.docx` |
| EPUB | `EpubExporter` | `epub-exporter.ts` | `.epub` |
| LaTeX | `LatexExporter` | `latex-exporter.ts` | `.tex` |
| Pandoc (Custom) | `PandocRawExporter` | `pandoc-bridge.ts` | varies |

## Architecture

```
src/main/services/
├── export-service.ts              # Core export logic (HTML, MD, MDX)
├── export-orchestrator.ts         # Job lifecycle management
├── export-document-builders.ts    # Document construction helpers
├── export-formats/
│   ├── index.ts                   # Exporter registry
│   ├── types.ts                   # Exporter interface
│   ├── pdf-exporter.ts            # PDF via Electron printToPDF
│   ├── docx-exporter.ts           # DOCX via docx library
│   ├── epub-exporter.ts           # EPUB via epub-gen-memory
│   ├── latex-exporter.ts          # LaTeX text conversion
│   ├── pandoc-bridge.ts           # Pandoc CLI integration
│   └── pandoc-detector.ts         # Pandoc availability detection
└── cli-service.ts                 # CLI orchestration for exports
```

## Exporter Interface

All format exporters implement the `Exporter` interface:

```typescript
interface Exporter {
  readonly format: string;
  readonly label: string;
  readonly extensions: string[];
  export(content: string, options: ExportOptions): Promise<ExportResult>;
}
```

## PDF Export

Uses Electron's `printToPDF` API. The content is rendered as HTML first, then printed to PDF.

## DOCX Export

Uses the `docx` npm package to generate Word documents. Supports:
- Headings (H1-H6)
- Paragraphs with inline formatting
- Code blocks
- Lists

## EPUB Export

Uses `epub-gen-memory` for e-book generation. Supports:
- Title and author metadata from frontmatter
- Chapter splitting
- Basic formatting

## LaTeX Export

Converts MDX content to LaTeX markup with:
- Document class and packages
- Heading commands (`\section`, `\subsection`, etc.)
- Code listings
- Basic inline formatting

## Pandoc Bridge

Integrates with Pandoc (when installed) for additional format support.

### Detection

`pandoc-detector.ts` checks for Pandoc availability at runtime:

```typescript
import { detectPandoc } from './pandoc-detector';

const result = await detectPandoc();
// { available: boolean, version?: string, path?: string }
```

### Custom Formats

The `PandocRawExporter` passes content through Pandoc CLI with user-specified output format flags.

## Export Orchestration

The `ExportOrchestrator` (`export-orchestrator.ts`) manages export jobs with:
- Job lifecycle: create, get, list, cancel, update status
- Preset management: create, get, list, update, delete export presets
- Progress tracking

## CLI Orchestration

The `CLIService` (`cli-service.ts`) and `CLIEngine` (`cli-engine.ts`) provide command-line export capabilities:

```typescript
window.mdxpad.export.cliInvoke({ command: 'mdxpad-export', args: [...] })
```

## llms.txt Generation

The `LlmsGenerator` (`llms-generator.ts`) produces `llms.txt` and `llms-full.txt` files for AI consumption:

```typescript
window.mdxpad.export.llmsGenerate({ workspacePath, outputDir })
```

## IPC API

Export features are exposed via `window.mdxpad.export`:

- `jobLifecycle` -- create/get/list/cancel/update-status
- `presetCrud` -- create/get/list/update/delete
- `cliInvoke` -- Run export command
- `llmsGenerate` -- Generate llms.txt files

IPC schemas are in `src/shared/contracts/export-schemas.ts` and `src/shared/contracts/export-format-schemas.ts`.

## Renderer Components

- `ExportPanel` (`src/renderer/components/export/ExportPanel.tsx`) -- Main export UI
- `ExportJobList` -- Active/completed job listing
- `ExportPresetActions` -- Preset management
- `ExportCliInvocation` -- CLI command builder
- `LlmsGenerationAction` -- llms.txt generation trigger
- `useExportStore` (`src/renderer/stores/export-store.ts`) -- Export state management
