/**
 * Tell the system when an export job finishes.
 */

import type { ExportJob } from '@shared/types/export-model';

interface NotificationShow {
  show(request: {
    title: string;
    body: string;
    urgency?: 'low' | 'normal' | 'critical';
  }): Promise<unknown>;
}

function notificationApi(): NotificationShow | null {
  const bridge = (window as { mdxpad?: { notifications?: NotificationShow } }).mdxpad;
  return bridge?.notifications ?? null;
}

/** Post a system notification for a completed or failed export. */
export function announceFinishedExport(job: ExportJob): void {
  const notifications = notificationApi();
  if (!notifications) {
    return;
  }
  if (job.status !== 'completed' && job.status !== 'failed') {
    return;
  }
  const title = job.status === 'completed' ? 'Export finished' : 'Export failed';
  const detail = job.status === 'failed' && job.errorMessage ? job.errorMessage : job.targetPath;
  void notifications
    .show({
      title,
      body: `${job.format}: ${detail}`,
      urgency: job.status === 'failed' ? 'critical' : 'low',
    })
    .catch(() => undefined);
}
