import { SKIP_URL_PATTERNS, JUNK_TITLE_PATTERNS } from "./config";
import { extractDomain as extractDomainUtil, decodeHtmlEntities } from "@/lib/utils/format";

export interface ParsedRecommendation {
  title: string;
  url: string;
  description: string | null;
  category: string;
  sectionName: string | null;
  isPrimaryLink: boolean;
  isCrowdsourced: boolean;
  contributorName: string | null;
}

/**
 * Extract the best title from a page's HTML
 * Prefers og:title, falls back to <title>
 */
export function extractPageTitle(html: string): string | null {
  // Try Open Graph title first (usually cleaner)
  const ogTitleMatch = html.match(
    /<meta[^>]*property="og:title"[^>]*content="([^"]+)"[^>]*>/i
  ) || html.match(
    /<meta[^>]*content="([^"]+)"[^>]*property="og:title"[^>]*>/i
  );

  if (ogTitleMatch) {
    const title = decodeHtmlEntities(ogTitleMatch[1]).trim();
    if (title && title.length > 2) {
      return cleanTitle(title);
    }
  }

  // Try Twitter title
  const twitterTitleMatch = html.match(
    /<meta[^>]*name="twitter:title"[^>]*content="([^"]+)"[^>]*>/i
  ) || html.match(
    /<meta[^>]*content="([^"]+)"[^>]*name="twitter:title"[^>]*>/i
  );

  if (twitterTitleMatch) {
    const title = decodeHtmlEntities(twitterTitleMatch[1]).trim();
    if (title && title.length > 2) {
      return cleanTitle(title);
    }
  }

  // Fall back to <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = decodeHtmlEntities(titleMatch[1]).trim();
    if (title && title.length > 2) {
      return cleanTitle(title);
    }
  }

  return null;
}

/**
 * Clean up a page title by removing common suffixes
 */
function cleanTitle(title: string): string {
  // Remove common site name suffixes
  const suffixPatterns = [
    /\s*[|\-–—]\s*YouTube$/i,
    /\s*[|\-–—]\s*The Verge$/i,
    /\s*[|\-–—]\s*Netflix$/i,
    /\s*[|\-–—]\s*Apple$/i,
    /\s*[|\-–—]\s*Spotify$/i,
    /\s*[|\-–—]\s*Steam$/i,
    /\s*[|\-–—]\s*Amazon\.com$/i,
    /\s*[|\-–—]\s*IMDb$/i,
    /\s*[|\-–—]\s*Rotten Tomatoes$/i,
    /\s*[|\-–—]\s*Wikipedia$/i,
    /\s*[|\-–—]\s*Reddit$/i,
    /\s*on the App Store$/i,
    /\s*- Apps on Google Play$/i,
    /\s*[|\-–—]\s*[A-Z][a-zA-Z\s]{2,20}$/,  // Generic " - Site Name" pattern
  ];

  let cleaned = title;
  for (const pattern of suffixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned.trim();
}

/**
 * Extract publication date from page HTML
 * Looks in __NEXT_DATA__ JSON or <time> elements
 */
export function extractPublishDate(html: string): Date | null {
  // Try __NEXT_DATA__ first
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Look for publishedAt or datePublished in various locations
      const publishedAt =
        nextData?.props?.pageProps?.hydration?.responses?.[0]?.data?.node?.publishedAt ||
        nextData?.props?.pageProps?.hydration?.responses?.[0]?.data?.node?.datePublished ||
        nextData?.props?.pageProps?.data?.node?.publishedAt;

      if (publishedAt) {
        const date = new Date(publishedAt);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // Fallback: look for <time> element with datetime attribute
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
  if (timeMatch) {
    const date = new Date(timeMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Fallback: look for date patterns in meta tags
  const metaDateMatch = html.match(
    /<meta[^>]*(?:property|name)="(?:article:published_time|datePublished)"[^>]*content="([^"]+)"[^>]*>/i
  );
  if (metaDateMatch) {
    const date = new Date(metaDateMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function shouldSkipUrl(url: string): boolean {
  if (!url) return true;
  return SKIP_URL_PATTERNS.some((pattern) => pattern.test(url));
}

function isJunkTitle(title: string): boolean {
  if (!title || title.length < 3 || title.length > 200) return true;
  return JUNK_TITLE_PATTERNS.some((pattern) => pattern.test(title.trim()));
}

/**
 * Extract domain from URL, returning null for invalid URLs.
 * Uses shared utility but returns null instead of empty string for parser compatibility.
 */
function extractDomain(url: string): string | null {
  const domain = extractDomainUtil(url);
  return domain || null;
}

export function guessCategory(
  title: string,
  description: string | null,
  url: string
): string {
  const text = `${title || ""} ${description || ""} ${url || ""}`.toLowerCase();
  const domain = url ? extractDomain(url) : "";

  if (domain) {
    if (
      domain.includes("apps.apple.com") ||
      domain.includes("play.google.com") ||
      domain.includes("app.") ||
      domain.endsWith(".app")
    )
      return "apps";

    if (
      [
        "netflix.com",
        "hulu.com",
        "disneyplus.com",
        "max.com",
        "hbomax.com",
        "peacocktv.com",
        "paramountplus.com",
        "appletv.apple.com",
        "tv.apple.com",
        "amazon.com/gp/video",
        "primevideo.com",
      ].some((d) => domain.includes(d) || url?.includes(d))
    ) {
      return "shows";
    }

    if (
      ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com"].some((d) =>
        domain.includes(d)
      )
    )
      return "videos";

    if (
      [
        "spotify.com/track",
        "spotify.com/album",
        "music.apple.com",
        "soundcloud.com",
        "bandcamp.com",
      ].some((d) => url?.includes(d))
    )
      return "music";

    if (
      [
        "spotify.com/show",
        "podcasts.apple.com",
        "pocketcasts.com",
        "overcast.fm",
        "castro.fm",
      ].some((d) => url?.includes(d))
    )
      return "podcasts";

    if (
      [
        "store.steampowered.com",
        "epicgames.com",
        "gog.com",
        "itch.io",
        "nintendo.com",
        "playstation.com",
        "xbox.com",
        "ea.com",
      ].some((d) => domain.includes(d))
    )
      return "games";

    if (
      [
        "amazon.com/dp",
        "bookshop.org",
        "goodreads.com",
        "librarything.com",
        "books.google.com",
      ].some((d) => url?.includes(d))
    )
      return "books";

    if (domain.includes("imdb.com") || url?.includes("themoviedb.org/movie"))
      return "movies";

    if (url?.includes("themoviedb.org/tv")) return "shows";

    if (
      (domain.includes("amazon.com") && !url?.includes("/dp/")) ||
      domain.includes("bestbuy.com") ||
      domain.includes("bhphotovideo.com")
    )
      return "gadgets";

    if (
      [
        "seriouseats.com",
        "bonappetit.com",
        "foodnetwork.com",
        "epicurious.com",
        "food52.com",
        "allrecipes.com",
        "delish.com",
        "tastingtable.com",
        "eater.com",
        "thekitchn.com",
        "cookieandkate.com",
        "minimalistbaker.com",
        "wine.com",
        "vinepair.com",
        "punchdrink.com",
        "diffordsguide.com",
        "imbibemagazine.com",
      ].some((d) => domain.includes(d))
    )
      return "food-drink";
  }

  // Text-based matching - be conservative to avoid false positives
  // Only match very specific patterns

  if (text.match(/\b(ios|android|iphone|ipad)\s*(app|application)/i))
    return "apps";

  // Shows: require more specific patterns
  if (text.match(/\b(tv\s*show|tv\s*series|season\s*\d+\s*(episode|finale|premiere)|episode\s*\d+|limited\s*series|miniseries)/i))
    return "shows";

  // Movies: be more specific
  if (text.match(/\b(movie|film|cinema|theatrical\s*release|box\s*office)/i))
    return "movies";

  // Games: require gaming context
  if (text.match(/\b(video\s*game|nintendo\s*switch|playstation\s*\d|xbox\s*(series|one|game)|steam\s*(game|deck)|pc\s*game)/i))
    return "games";

  // Podcasts: only match if clearly a podcast (handled by domain check above)
  // Don't use text matching - too many articles *about* podcasts get miscategorized

  // Books: be more specific, avoid "reading"
  if (text.match(/\b(novel|memoir|nonfiction|hardcover|paperback|kindle\s*edition|audiobook)/i))
    return "books";

  // Music: require album/song context, avoid generic "track"
  if (text.match(/\b(new\s*album|debut\s*album|studio\s*album|music\s*video|new\s*single|new\s*song)/i))
    return "music";

  // Gadgets: be specific
  if (text.match(/\b(smart\s*home|wearable|headphones|earbuds|charger|cable|accessory|gadget)/i))
    return "gadgets";

  // Food & drink: require specific food context
  if (text.match(/\b(recipe|cookbook|restaurant\s*review|cocktail\s*recipe|wine\s*review)/i))
    return "food-drink";

  return "articles";
}

function extractBetterTitle(
  anchorText: string,
  context: string,
  url: string
): string | null {
  if (anchorText && anchorText.length >= 5 && !isJunkTitle(anchorText)) {
    return anchorText.trim();
  }

  if (context) {
    const linkPattern = /([A-Z][^.!?]*?)\s*\(link\)/i;
    const linkMatch = context.match(linkPattern);
    if (linkMatch && linkMatch[1] && linkMatch[1].length > 3) {
      return linkMatch[1].trim();
    }

    if (anchorText && anchorText.length < 20) {
      const idx = context.indexOf(anchorText);
      if (idx > 0) {
        const start = Math.max(0, context.lastIndexOf(" ", idx - 20));
        const end = Math.min(
          context.length,
          context.indexOf(" ", idx + anchorText.length + 30)
        );
        const expanded = context.substring(start, end).trim();
        if (expanded.length > anchorText.length && expanded.length < 100) {
          return expanded;
        }
      }
    }
  }

  if (url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const slugMatch = pathname.match(/\/([a-z0-9-]+)\/?$/i);
      if (slugMatch) {
        const slug = slugMatch[1]
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        if (slug.length > 5 && !isJunkTitle(slug)) {
          return slug;
        }
      }
    } catch {
      // Invalid URL
    }
  }

  return anchorText?.trim() || null;
}

function extractLinksFromHtml(
  htmlContent: string
): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = [];
  const linkRegex = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(htmlContent)) !== null) {
    const href = decodeHtmlEntities(match[1]);
    const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, "").trim());
    if (href && text) {
      links.push({ href, text });
    }
  }

  return links;
}

function processLink(
  href: string,
  text: string,
  context: string,
  sectionName: string | null,
  contributorName: string | null,
  seenUrls: Set<string>,
  recommendations: ParsedRecommendation[]
): void {
  if (!href) return;

  if (href.startsWith("/")) {
    href = `https://www.theverge.com${href}`;
  }

  if (seenUrls.has(href) || shouldSkipUrl(href)) return;
  seenUrls.add(href);

  if (isJunkTitle(text)) return;

  const title = extractBetterTitle(text, context, href);
  if (!title || isJunkTitle(title)) return;

  const category = guessCategory(title, context, href);

  const isCrowdsourced =
    contributorName !== null ||
    /—\s*\w+\s*$/.test(context) ||
    context.toLowerCase().includes("community") ||
    context.toLowerCase().includes("installer reader");

  let finalContributorName = contributorName;
  if (!finalContributorName && isCrowdsourced) {
    const match = context.match(/—\s*(\w+)\s*$/);
    if (match) {
      finalContributorName = match[1];
    }
  }

  recommendations.push({
    title,
    url: href,
    description: context.length > 10 ? context.substring(0, 500) : null,
    isPrimaryLink: context.toLowerCase().includes("(link)"),
    isCrowdsourced,
    contributorName: finalContributorName,
    sectionName,
    category,
  });
}

interface NextDataBlock {
  __typename: string;
  contents?: { html?: string };
  paragraphContents?: { html?: string }[];
  items?: { html?: string }[];
}

export function parseNewsletterContent(html: string): ParsedRecommendation[] {
  const recommendations: ParsedRecommendation[] = [];
  const seenUrls = new Set<string>();

  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const responses = nextData?.props?.pageProps?.hydration?.responses || [];

      // Find the response that contains blocks (may not be the first one)
      let blocks: NextDataBlock[] | undefined;
      for (const response of responses) {
        const nodeBlocks = response?.data?.node?.blocks;
        if (nodeBlocks && Array.isArray(nodeBlocks) && nodeBlocks.length > 0) {
          blocks = nodeBlocks;
          break;
        }
      }

      if (blocks && Array.isArray(blocks)) {
        let currentSection = "intro";

        for (const block of blocks) {
          const typename = block.__typename;

          if (typename === "CoreHeadingBlockType") {
            const heading = block.contents?.html || "";
            currentSection = decodeHtmlEntities(heading)
              .toLowerCase()
              .replace(/\s+/g, "_");
            continue;
          }

          if (typename === "CoreParagraphBlockType") {
            const contents = block.paragraphContents || [];
            for (const content of contents) {
              const htmlContent = content.html || "";
              const plainText = decodeHtmlEntities(htmlContent);

              let contributorName: string | null = null;
              const contributorMatch = htmlContent.match(
                /&mdash;\s*(?:&nbsp;)?(\w+)\s*$/
              );
              if (contributorMatch) {
                contributorName = contributorMatch[1];
              }

              const links = extractLinksFromHtml(htmlContent);
              for (const link of links) {
                processLink(
                  link.href,
                  link.text,
                  plainText,
                  currentSection,
                  contributorName,
                  seenUrls,
                  recommendations
                );
              }
            }
          }

          if (typename === "CoreListBlockType") {
            const items = block.items || [];
            for (const item of items) {
              const htmlContent = item.html || "";
              const plainText = decodeHtmlEntities(htmlContent);

              const links = extractLinksFromHtml(htmlContent);
              for (const link of links) {
                processLink(
                  link.href,
                  link.text,
                  plainText,
                  currentSection,
                  null,
                  seenUrls,
                  recommendations
                );
              }
            }
          }
        }

        if (recommendations.length > 0) {
          return recommendations;
        }
      }
    } catch {
      // Failed to parse __NEXT_DATA__, will fall back to cheerio
    }
  }

  // Fallback parsing using regex (when __NEXT_DATA__ is not available)
  const articleMatch = html.match(
    /<article[^>]*>([\s\S]*?)<\/article>/i
  );
  if (articleMatch) {
    const articleHtml = articleMatch[1];
    const links = extractLinksFromHtml(articleHtml);

    for (const link of links) {
      processLink(
        link.href,
        link.text,
        link.text,
        null,
        null,
        seenUrls,
        recommendations
      );
    }
  }

  return recommendations;
}

export function parseArchivePage(
  html: string
): { title: string; url: string; date: string | null }[] {
  const issues: { title: string; url: string; date: string | null }[] = [];
  const seenUrls = new Set<string>();

  // Look for newsletter links in the archive page
  const linkRegex =
    /<a[^>]*href="(https?:\/\/www\.theverge\.com\/(?:\d{4}\/\d{1,2}\/\d{1,2}\/\d+\/[^"]+|installer-newsletter\/\d+\/[^"]+))"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const title = decodeHtmlEntities(match[2].trim());

    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    if (title.length < 15) continue;
    if (title.includes("Comment") || title.includes("See All")) continue;

    // Try to extract date from URL
    let date: string | null = null;
    const dateMatch = url.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
    if (dateMatch) {
      date = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }

    issues.push({ title, url, date });
  }

  return issues;
}
