import { chromium, type Browser, type Page } from "playwright";
import prisma from "@/lib/prisma";
import { scraperConfig } from "./config";
import { parseNewsletterContent, parseArchivePage, extractPublishDate, extractPageTitle } from "./parser";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ScrapeResult {
  issuesFound: number;
  issuesScraped: number;
  recommendationsAdded: number;
  errors: string[];
  debug?: string[];
}

export async function scrapeArchive(): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    issuesFound: 0,
    issuesScraped: 0,
    recommendationsAdded: 0,
    errors: [],
  };

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: scraperConfig.headless });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();

    // Scrape archive pages to find newsletter URLs
    let pageNum = 1;
    const maxPages = 20; // Safety limit
    const allIssues: { title: string; url: string; date: string | null }[] = [];

    while (pageNum <= maxPages) {
      const archiveUrl =
        pageNum === 1
          ? `${scraperConfig.archiveUrl}/archives`
          : `${scraperConfig.archiveUrl}/archives/${pageNum}`;

      console.log(`Scraping archive page ${pageNum}: ${archiveUrl}`);

      try {
        await page.goto(archiveUrl, {
          waitUntil: "domcontentloaded",
          timeout: scraperConfig.timeout,
        });
        await delay(1000);

        const html = await page.content();
        const issues = parseArchivePage(html);

        if (issues.length === 0) {
          console.log(`No more issues found on page ${pageNum}`);
          break;
        }

        allIssues.push(...issues);
        console.log(
          `Found ${issues.length} issues on page ${pageNum} (total: ${allIssues.length})`
        );

        pageNum++;
        await delay(scraperConfig.delayBetweenRequests);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Archive page ${pageNum}: ${message}`);
        break;
      }
    }

    result.issuesFound = allIssues.length;

    // Insert or update issues in database
    for (const issue of allIssues) {
      await prisma.issue.upsert({
        where: { url: issue.url },
        update: { title: issue.title },
        create: {
          title: issue.title,
          url: issue.url,
          date: issue.date ? new Date(issue.date) : null,
        },
      });
    }

    console.log(`\nArchive scraping complete. Found ${result.issuesFound} issues.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Archive scraping failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

export async function scrapeIssues(limit?: number): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    issuesFound: 0,
    issuesScraped: 0,
    recommendationsAdded: 0,
    errors: [],
  };

  let browser: Browser | null = null;

  try {
    // Get issues that haven't been scraped yet
    const unscrapedIssues = await prisma.issue.findMany({
      where: {
        scrapedAt: null,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    result.issuesFound = unscrapedIssues.length;

    if (unscrapedIssues.length === 0) {
      console.log("No unscraped issues found.");
      return result;
    }

    console.log(`Found ${unscrapedIssues.length} unscraped issues.`);

    browser = await chromium.launch({ headless: scraperConfig.headless });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();

    for (let i = 0; i < unscrapedIssues.length; i++) {
      const issue = unscrapedIssues[i];
      console.log(
        `\n[${i + 1}/${unscrapedIssues.length}] Scraping: ${issue.title}`
      );

      try {
        const recs = await scrapeIssue(page, issue.id, issue.url, issue.date);
        result.recommendationsAdded += recs;
        result.issuesScraped++;

        if (i < unscrapedIssues.length - 1) {
          await delay(scraperConfig.delayBetweenRequests);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Issue ${issue.id} (${issue.title}): ${message}`);
      }
    }

    console.log(`\nScraping complete.`);
    console.log(`Issues scraped: ${result.issuesScraped}`);
    console.log(`Recommendations added: ${result.recommendationsAdded}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Issue scraping failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

async function scrapeIssue(
  page: Page,
  issueId: number,
  issueUrl: string,
  currentDate: Date | null
): Promise<number> {
  await page.goto(issueUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await delay(2000);

  // Wait for article to load
  await page.waitForSelector("article", { timeout: 10000 }).catch(() => {});

  const html = await page.content();
  const recommendations = parseNewsletterContent(html);

  console.log(`  Found ${recommendations.length} recommendations`);

  // Extract date from page if not already set
  let extractedDate: Date | null = null;
  if (!currentDate) {
    extractedDate = extractPublishDate(html);
    if (extractedDate) {
      console.log(`  Extracted date: ${extractedDate.toISOString().split("T")[0]}`);
    }
  }

  let added = 0;

  for (const rec of recommendations) {
    // Check if this recommendation already exists (by URL and issue)
    const existing = await prisma.recommendation.findFirst({
      where: {
        issueId,
        url: rec.url,
      },
    });

    if (!existing) {
      await prisma.recommendation.create({
        data: {
          issueId,
          title: rec.title,
          url: rec.url,
          description: rec.description,
          category: rec.category,
          sectionName: rec.sectionName,
          isPrimaryLink: rec.isPrimaryLink,
          isCrowdsourced: rec.isCrowdsourced,
          contributorName: rec.contributorName,
        },
      });
      added++;
    }
  }

  // Mark issue as scraped and update date if extracted
  await prisma.issue.update({
    where: { id: issueId },
    data: {
      scrapedAt: new Date(),
      ...(extractedDate && { date: extractedDate }),
    },
  });

  return added;
}

/**
 * Scrape a single issue URL manually provided by admin
 */
export async function scrapeSingleUrl(url: string): Promise<ScrapeResult> {
  const result: ScrapeResult = {
    issuesFound: 1,
    issuesScraped: 0,
    recommendationsAdded: 0,
    errors: [],
    debug: [],
  };

  // Validate URL format - just needs to be a Verge URL
  if (!url.includes("theverge.com")) {
    result.errors.push("URL must be a Verge URL");
    return result;
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: scraperConfig.headless });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();

    console.log(`Scraping single URL: ${url}`);

    // Navigate to page first to extract title and date
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await delay(2000);

    const html = await page.content();

    // Debug: Log __NEXT_DATA__ structure
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const blocks = nextData?.props?.pageProps?.hydration?.responses?.[0]?.data?.node?.blocks;
        if (blocks) {
          const blockTypes = blocks.map((b: { __typename: string }) => b.__typename);
          const uniqueTypes = [...new Set(blockTypes)];
          result.debug?.push(`Found ${blocks.length} blocks with types: ${uniqueTypes.join(", ")}`);
        } else {
          result.debug?.push("No blocks found in standard __NEXT_DATA__ path");
          // Log what paths exist
          const pageProps = nextData?.props?.pageProps;
          if (pageProps) {
            result.debug?.push(`pageProps keys: ${Object.keys(pageProps).join(", ")}`);
            if (pageProps.hydration) {
              result.debug?.push(`hydration keys: ${Object.keys(pageProps.hydration).join(", ")}`);
              const responses = pageProps.hydration.responses;
              if (responses && responses.length > 0) {
                result.debug?.push(`responses[0] keys: ${Object.keys(responses[0]).join(", ")}`);
                if (responses[0].data) {
                  result.debug?.push(`responses[0].data keys: ${Object.keys(responses[0].data).join(", ")}`);
                  if (responses[0].data.node) {
                    result.debug?.push(`node keys: ${Object.keys(responses[0].data.node).join(", ")}`);
                  }
                }
                // Check all responses for content
                for (let i = 0; i < responses.length; i++) {
                  const resp = responses[i];
                  if (resp.data) {
                    const dataKeys = Object.keys(resp.data);
                    if (i > 0) {
                      result.debug?.push(`responses[${i}].data keys: ${dataKeys.join(", ")}`);
                    }
                    // Look for any key that might have blocks
                    for (const key of dataKeys) {
                      const val = resp.data[key];
                      if (val && typeof val === 'object') {
                        const valKeys = Object.keys(val);
                        if (valKeys.includes('blocks') || valKeys.includes('body') || valKeys.includes('content')) {
                          result.debug?.push(`Found potential content at responses[${i}].data.${key} with keys: ${valKeys.join(", ")}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        result.debug?.push(`Failed to parse __NEXT_DATA__: ${e}`);
      }
    } else {
      result.debug?.push("No __NEXT_DATA__ found on page - using fallback parser");
    }

    const extractedDate = extractPublishDate(html);
    const extractedTitle = extractPageTitle(html) || `Installer - ${extractedDate?.toISOString().split("T")[0] || "Unknown"}`;

    // Create or get the issue
    let issue = await prisma.issue.findUnique({
      where: { url },
    });

    if (issue) {
      // Issue exists - check if already scraped
      if (issue.scrapedAt) {
        result.debug?.push("Issue already scraped, re-scraping...");
        // Reset scrapedAt to allow re-scraping
        await prisma.issue.update({
          where: { id: issue.id },
          data: { scrapedAt: null },
        });
      }
    } else {
      // Create new issue
      issue = await prisma.issue.create({
        data: {
          title: extractedTitle,
          url,
          date: extractedDate,
        },
      });
      result.debug?.push(`Created new issue: ${extractedTitle}`);
    }

    // Parse recommendations
    const recommendations = parseNewsletterContent(html);
    result.debug?.push(`Found ${recommendations.length} recommendations`);

    // Debug: Show sections found
    const sections = [...new Set(recommendations.map(r => r.sectionName))];
    result.debug?.push(`Sections found: ${sections.join(", ") || "none"}`);
    const crowdsourcedCount = recommendations.filter(r => r.isCrowdsourced).length;
    result.debug?.push(`Crowdsourced items: ${crowdsourcedCount}`);

    // Debug: Check how many links are in the article
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      const allLinks = articleMatch[1].match(/<a\s+[^>]*href="([^"]+)"[^>]*>/gi) || [];
      result.debug?.push(`Total links in article HTML: ${allLinks.length}`);
    } else {
      result.debug?.push("No <article> tag found in HTML");
    }

    for (const rec of recommendations) {
      const existing = await prisma.recommendation.findFirst({
        where: {
          issueId: issue.id,
          url: rec.url,
        },
      });

      if (!existing) {
        await prisma.recommendation.create({
          data: {
            issueId: issue.id,
            title: rec.title,
            url: rec.url,
            description: rec.description,
            category: rec.category,
            sectionName: rec.sectionName,
            isPrimaryLink: rec.isPrimaryLink,
            isCrowdsourced: rec.isCrowdsourced,
            contributorName: rec.contributorName,
          },
        });
        result.recommendationsAdded++;
      }
    }

    // Mark issue as scraped
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        scrapedAt: new Date(),
        ...(extractedDate && !issue.date && { date: extractedDate }),
      },
    });

    result.issuesScraped = 1;
    console.log(`Scraping complete. Added ${result.recommendationsAdded} recommendations.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Failed to scrape URL: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

export async function scrapeAll(): Promise<ScrapeResult> {
  console.log("Starting full scrape...\n");

  // First scrape the archive to find all issues
  console.log("=== Phase 1: Scraping archive for newsletter URLs ===\n");
  const archiveResult = await scrapeArchive();

  // Then scrape each issue for recommendations
  console.log("\n=== Phase 2: Scraping individual issues ===\n");
  const issueResult = await scrapeIssues();

  return {
    issuesFound: archiveResult.issuesFound,
    issuesScraped: issueResult.issuesScraped,
    recommendationsAdded: issueResult.recommendationsAdded,
    errors: [...archiveResult.errors, ...issueResult.errors],
  };
}

/**
 * Backfill dates for issues that don't have them
 * Visits each issue page and extracts the publish date
 */
export async function backfillDates(): Promise<{ updated: number; errors: string[] }> {
  const result = { updated: 0, errors: [] as string[] };

  // Get issues without dates
  const issuesWithoutDates = await prisma.issue.findMany({
    where: { date: null },
    orderBy: { id: "asc" },
  });

  if (issuesWithoutDates.length === 0) {
    console.log("All issues already have dates.");
    return result;
  }

  console.log(`Found ${issuesWithoutDates.length} issues without dates.\n`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: scraperConfig.headless });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();

    for (let i = 0; i < issuesWithoutDates.length; i++) {
      const issue = issuesWithoutDates[i];
      console.log(`[${i + 1}/${issuesWithoutDates.length}] ${issue.title}`);

      try {
        await page.goto(issue.url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await delay(1500);

        const html = await page.content();
        const extractedDate = extractPublishDate(html);

        if (extractedDate) {
          await prisma.issue.update({
            where: { id: issue.id },
            data: { date: extractedDate },
          });
          console.log(`  -> ${extractedDate.toISOString().split("T")[0]}`);
          result.updated++;
        } else {
          console.log(`  -> No date found`);
        }

        if (i < issuesWithoutDates.length - 1) {
          await delay(scraperConfig.delayBetweenRequests);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        result.errors.push(`Issue ${issue.id}: ${message}`);
        console.log(`  -> Error: ${message}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\nBackfill complete. Updated ${result.updated} issues.`);
  return result;
}

/**
 * Backfill titles by fetching the actual page titles from recommendation URLs
 * This improves title quality when the newsletter link text wasn't descriptive
 */
export async function backfillTitles(options?: {
  limit?: number;
  onlyShortTitles?: boolean;
}): Promise<{ updated: number; skipped: number; errors: string[] }> {
  const result = { updated: 0, skipped: 0, errors: [] as string[] };

  const { limit = 100, onlyShortTitles = true } = options || {};

  // Build query - optionally filter to only short/vague titles
  const whereClause: { url: { not: null }; title?: { contains: string } | object } = {
    url: { not: null },
  };

  // If onlyShortTitles, prioritize recommendations with short or vague titles
  if (onlyShortTitles) {
    // Find recommendations where title might need improvement
    // (short titles, or titles that look like anchor text)
  }

  const recommendations = await prisma.recommendation.findMany({
    where: {
      url: { not: null },
      dead: false,
    },
    orderBy: [
      // Prioritize shorter titles (more likely to be vague anchor text)
      { title: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      url: true,
    },
  });

  if (recommendations.length === 0) {
    console.log("No recommendations to process.");
    return result;
  }

  // Filter to prioritize short/vague titles if requested
  type RecTitle = { id: number; title: string; url: string | null };
  let toProcess = recommendations as RecTitle[];
  if (onlyShortTitles) {
    toProcess = (recommendations as RecTitle[]).filter((r) => {
      const title = r.title.toLowerCase();
      // Prioritize short titles or common vague anchor text
      return (
        r.title.length < 30 ||
        title === "link" ||
        title === "here" ||
        title === "this" ||
        title === "check it out" ||
        title === "watch" ||
        title === "listen" ||
        title === "read" ||
        title.startsWith("the ") && r.title.length < 20
      );
    });
  }

  if (toProcess.length === 0) {
    console.log("No recommendations with short/vague titles to process.");
    return result;
  }

  console.log(`Processing ${toProcess.length} recommendations for title extraction.\n`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: scraperConfig.headless });
    const context = await browser.newContext({
      userAgent: scraperConfig.userAgent,
    });
    const page = await context.newPage();

    // Set shorter timeout for external pages
    page.setDefaultTimeout(15000);

    for (let i = 0; i < toProcess.length; i++) {
      const rec = toProcess[i];
      const shortTitle = rec.title.length > 40 ? rec.title.substring(0, 40) + "..." : rec.title;
      console.log(`[${i + 1}/${toProcess.length}] "${shortTitle}"`);

      if (!rec.url) {
        result.skipped++;
        continue;
      }

      try {
        // Skip certain URLs that won't have good titles
        if (shouldSkipForTitleExtraction(rec.url)) {
          console.log(`  -> Skipped (URL pattern)`);
          result.skipped++;
          continue;
        }

        await page.goto(rec.url, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        const html = await page.content();
        const extractedTitle = extractPageTitle(html);

        if (extractedTitle && extractedTitle.length > rec.title.length && extractedTitle.length < 200) {
          // Only update if the extracted title is meaningfully different and longer
          const similarity = calculateSimilarity(rec.title.toLowerCase(), extractedTitle.toLowerCase());

          if (similarity < 0.8) {
            // Titles are different enough to warrant an update
            await prisma.recommendation.update({
              where: { id: rec.id },
              data: { title: extractedTitle },
            });
            console.log(`  -> "${extractedTitle.substring(0, 50)}${extractedTitle.length > 50 ? "..." : ""}"`);
            result.updated++;
          } else {
            console.log(`  -> Skipped (similar to existing)`);
            result.skipped++;
          }
        } else {
          console.log(`  -> Skipped (no better title found)`);
          result.skipped++;
        }

        // Rate limit - be nice to external servers
        if (i < toProcess.length - 1) {
          await delay(1500);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        // Don't log full error for common cases
        if (message.includes("timeout") || message.includes("net::")) {
          console.log(`  -> Error: timeout/network`);
        } else {
          console.log(`  -> Error: ${message.substring(0, 50)}`);
        }
        result.errors.push(`${rec.id}: ${message}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\nTitle backfill complete.`);
  console.log(`Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
  return result;
}

/**
 * Check if a URL should be skipped for title extraction
 */
function shouldSkipForTitleExtraction(url: string): boolean {
  const skipPatterns = [
    /^mailto:/,
    /^tel:/,
    /^javascript:/,
    /\.(pdf|zip|dmg|exe|mp3|mp4|mov|avi)$/i,
    /^https?:\/\/[^/]+\/?$/,  // Bare domains without path
  ];

  return skipPatterns.some((pattern) => pattern.test(url));
}

/**
 * Simple similarity calculation between two strings
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  // Check if one contains the other
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }

  // Simple word overlap
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  const intersection = [...words1].filter((w) => words2.has(w));

  return intersection.length / Math.max(words1.size, words2.size);
}
