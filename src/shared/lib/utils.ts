/**
 * Utility functions for the mdxpad application.
 * Provides helpers for className merging, debouncing, throttling, and ID generation.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes safely.
 * Combines clsx for conditional classes with tailwind-merge for deduplication.
 * @param inputs - Class values to merge
 * @returns Merged className string
 * @example
 * cn('px-2 py-1', 'px-4') // => 'py-1 px-4'
 * cn('px-2', false && 'py-1', 'px-4') // => 'px-4'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Debounce a function call.
 * Delays execution until after the specified time has elapsed since the last call.
 * @param fn - Function to debounce
 * @param ms - Milliseconds to wait
 * @returns Debounced function
 * @example
 * const search = debounce((query: string) => api.search(query), 300);
 * search('hello'); // Only executes after 300ms of no calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function debounced(...args: Parameters<T>): void {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, ms);
  };
}

/**
 * Throttle a function call.
 * Ensures function is called at most once per specified time period.
 * @param fn - Function to throttle
 * @param ms - Milliseconds between allowed calls
 * @returns Throttled function
 * @example
 * const onScroll = throttle(() => updateScrollPosition(), 100);
 * window.addEventListener('scroll', onScroll);
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= ms) {
      lastCallTime = now;
      fn(...args);
    } else {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        fn(...args);
      }, ms - timeSinceLastCall);
    }
  };
}

/**
 * Generate a short unique ID.
 * Uses timestamp and random characters for collision resistance.
 * @returns Unique string identifier
 * @example
 * const id = uid(); // => 'k2x8p9w1'
 */
export function uid(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}${randomPart}`;
}
