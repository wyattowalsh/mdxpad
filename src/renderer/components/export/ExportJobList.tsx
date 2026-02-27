import { memo, useCallback, useEffect } from 'react';

import { Button } from '@ui/button';
import {
  selectExportJobs,
  selectIsLoadingJobs,
  useExportStore,
} from '@renderer/stores/export-store';
import type { ExportJobStatus } from '@shared/types/export-model';

const CANCELABLE_STATUSES: ReadonlySet<ExportJobStatus> = new Set(['queued', 'running']);

function ExportJobListComponent(): React.JSX.Element {
  const jobs = useExportStore(selectExportJobs);
  const isLoadingJobs = useExportStore(selectIsLoadingJobs);
  const jobsError = useExportStore((state) => state.jobsError);
  const loadJobs = useExportStore((state) => state.loadJobs);
  const runJobLifecycle = useExportStore((state) => state.runJobLifecycle);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleRefresh = useCallback(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleCancel = useCallback(
    (jobId: string) => {
      void runJobLifecycle({ action: 'cancel', jobId });
    },
    [runJobLifecycle]
  );

  return (
    <section className="space-y-3" data-testid="export-job-list">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Export jobs</h3>
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh}>
          Refresh
        </Button>
      </div>

      {isLoadingJobs && <p className="text-sm text-muted-foreground">Loading export jobs…</p>}
      {jobsError && <p className="text-sm text-destructive">{jobsError}</p>}

      {!isLoadingJobs && jobs.length === 0 && (
        <p className="text-sm text-muted-foreground">No export jobs queued yet.</p>
      )}

      {jobs.length > 0 && (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{job.preset.name}</p>
                  <p className="text-xs text-muted-foreground">{job.targetPath}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {job.status}
                  </p>
                </div>

                {CANCELABLE_STATUSES.has(job.status) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      handleCancel(job.id);
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export const ExportJobList = memo(ExportJobListComponent);
ExportJobList.displayName = 'ExportJobList';
