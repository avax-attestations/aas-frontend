import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateEllipsis(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }

  const ellipsis = '...';
  const truncated = str.slice(0, maxLength - ellipsis.length);
  return truncated + ellipsis;
}

export function sleep(milliseconds: number) {
  return new Promise(function(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

export function timeAgo(timestamp: string): string {
  const date = new Date(Number(timestamp) * 1000)
  const now = new Date();
  const diffMs = now.getTime() - date.getTime(); // Difference in milliseconds
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);

  function pluralize(unit: string, value: number): string {
    return `${value} ${unit}${value > 1 ? 's' : ''} ago`;
  }

  if (diffSecs < 60) {
    return pluralize('second', diffSecs);
  } else if (diffMins < 60) {
    return pluralize('minute', diffMins);
  } else if (diffHours < 24) {
    return pluralize('hour', diffHours);
  } else {
    return pluralize('day', diffDays);
  }
}
