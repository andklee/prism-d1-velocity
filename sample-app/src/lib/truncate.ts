/**
 * Truncates a string to a specified length, adding '...' if truncated
 *
 * @param text - The input string to truncate
 * @param maxLength - The maximum length of the output string (including ellipsis)
 * @returns The truncated string with '...' appended if it exceeds maxLength
 *
 * @example
 * truncate('Hello World', 8) // 'Hello...'
 * truncate('Short', 10) // 'Short'
 * truncate('Hello World', 11) // 'Hello World'
 */
export function truncate(text: string, maxLength: number): string {
  if (maxLength < 3) {
    throw new Error('maxLength must be at least 3 to accommodate ellipsis');
  }

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + '...';
}
