/**
 * Converts a string to a URL-safe slug
 *
 * @param text - The input string to convert
 * @returns A URL-safe slug with lowercase letters, numbers, and hyphens
 *
 * @example
 * slugify('Hello World!') // 'hello-world'
 * slugify('Café & Bar') // 'cafe-bar'
 * slugify('München 2024') // 'munchen-2024'
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD') // Decompose unicode characters
    .replace(/[̀-ͯ]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Strip special characters (keep spaces and hyphens)
    .replace(/[\s]+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}
