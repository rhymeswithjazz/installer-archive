import type { Category } from "@/types";

/**
 * Color classes for category badges.
 * Used in recommendation cards and admin table.
 */
export const CATEGORY_COLORS: Record<Category | string, string> = {
  apps: "bg-green-500/15 text-green-500",
  shows: "bg-pink-500/15 text-pink-500",
  movies: "bg-amber-500/15 text-amber-500",
  games: "bg-violet-500/15 text-violet-500",
  books: "bg-cyan-500/15 text-cyan-500",
  videos: "bg-red-500/15 text-red-500",
  music: "bg-teal-500/15 text-teal-500",
  podcasts: "bg-orange-500/15 text-orange-500",
  articles: "bg-slate-500/15 text-slate-400",
  gadgets: "bg-lime-500/15 text-lime-500",
  "food-drink": "bg-pink-400/15 text-pink-400",
  blog: "bg-indigo-500/15 text-indigo-500",
  website: "bg-sky-500/15 text-sky-500",
};

/** Default category color when category is not found */
export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS.articles;

/**
 * UI timing constants
 */
export const UI_TIMING = {
  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE_MS: 400,
  /** Debounce delay for filter changes (ms) */
  FILTER_DEBOUNCE_MS: 300,
} as const;

/**
 * Pagination constants
 */
export const PAGINATION = {
  /** Number of page buttons to show in pagination */
  VISIBLE_PAGES: 5,
  /** Default items per page */
  DEFAULT_PAGE_SIZE: 50,
} as const;
