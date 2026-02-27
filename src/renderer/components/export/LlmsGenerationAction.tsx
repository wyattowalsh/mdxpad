import { memo, useCallback, useState } from 'react';

import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { selectLlmsResult, useExportStore } from '@renderer/stores/export-store';
import type { LlmsTarget } from '@shared/contracts/export-schemas';

export interface LlmsGenerationActionProps {
  readonly content: string;
  readonly sourcePath?: string | null;
}

function LlmsGenerationActionComponent({
  content,
  sourcePath = null,
}: LlmsGenerationActionProps): React.JSX.Element {
  const llmsResult = useExportStore(selectLlmsResult);
  const llmsError = useExportStore((state) => state.llmsError);
  const isGeneratingLlms = useExportStore((state) => state.isGeneratingLlms);
  const generateLlms = useExportStore((state) => state.generateLlms);

  const [target, setTarget] = useState<LlmsTarget>('llms.txt');
  const [outputPath, setOutputPath] = useState<string>('llms.txt');
  const [overwrite, setOverwrite] = useState<boolean>(false);

  const handleTargetChange = useCallback((nextTarget: LlmsTarget) => {
    setTarget(nextTarget);
    setOutputPath(nextTarget);
  }, []);

  const handleGenerate = useCallback(() => {
    if (outputPath.trim() === '') {
      return;
    }

    void generateLlms({
      action: 'generate',
      target,
      sourcePath,
      content,
      outputPath: outputPath.trim(),
      overwrite,
    });
  }, [content, generateLlms, outputPath, overwrite, sourcePath, target]);

  return (
    <section className="space-y-3" data-testid="llms-generation-action">
      <h3 className="text-sm font-semibold">llms generation</h3>

      <div className="space-y-1">
        <label htmlFor="llms-target" className="text-xs font-medium text-muted-foreground">
          Target
        </label>
        <select
          id="llms-target"
          value={target}
          onChange={(event) => {
            handleTargetChange(event.target.value as LlmsTarget);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
        >
          <option value="llms.txt">llms.txt</option>
          <option value="llms-full.txt">llms-full.txt</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="llms-output-path" className="text-xs font-medium text-muted-foreground">
          Output path
        </label>
        <Input
          id="llms-output-path"
          aria-label="Output path"
          value={outputPath}
          onChange={(event) => {
            setOutputPath(event.target.value);
          }}
        />
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(event) => {
            setOverwrite(event.target.checked);
          }}
        />
        Overwrite existing file
      </label>

      <Button
        type="button"
        onClick={handleGenerate}
        disabled={isGeneratingLlms || outputPath.trim() === '' || content.trim() === ''}
      >
        Generate llms file
      </Button>

      {llmsResult && (
        <p className="text-xs text-muted-foreground">
          Generated {llmsResult.target} at {llmsResult.path} ({llmsResult.bytesWritten} bytes)
        </p>
      )}
      {llmsError && <p className="text-sm text-destructive">{llmsError}</p>}
    </section>
  );
}

export const LlmsGenerationAction = memo(LlmsGenerationActionComponent);
LlmsGenerationAction.displayName = 'LlmsGenerationAction';
