'use client';

import { forwardRef, type HTMLAttributes, useState, useEffect } from 'react';
import { cn } from './utils';

export interface RelativeTimeProps extends HTMLAttributes<HTMLTimeElement> {
  /** The date to display relative to now */
  date: Date;
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const then = date.getTime();
  const diffMs = now - then;

  // Future dates
  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

/**
 * RelativeTime — human-readable relative timestamps.
 *
 * Auto-updates every 60 seconds. Renders a <time> element with
 * the full ISO datetime in the datetime attribute for accessibility.
 */
const RelativeTime = forwardRef<HTMLTimeElement, RelativeTimeProps>(
  ({ className, date, ...props }, ref) => {
    const [text, setText] = useState(() => formatRelative(date));

    useEffect(() => {
      // Update immediately in case date prop changed
      setText(formatRelative(date));

      const interval = setInterval(() => {
        setText(formatRelative(date));
      }, 60_000);

      return () => clearInterval(interval);
    }, [date]);

    return (
      <time
        ref={ref}
        dateTime={date.toISOString()}
        title={date.toLocaleString()}
        className={cn('text-xs text-text-tertiary tabular-nums', className)}
        {...props}
      >
        {text}
      </time>
    );
  }
);

RelativeTime.displayName = 'RelativeTime';

export { RelativeTime };
