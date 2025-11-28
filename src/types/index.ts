export const CATEGORIES = [
  "apps",
  "shows",
  "movies",
  "games",
  "books",
  "videos",
  "music",
  "podcasts",
  "articles",
  "gadgets",
  "food-drink",
  "blog",
  "website",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Basic tag interface
 */
export interface Tag {
  id: number;
  name: string;
}

/**
 * Tag with recommendation count (for admin filters)
 */
export interface TagWithCount extends Tag {
  _count: { recommendations: number };
}

/**
 * Issue data included in recommendations
 */
export interface IssueRef {
  id: number;
  title: string;
  url: string;
  date: Date | null;
}

/**
 * AI enrichment result data
 */
export interface AIResultData {
  category: string;
  previous: string;
  confidence: string;
  reasoning: string;
  addedTags: string[];
}

/**
 * Full recommendation with issue and tags
 */
export interface RecommendationWithIssue {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  category: Category;
  sectionName: string | null;
  isCrowdsourced: boolean;
  contributorName: string | null;
  hidden: boolean;
  dead: boolean;
  issueId: number;
  issue: IssueRef;
  tags: Tag[];
}
