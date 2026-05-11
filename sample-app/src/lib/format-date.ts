/**
 * Formats a Date object as a human-readable string.
 * @param date - Date to format
 * @returns Formatted string like "Apr 13, 2026 10:30 AM"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
