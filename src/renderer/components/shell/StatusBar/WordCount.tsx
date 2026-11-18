/**
 * WordCount Component
 *
 * Status bar widget displaying word count with tooltip showing
 * character count details.
 *
 * @module renderer/components/shell/StatusBar/WordCount
 */

import { memo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ui/tooltip';

export interface WordCountProps {
  readonly wordCount: number;
  readonly charCount: number;
}

function WordCountComponent({ wordCount, charCount }: WordCountProps) {
  const formattedWords = wordCount.toLocaleString();
  const formattedChars = charCount.toLocaleString();

  return (
    <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-sm text-muted-foreground whitespace-nowrap cursor-default"
          data-testid="word-count"
        >
          {formattedWords} {wordCount === 1 ? 'word' : 'words'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" data-testid="word-count-tooltip">
        <p>{formattedChars} characters</p>
      </TooltipContent>
    </Tooltip>
    </TooltipProvider>
  );
}

export const WordCount = memo(WordCountComponent);
WordCount.displayName = 'WordCount';
