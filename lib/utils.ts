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
