import { memo } from 'react';

import { ExportCliInvocation } from './ExportCliInvocation';
import { ExportJobList } from './ExportJobList';
import { ExportPresetActions } from './ExportPresetActions';
import { LlmsGenerationAction } from './LlmsGenerationAction';
import { isFeatureEnabled } from '@renderer/stores/feature-flags-store';

export interface ExportPanelProps {
  readonly content: string;
  readonly sourcePath?: string | null;
  readonly className?: string;
}

function ExportPanelComponent({
  content,
  sourcePath,
  className,
}: ExportPanelProps): React.JSX.Element | null {
  if (!isFeatureEnabled('export')) {
    return null;
  }

  return (
    <div className={className} data-testid="export-panel">
      <div className="grid gap-4 md:grid-cols-2">
        <ExportPresetActions {...(sourcePath !== undefined ? { sourcePath } : {})} />
        <ExportCliInvocation />
        <LlmsGenerationAction
          content={content}
          {...(sourcePath !== undefined ? { sourcePath } : {})}
        />
        <ExportJobList />
      </div>
    </div>
  );
}

export const ExportPanel = memo(ExportPanelComponent);
ExportPanel.displayName = 'ExportPanel';
