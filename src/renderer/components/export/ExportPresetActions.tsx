import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@ui/button';
import {
  selectExportPresets,
  selectIsLoadingPresets,
  useExportStore,
} from '@renderer/stores/export-store';
import { announceFinishedExport } from '@renderer/stores/announce-export';
import type { FileExportError } from '@shared/contracts/file-schemas';
import type { ExportJob, ExportPreset } from '@shared/types/export-model';

function createFallbackUuid(): string {
  return '00000000-0000-4000-8000-000000000000';
}

function createExportJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return createFallbackUuid();
}

function exportErrorMessage(error: FileExportError): string | null {
  switch (error.code) {
    case 'CANCELLED':
      return null;
    case 'UNSUPPORTED_FORMAT':
    case 'WRITE_FAILED':
    case 'UNKNOWN':
      return error.message;
    default: {
      const unreachable: never = error;
      return unreachable;
    }
  }
}

function completedJob(
  preset: ExportPreset,
  sourcePath: string | null,
  targetPath: string,
  warnings: string[]
): ExportJob {
  return {
    id: createExportJobId(),
    preset,
    format: preset.format,
    sourcePath,
    targetPath,
    generationMode: 'native',
    status: 'completed',
    warnings,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

export interface ExportPresetActionsProps {
  readonly content: string;
  readonly sourcePath?: string | null;
}

function ExportPresetActionsComponent({
  content,
  sourcePath = null,
}: ExportPresetActionsProps): React.JSX.Element {
  const presets = useExportStore(selectExportPresets);
  const isLoadingPresets = useExportStore(selectIsLoadingPresets);
  const presetsError = useExportStore((state) => state.presetsError);
  const loadPresets = useExportStore((state) => state.loadPresets);
  const runJobLifecycle = useExportStore((state) => state.runJobLifecycle);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const documentKey = sourcePath ?? '';
  const documentKeyRef = useRef(documentKey);
  documentKeyRef.current = documentKey;

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    setIsExporting(false);
    setExportError(null);
  }, [documentKey]);

  useEffect(() => {
    if (presets.length === 0) {
      setSelectedPresetId('');
      return;
    }

    if (selectedPresetId === '' || !presets.some((preset) => preset.id === selectedPresetId)) {
      const firstPreset = presets[0];
      if (firstPreset) {
        setSelectedPresetId(firstPreset.id);
      }
    }
  }, [presets, selectedPresetId]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  const handleExport = useCallback(() => {
    if (!selectedPreset || isExporting) {
      return;
    }

    const key = documentKey;
    const preset = selectedPreset;
    setExportError(null);
    setIsExporting(true);
    void window.mdxpad
      .exportFile(content, { sourcePath, format: preset.format })
      .then((result) => {
        if (documentKeyRef.current !== key) {
          return;
        }
        if (!result.ok) {
          setExportError(exportErrorMessage(result.error));
          return;
        }
        const job = completedJob(preset, sourcePath, result.value.path, result.value.warnings);
        announceFinishedExport(job);
        return runJobLifecycle({ action: 'create', job });
      })
      .catch((error: unknown) => {
        if (documentKeyRef.current !== key) {
          return;
        }
        setExportError(error instanceof Error ? error.message : 'Export failed');
      })
      .finally(() => {
        if (documentKeyRef.current === key) {
          setIsExporting(false);
        }
      });
  }, [content, documentKey, isExporting, runJobLifecycle, selectedPreset, sourcePath]);

  return (
    <section className="space-y-3" data-testid="export-preset-actions">
      <h3 className="text-sm font-semibold">Export document</h3>
      <p className="text-xs text-muted-foreground">
        Writes the open document in the selected format. The save dialog chooses the file.
      </p>

      {isLoadingPresets && <p className="text-sm text-muted-foreground">Loading presets…</p>}
      {presetsError && <p className="text-sm text-destructive">{presetsError}</p>}
      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      <div className="space-y-1">
        <label htmlFor="export-preset-select" className="text-xs font-medium text-muted-foreground">
          Preset
        </label>
        <select
          id="export-preset-select"
          value={selectedPresetId}
          onChange={(event) => {
            setSelectedPresetId(event.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          {presets.length === 0 && <option value="">No presets</option>}
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="button"
        onClick={handleExport}
        disabled={selectedPreset === null || isExporting}
      >
        {isExporting ? 'Exporting…' : 'Export document'}
      </Button>
    </section>
  );
}

export const ExportPresetActions = memo(ExportPresetActionsComponent);
ExportPresetActions.displayName = 'ExportPresetActions';
