/**
 * ReadingTime Component
 *
 * Status bar widget showing estimated reading time.
 * Based on 200 WPM default.
 *
 * @module renderer/components/shell/StatusBar/ReadingTime
 */

import { memo } from 'react';

export interface ReadingTimeProps {
  readonly minutes: number;
  readonly seconds: number;
}

function ReadingTimeComponent({ minutes, seconds }: ReadingTimeProps) {
  let display: string;

  if (minutes === 0 && seconds === 0) {
    display = '0 min read';
  } else if (minutes === 0) {
    display = '< 1 min read';
  } else {
    display = `${minutes} min read`;
  }

  return (
    <span className="text-sm text-muted-foreground whitespace-nowrap" data-testid="reading-time">
      {display}
    </span>
  );
}

export const ReadingTime = memo(ReadingTimeComponent);
ReadingTime.displayName = 'ReadingTime';
