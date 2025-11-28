/**
 * Shared formatting utilities for the application.
 */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
] as const;

/**
 * Format a Date object to a human-readable string (e.g., "Jan 15, 2024").
 * Uses UTC to avoid timezone issues.
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Format a YYYY-MM-DD date string to a human-readable string.
 */
export function formatDateString(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

/**
 * Extract the domain from a URL, removing the "www." prefix.
 * Returns empty string if URL is invalid.
 */
export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "");
  } catch {
    return "";
  }
}

/**
 * Common HTML entity mappings for decoding.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&rsquo;": "'",
  "&lsquo;": "'",
  "&rdquo;": '"',
  "&ldquo;": '"',
  "&mdash;": "—",
  "&ndash;": "–",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&#038;": "&",
  "&eacute;": "é",
  "&hellip;": "…",
};

/**
 * Decode common HTML entities in a string.
 * Also strips HTML tags.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  let result = text;
  for (const [entity, replacement] of Object.entries(HTML_ENTITIES)) {
    result = result.replace(new RegExp(entity, "g"), replacement);
  }

  // Strip HTML tags
  return result.replace(/<[^>]+>/g, "");
}

/**
 * Format a category string for display (capitalize, replace hyphens).
 * e.g., "food-drink" -> "Food & Drink"
 */
export function formatCategoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace("-", " & ");
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
