import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CategorizeInput {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  currentTags?: string[];
}

export interface CategorizeResult {
  id: number;
  category: Category;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  suggestedTags: string[];
}

const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  apps: "Mobile or desktop applications (iOS, Android, Mac, Windows apps)",
  shows: "TV series, streaming shows, limited series",
  movies: "Films, documentaries, theatrical releases",
  games: "Video games (mobile, console, PC games)",
  books: "Books, ebooks, audiobooks",
  videos: "YouTube videos, video content, TikToks, short-form video",
  music: "Albums, songs, playlists, music releases",
  podcasts: "Podcast shows or specific podcast episodes",
  articles: "News articles, blog posts, written content, newsletters",
  gadgets: "Hardware, devices, tech gadgets, accessories",
  "food-drink": "Recipes, restaurants, food products, beverages",
  blog: "Personal blogs, ongoing blog series",
  website: "General websites, web tools, web services",
};

function buildPrompt(items: CategorizeInput[], existingTags: string[]): string {
  const categoryList = CATEGORIES.map(
    (cat) => `- ${cat}: ${CATEGORY_DESCRIPTIONS[cat]}`
  ).join("\n");

  const itemList = items
    .map(
      (item, i) =>
        `${i + 1}. [ID: ${item.id}]
   Title: "${item.title}"
   URL: ${item.url || "N/A"}
   Description: ${item.description || "N/A"}
   Current Tags: ${item.currentTags?.length ? item.currentTags.join(", ") : "none"}`
    )
    .join("\n\n");

  const existingTagsList = existingTags.length > 0
    ? existingTags.join(", ")
    : "none yet";

  return `You are a content categorization and tagging assistant. For each item:
1. Categorize it into exactly ONE category
2. Suggest 1-3 relevant tags

## Categories
${categoryList}

## Existing Tags in Database
${existingTagsList}

## Tagging Guidelines
- STRONGLY PREFER existing tags from the database when applicable
- Only create new tags if no existing tag fits well
- Tags should be lowercase, short (1-2 words), and descriptive
- Good tags: specific topics (e.g., "ai", "productivity", "privacy"), platforms (e.g., "ios", "mac"), or descriptors (e.g., "free", "open-source")
- Avoid generic tags that just repeat the category (e.g., don't tag an app with "app")
- 1-3 tags per item is ideal; use 0 if nothing fits well
- Keep current tags that are still relevant

## Categorization Guidelines
- Use URL domain as a strong signal (e.g., apps.apple.com → apps, store.steampowered.com → games)
- "articles" is the default for news, opinion pieces, and general web content
- Choose "website" for tools and services that don't fit other categories
- Be conservative: when uncertain, prefer "articles" over more specific categories
- An article ABOUT podcasts is still "articles", not "podcasts"
- An article ABOUT a game is still "articles", not "games"

## Items to Process
${itemList}

## Response Format
Return a JSON array with one object per item:
[
  {"id": <original_id>, "category": "<category>", "confidence": "high|medium|low", "reasoning": "<brief explanation>", "tags": ["tag1", "tag2"]}
]

Only output the JSON array, no other text.`;
}

function parseResponse(text: string): CategorizeResult[] {
  // Extract JSON from the response (handle potential markdown code blocks)
  let jsonStr = text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Response is not an array");
  }

  return parsed.map((item) => {
    if (!item.id || !item.category) {
      throw new Error("Invalid item in response");
    }

    // Validate category
    const category = item.category as Category;
    if (!CATEGORIES.includes(category)) {
      // Fall back to articles if category is invalid
      return {
        id: item.id,
        category: "articles" as Category,
        confidence: "low" as const,
        reasoning: `Invalid category "${item.category}" returned, defaulting to articles`,
        suggestedTags: [],
      };
    }

    // Parse and normalize tags
    const suggestedTags: string[] = [];
    if (Array.isArray(item.tags)) {
      for (const tag of item.tags) {
        if (typeof tag === "string" && tag.trim()) {
          suggestedTags.push(tag.toLowerCase().trim());
        }
      }
    }

    return {
      id: item.id,
      category,
      confidence: item.confidence || "medium",
      reasoning: item.reasoning || "",
      suggestedTags,
    };
  });
}

/**
 * Categorize a batch of recommendations using Claude AI
 * @param items Array of items to categorize (max ~20 for optimal performance)
 * @param existingTags Array of existing tag names in the database
 * @returns Array of categorization results with suggested tags
 */
export async function categorizeBatch(
  items: CategorizeInput[],
  existingTags: string[] = []
): Promise<CategorizeResult[]> {
  if (items.length === 0) {
    return [];
  }

  const prompt = buildPrompt(items, existingTags);

  const response = await anthropic.messages.create({
    model: "claude-3-5-haiku-latest",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in response");
  }

  return parseResponse(textContent.text);
}

/**
 * Categorize items in batches, processing multiple batches if needed
 * @param items All items to categorize
 * @param existingTags Array of existing tag names in the database
 * @param batchSize Number of items per API call (default 15)
 * @param onProgress Optional callback for progress updates
 */
export async function categorizeAll(
  items: CategorizeInput[],
  existingTags: string[] = [],
  batchSize = 15,
  onProgress?: (processed: number, total: number) => void
): Promise<CategorizeResult[]> {
  const results: CategorizeResult[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    try {
      const batchResults = await categorizeBatch(batch, existingTags);
      results.push(...batchResults);
    } catch (error) {
      // On batch failure, mark all items in batch as failed
      for (const item of batch) {
        results.push({
          id: item.id,
          category: "articles",
          confidence: "low",
          reasoning: `Batch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          suggestedTags: [],
        });
      }
    }

    onProgress?.(Math.min(i + batchSize, items.length), items.length);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
