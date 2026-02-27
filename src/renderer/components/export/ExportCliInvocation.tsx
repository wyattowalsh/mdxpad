import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@ui/button';
import { Input } from '@ui/input';
import {
  selectCliOutput,
  selectCliRunStatus,
  selectExportJobs,
  useExportStore,
} from '@renderer/stores/export-store';

function parseCliArgs(rawArgs: string): string[] {
  return rawArgs
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function ExportCliInvocationComponent(): React.JSX.Element {
  const jobs = useExportStore(selectExportJobs);
  const cliStatus = useExportStore(selectCliRunStatus);
  const cliOutput = useExportStore(selectCliOutput);
  const isRunningCli = useExportStore((state) => state.isRunningCli);
  const cliError = useExportStore((state) => state.cliError);
  const invokeCli = useExportStore((state) => state.invokeCli);

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [command, setCommand] = useState<string>('mdxpad-export');
  const [argsInput, setArgsInput] = useState<string>('');

  useEffect(() => {
    if (jobs.length === 0) {
      setSelectedJobId('');
      return;
    }

    if (selectedJobId === '' || !jobs.some((job) => job.id === selectedJobId)) {
      const firstJob = jobs[0];
      if (firstJob) {
        setSelectedJobId(firstJob.id);
      }
    }
  }, [jobs, selectedJobId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const handleRunCli = useCallback(() => {
    if (!selectedJob || command.trim() === '') {
      return;
    }

    void invokeCli({
      job: selectedJob,
      command: command.trim(),
      args: parseCliArgs(argsInput),
    });
  }, [argsInput, command, invokeCli, selectedJob]);

  return (
    <section className="space-y-3" data-testid="export-cli-invocation">
      <h3 className="text-sm font-semibold">CLI invocation</h3>

      {jobs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Create an export job before running the CLI.
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="export-cli-job" className="text-xs font-medium text-muted-foreground">
          Job
        </label>
        <select
          id="export-cli-job"
          value={selectedJobId}
          onChange={(event) => {
            setSelectedJobId(event.target.value);
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          disabled={jobs.length === 0}
        >
          {jobs.length === 0 && <option value="">No jobs available</option>}
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.preset.name} • {job.status}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="export-cli-command" className="text-xs font-medium text-muted-foreground">
          CLI command
        </label>
        <Input
          id="export-cli-command"
          aria-label="CLI command"
          value={command}
          onChange={(event) => {
            setCommand(event.target.value);
          }}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="export-cli-args" className="text-xs font-medium text-muted-foreground">
          CLI args
        </label>
        <Input
          id="export-cli-args"
          aria-label="CLI args"
          value={argsInput}
          onChange={(event) => {
            setArgsInput(event.target.value);
          }}
          placeholder="--format pdf"
        />
      </div>

      <Button
        type="button"
        onClick={handleRunCli}
        disabled={selectedJob === null || isRunningCli || command.trim() === ''}
      >
        Run export CLI
      </Button>

      <p className="text-xs text-muted-foreground">Status: {cliStatus}</p>
      {cliError && <p className="text-sm text-destructive">{cliError}</p>}
      {cliOutput && (
        <p className="text-xs text-muted-foreground">
          Exit code {cliOutput.exitCode} in {cliOutput.durationMs}ms
        </p>
      )}
    </section>
  );
}

export const ExportCliInvocation = memo(ExportCliInvocationComponent);
ExportCliInvocation.displayName = 'ExportCliInvocation';

export { parseCliArgs };
