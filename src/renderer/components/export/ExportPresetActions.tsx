import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@ui/button';
import { Input } from '@ui/input';
import {
  selectExportPresets,
  selectIsLoadingPresets,
  useExportStore,
} from '@renderer/stores/export-store';
import type { ExportPreset } from '@shared/types/export-model';

function createFallbackUuid(): string {
  return '00000000-0000-4000-8000-000000000000';
}

function createExportJobId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return createFallbackUuid();
}

function getDefaultTargetPath(preset: ExportPreset): string {
  return `./export.${preset.format}`;
}

export interface ExportPresetActionsProps {
  readonly sourcePath?: string | null;
}

function ExportPresetActionsComponent({
  sourcePath = null,
}: ExportPresetActionsProps): React.JSX.Element {
  const presets = useExportStore(selectExportPresets);
  const isLoadingPresets = useExportStore(selectIsLoadingPresets);
  const presetsError = useExportStore((state) => state.presetsError);
  const loadPresets = useExportStore((state) => state.loadPresets);
  const runJobLifecycle = useExportStore((state) => state.runJobLifecycle);

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [targetPath, setTargetPath] = useState<string>('');

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  useEffect(() => {
    if (presets.length === 0) {
      setSelectedPresetId('');
      return;
    }

    if (selectedPresetId === '' || !presets.some((preset) => preset.id === selectedPresetId)) {
      const firstPreset = presets[0];
      if (firstPreset) {
        setSelectedPresetId(firstPreset.id);
        setTargetPath((currentPath) =>
          currentPath === '' ? getDefaultTargetPath(firstPreset) : currentPath
        );
      }
    }
  }, [presets, selectedPresetId]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  const handleQueueJob = useCallback(() => {
    if (!selectedPreset || targetPath.trim() === '') {
      return;
    }

    void runJobLifecycle({
      action: 'create',
      job: {
        id: createExportJobId(),
        preset: selectedPreset,
        format: selectedPreset.format,
        sourcePath,
        targetPath: targetPath.trim(),
        generationMode: 'native',
        status: 'queued',
        warnings: [],
        createdAt: new Date().toISOString(),
      },
    });
  }, [runJobLifecycle, selectedPreset, sourcePath, targetPath]);

  return (
    <section className="space-y-3" data-testid="export-preset-actions">
      <h3 className="text-sm font-semibold">Preset actions</h3>

      {isLoadingPresets && <p className="text-sm text-muted-foreground">Loading presets…</p>}
      {presetsError && <p className="text-sm text-destructive">{presetsError}</p>}

      <div className="space-y-1">
        <label htmlFor="export-preset-select" className="text-xs font-medium text-muted-foreground">
          Preset
        </label>
        <select
          id="export-preset-select"
          value={selectedPresetId}
          onChange={(event) => {
            setSelectedPresetId(event.target.value);
            const nextPreset = presets.find((preset) => preset.id === event.target.value);
            if (nextPreset) {
              setTargetPath(getDefaultTargetPath(nextPreset));
            }
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

      <div className="space-y-1">
        <label htmlFor="export-target-path" className="text-xs font-medium text-muted-foreground">
          Target path
        </label>
        <Input
          id="export-target-path"
          aria-label="Target path"
          value={targetPath}
          onChange={(event) => {
            setTargetPath(event.target.value);
          }}
        />
      </div>

      <Button
        type="button"
        onClick={handleQueueJob}
        disabled={selectedPreset === null || targetPath.trim() === ''}
      >
        Queue export job
      </Button>
    </section>
  );
}

export const ExportPresetActions = memo(ExportPresetActionsComponent);
ExportPresetActions.displayName = 'ExportPresetActions';
