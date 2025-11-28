"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { chromium } from "playwright";
import { extractPageTitle, guessCategory } from "@/lib/scraper/parser";
import { categorizeAll, type CategorizeResult } from "@/lib/categorize";
import { scraperConfig } from "@/lib/scraper/config";

/**
 * Local type for recommendation where clause.
 * Using local type since Prisma client may not be fully generated in all environments.
 */
interface RecommendationWhereInput {
  hidden?: boolean;
  dead?: boolean;
  category?: string;
  issueId?: number;
  tags?: { some: { name: string } };
  OR?: Array<{
    title?: { contains: string };
    description?: { contains: string };
    url?: { contains: string };
  }>;
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function updateRecommendation(
  id: number,
  data: {
    title?: string;
    url?: string | null;
    description?: string | null;
    category?: string;
    hidden?: boolean;
    dead?: boolean;
  }
) {
  await requireAuth();

  const updated = await prisma.recommendation.update({
    where: { id },
    data,
  });

  revalidatePath("/");
  revalidatePath("/admin");

  return updated;
}

export async function updateRecommendationTags(
  recommendationId: number,
  tagNames: string[]
) {
  await requireAuth();

  // Get or create tags
  const tags = await Promise.all(
    tagNames.map(async (name) => {
      const normalizedName = name.toLowerCase().trim();
      return prisma.tag.upsert({
        where: { name: normalizedName },
        update: {},
        create: { name: normalizedName },
      });
    })
  );

  // Update recommendation with new tags
  const updated = await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      tags: {
        set: tags.map((t) => ({ id: t.id })),
      },
    },
    include: {
      tags: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");

  return updated;
}

export async function addTagToRecommendation(
  recommendationId: number,
  tagName: string
) {
  await requireAuth();

  const normalizedName = tagName.toLowerCase().trim();

  // Get or create tag
  const tag = await prisma.tag.upsert({
    where: { name: normalizedName },
    update: {},
    create: { name: normalizedName },
  });

  // Connect tag to recommendation
  const updated = await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      tags: {
        connect: { id: tag.id },
      },
    },
    include: {
      tags: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");

  return updated;
}

export async function removeTagFromRecommendation(
  recommendationId: number,
  tagId: number
) {
  await requireAuth();

  const updated = await prisma.recommendation.update({
    where: { id: recommendationId },
    data: {
      tags: {
        disconnect: { id: tagId },
      },
    },
    include: {
      tags: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");

  return updated;
}

export async function bulkUpdateCategory(ids: number[], category: string) {
  await requireAuth();

  await prisma.recommendation.updateMany({
    where: { id: { in: ids } },
    data: { category },
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function bulkHide(ids: number[], hidden: boolean) {
  await requireAuth();

  await prisma.recommendation.updateMany({
    where: { id: { in: ids } },
    data: { hidden },
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteTag(tagId: number) {
  await requireAuth();

  await prisma.tag.delete({
    where: { id: tagId },
  });

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { recommendations: true },
      },
    },
  });
}

export async function getAdminRecommendations(params: {
  search?: string;
  category?: string;
  issueId?: number;
  tag?: string;
  showHidden?: boolean;
  deadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  await requireAuth();

  const {
    search,
    category,
    issueId,
    tag,
    showHidden = true,
    deadOnly = false,
    limit = 50,
    offset = 0,
  } = params;

  const where: RecommendationWhereInput = {};

  if (!showHidden) {
    where.hidden = false;
  }

  if (deadOnly) {
    where.dead = true;
  }

  if (category) {
    where.category = category;
  }

  if (issueId) {
    where.issueId = issueId;
  }

  if (tag) {
    where.tags = {
      some: { name: tag },
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { description: { contains: search } },
      { url: { contains: search } },
    ];
  }

  const [recommendations, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      include: {
        issue: {
          select: {
            id: true,
            title: true,
            url: true,
            date: true,
          },
        },
        tags: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { issue: { date: "desc" } },
        { id: "desc" },
      ],
      skip: offset,
      take: limit,
    }),
    prisma.recommendation.count({ where }),
  ]);

  return { recommendations, total };
}

/**
 * Fetch the title from a recommendation's URL and update it
 */
export async function fetchTitleForRecommendation(
  recommendationId: number
): Promise<{ success: boolean; title?: string; error?: string }> {
  await requireAuth();

  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    select: { id: true, url: true, title: true },
  });

  if (!rec) {
    return { success: false, error: "Recommendation not found" };
  }

  if (!rec.url) {
    return { success: false, error: "No URL to fetch" };
  }

  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    await page.goto(rec.url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const html = await page.content();
    const extractedTitle = extractPageTitle(html);

    if (!extractedTitle) {
      return { success: false, error: "Could not extract title from page" };
    }

    // Update the recommendation
    await prisma.recommendation.update({
      where: { id: recommendationId },
      data: { title: extractedTitle },
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return { success: true, title: extractedTitle };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export interface EnrichResult {
  id: number;
  success: boolean;
  title?: string;
  category?: string;
  error?: string;
}

/**
 * Batch enrich recommendations - fetch titles and guess categories
 */
export async function batchEnrichRecommendations(
  ids: number[]
): Promise<{ results: EnrichResult[] }> {
  await requireAuth();

  const recommendations = await prisma.recommendation.findMany({
    where: { id: { in: ids } },
    select: { id: true, url: true, title: true, description: true, category: true },
  });

  const results: EnrichResult[] = [];
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });

    for (const rec of recommendations) {
      if (!rec.url) {
        results.push({ id: rec.id, success: false, error: "No URL" });
        continue;
      }

      try {
        const page = await context.newPage();
        page.setDefaultTimeout(10000);

        await page.goto(rec.url, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });

        const html = await page.content();
        await page.close();

        const extractedTitle = extractPageTitle(html);
        const guessedCategory = guessCategory(
          extractedTitle || rec.title,
          rec.description,
          rec.url
        );

        const updateData: { title?: string; category?: string } = {};

        if (extractedTitle && extractedTitle !== rec.title) {
          updateData.title = extractedTitle;
        }

        if (guessedCategory !== rec.category) {
          updateData.category = guessedCategory;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.recommendation.update({
            where: { id: rec.id },
            data: updateData,
          });
        }

        results.push({
          id: rec.id,
          success: true,
          title: extractedTitle || undefined,
          category: guessedCategory,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.push({ id: rec.id, success: false, error: message });
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  revalidatePath("/");
  revalidatePath("/admin");

  return { results };
}

export interface AICategorizeResult {
  id: number;
  success: boolean;
  category?: string;
  previousCategory?: string;
  confidence?: string;
  reasoning?: string;
  addedTags?: string[];
  error?: string;
}

/**
 * Use AI (Claude) to categorize and tag recommendations
 */
export async function aiCategorizeRecommendations(
  ids: number[]
): Promise<{ results: AICategorizeResult[] }> {
  await requireAuth();

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  // Fetch all existing tags for the AI to prefer
  const allTags = await prisma.tag.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const existingTagNames = allTags.map((t: { name: string }) => t.name);

  // Fetch recommendations with their current tags
  const recommendations = await prisma.recommendation.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      category: true,
      tags: { select: { id: true, name: true } },
    },
  });

  if (recommendations.length === 0) {
    return { results: [] };
  }

  // Define type for recommendation from query
  type RecWithTags = {
    id: number;
    url: string | null;
    title: string;
    description: string | null;
    category: string;
    tags: { id: number; name: string }[];
  };

  // Call AI categorization with existing tags
  const aiResults = await categorizeAll(
    (recommendations as RecWithTags[]).map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      description: r.description,
      currentTags: r.tags.map((t) => t.name),
    })),
    existingTagNames
  );

  // Build a map for easy lookup
  const resultMap = new Map<number, CategorizeResult>();
  for (const result of aiResults) {
    resultMap.set(result.id, result);
  }

  // Update database and build response
  const results: AICategorizeResult[] = [];
  const typedRecommendations = recommendations as RecWithTags[];

  for (const rec of typedRecommendations) {
    const aiResult = resultMap.get(rec.id);

    if (!aiResult) {
      results.push({
        id: rec.id,
        success: false,
        error: "No AI result returned",
      });
      continue;
    }

    const currentTagNames = new Set(rec.tags.map((t) => t.name));
    const newTagNames = aiResult.suggestedTags.filter((t) => !currentTagNames.has(t));

    // Get or create tags for new suggestions
    const tagsToConnect: { id: number }[] = [];
    for (const tagName of newTagNames) {
      const tag = await prisma.tag.upsert({
        where: { name: tagName },
        update: {},
        create: { name: tagName },
      });
      tagsToConnect.push({ id: tag.id });
    }

    // Update recommendation
    const updateData: { category?: string; tags?: { connect: { id: number }[] } } = {};

    if (aiResult.category !== rec.category) {
      updateData.category = aiResult.category;
    }

    if (tagsToConnect.length > 0) {
      updateData.tags = { connect: tagsToConnect };
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.recommendation.update({
        where: { id: rec.id },
        data: updateData,
      });
    }

    results.push({
      id: rec.id,
      success: true,
      category: aiResult.category,
      previousCategory: rec.category,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      addedTags: newTagNames,
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");

  return { results };
}
