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

export interface RecommendationWithIssue {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  category: string;
  sectionName: string | null;
  isCrowdsourced: boolean;
  contributorName: string | null;
  hidden: boolean;
  dead: boolean;
  issueId: number;
  issue: {
    id: number;
    title: string;
    url: string;
    date: Date | null;
  };
  tags: {
    id: number;
    name: string;
  }[];
}
