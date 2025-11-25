/**
 * Issue Parser
 * Extracts recommendations from individual Installer newsletter pages
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config, categories } from './config.js';
import dbOperations from './db.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ensure raw HTML directory exists
mkdirSync(config.rawHtmlDir, { recursive: true });

// URLs and patterns to always skip
const SKIP_URL_PATTERNS = [
  /theverge\.com\/ethics/,
  /theverge\.com\/privacy/,
  /theverge\.com\/terms/,
  /theverge\.com\/contact/,
  /theverge\.com\/about/,
  /theverge\.com\/sitemap/,
  /theverge\.com\/rss/,
  /theverge\.com\/authors\//,
  /theverge\.com\/installer-newsletter\/?$/,
  /theverge\.com\/installer-newsletter\/archives/,
  /theverge\.com\/pages\//,
  /theverge\.com\/?$/,
  /twitter\.com\/intent/,
  /twitter\.com\/verge/,
  /facebook\.com\/sharer/,
  /linkedin\.com\/share/,
  /instagram\.com\/verge/,
  /threads\.net\/.*verge/,
  /tiktok\.com\/@verge/,
  /voxmedia\.com/,
  /onetrust\.com/,
  /status\.voxmedia/,
  /mailto:/,
  /#comments/,
  /^#/,
  /\.(css|js|woff|png|jpg|ico|svg)$/,
];

// Titles that indicate junk links
const JUNK_TITLE_PATTERNS = [
  /^see all/i,
  /^comments?\s*\d*/i,
  /^\d+\s*comments?/i,
  /^share$/i,
  /^icon/i,
  /^subscribe/i,
  /^sign up/i,
  /^read more$/i,
  /^click here/i,
  /^here$/i,
  /^link$/i,
  /^\d+$/,
  /^the$/i,
  /^a$/i,
  /^an$/i,
  /^\s*$/,
];

/**
 * Check if a URL should be skipped
 */
function shouldSkipUrl(url) {
  if (!url) return true;
  return SKIP_URL_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if a title is junk
 */
function isJunkTitle(title) {
  if (!title || title.length < 3 || title.length > 200) return true;
  return JUNK_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()));
}

/**
 * Extract a better title from context
 */
function extractBetterTitle(anchorText, context, url) {
  // If anchor text is good enough, use it
  if (anchorText && anchorText.length >= 5 && !isJunkTitle(anchorText)) {
    return anchorText.trim();
  }

  // Try to extract title from surrounding context
  // Look for patterns like "Title (link)" or "checking out Title"
  if (context) {
    // Pattern: "something Title (link)" - get the word(s) before "(link)"
    const linkPattern = /([A-Z][^.!?]*?)\s*\(link\)/i;
    const linkMatch = context.match(linkPattern);
    if (linkMatch && linkMatch[1] && linkMatch[1].length > 3) {
      return linkMatch[1].trim();
    }

    // If anchor text is short, try to get more context
    if (anchorText && anchorText.length < 20) {
      // Look for the anchor text in context and grab surrounding words
      const idx = context.indexOf(anchorText);
      if (idx > 0) {
        // Get some words before and after
        const start = Math.max(0, context.lastIndexOf(' ', idx - 20));
        const end = Math.min(context.length, context.indexOf(' ', idx + anchorText.length + 30));
        const expanded = context.substring(start, end).trim();
        if (expanded.length > anchorText.length && expanded.length < 100) {
          return expanded;
        }
      }
    }
  }

  // Try to get something from URL
  if (url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      // Extract slug from URL like /article/some-article-title
      const slugMatch = pathname.match(/\/([a-z0-9-]+)\/?$/i);
      if (slugMatch) {
        const slug = slugMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
        if (slug.length > 5 && !isJunkTitle(slug)) {
          return slug;
        }
      }
    } catch (e) {
      // Invalid URL
    }
  }

  // Fall back to anchor text if we have it
  return anchorText?.trim() || null;
}

/**
 * Extract domain for display
 */
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Guess the category based on content
 */
function guessCategory(title, description, url) {
  const text = `${title || ''} ${description || ''} ${url || ''}`.toLowerCase();
  const domain = url ? extractDomain(url) : '';

  // URL/domain based detection (most reliable)
  if (domain) {
    // Apps
    if (domain.includes('apps.apple.com') || domain.includes('play.google.com') ||
        domain.includes('app.') || domain.endsWith('.app')) return 'apps';

    // Streaming services (shows)
    if (['netflix.com', 'hulu.com', 'disneyplus.com', 'max.com', 'hbomax.com',
         'peacocktv.com', 'paramountplus.com', 'appletv.apple.com', 'tv.apple.com',
         'amazon.com/gp/video', 'primevideo.com'].some(d => domain.includes(d) || url?.includes(d))) {
      return 'shows';
    }

    // Videos
    if (['youtube.com', 'youtu.be', 'vimeo.com', 'tiktok.com'].some(d => domain.includes(d))) return 'videos';

    // Music
    if (['spotify.com/track', 'spotify.com/album', 'music.apple.com',
         'soundcloud.com', 'bandcamp.com'].some(d => url?.includes(d))) return 'music';

    // Podcasts
    if (['spotify.com/show', 'podcasts.apple.com', 'pocketcasts.com',
         'overcast.fm', 'castro.fm'].some(d => url?.includes(d))) return 'podcasts';

    // Games
    if (['store.steampowered.com', 'epicgames.com', 'gog.com', 'itch.io',
         'nintendo.com', 'playstation.com', 'xbox.com', 'ea.com'].some(d => domain.includes(d))) return 'games';

    // Books
    if (['amazon.com/dp', 'bookshop.org', 'goodreads.com', 'librarything.com',
         'books.google.com'].some(d => url?.includes(d))) return 'books';

    // Movies (IMDB, TMDB movie pages)
    if (domain.includes('imdb.com') || url?.includes('themoviedb.org/movie')) return 'movies';

    // TV shows (TMDB TV pages)
    if (url?.includes('themoviedb.org/tv')) return 'shows';

    // Gadgets (product pages on major retailers)
    if ((domain.includes('amazon.com') && !url?.includes('/dp/')) ||
        domain.includes('bestbuy.com') || domain.includes('bhphotovideo.com')) return 'gadgets';
  }

  // Text-based detection (fallback)
  if (text.match(/\b(ios|android|iphone|ipad)\s*(app|application)/i)) return 'apps';
  if (text.match(/\b(tv\s*show|series|season\s*\d|episode)/i)) return 'shows';
  if (text.match(/\b(movie|film|cinema|theatrical)/i)) return 'movies';
  if (text.match(/\b(video\s*game|nintendo|playstation|xbox|steam|gaming)/i)) return 'games';
  if (text.match(/\b(podcast|podcasting)/i)) return 'podcasts';
  if (text.match(/\b(book|novel|author|reading|memoir)/i)) return 'books';
  if (text.match(/\b(album|song|track|artist|band|playlist)/i)) return 'music';
  if (text.match(/\b(gadget|device|hardware|accessory)/i)) return 'gadgets';

  return 'articles'; // Default
}

/**
 * Extract recommendations from newsletter HTML
 */
function parseNewsletterContent(html, issueUrl) {
  const $ = cheerio.load(html);
  const recommendations = [];
  const seenUrls = new Set();

  // Remove header, footer, nav, ads
  $('header, footer, nav, [class*="ad-unit"], [class*="newsletter-signup"], aside').remove();

  // Find the main article content - the actual recommendations are in CMS markup divs
  let articleBody = $('[class*="dangerously-set-cms-markup"]').parent();
  if (!articleBody.length) {
    articleBody = $('article').first();
  }
  if (!articleBody.length) {
    articleBody = $('body');
  }

  // Process each link
  articleBody.find('a[href]').each((_, el) => {
    const anchor = $(el);
    let href = anchor.attr('href');

    if (!href) return;

    // Normalize URL
    if (href.startsWith('/')) {
      href = `https://www.theverge.com${href}`;
    }

    // Skip if we've seen this URL or it matches skip patterns
    if (seenUrls.has(href) || shouldSkipUrl(href)) return;
    seenUrls.add(href);

    // Get anchor text
    const anchorText = anchor.text().trim();

    // Skip if title looks like junk
    if (isJunkTitle(anchorText)) return;

    // Get surrounding context
    const parent = anchor.parent();
    const grandparent = parent.parent();
    let context = grandparent.text()?.trim() || parent.text()?.trim() || '';
    context = context.substring(0, 500).replace(/\s+/g, ' ');

    // Try to get a better title
    const title = extractBetterTitle(anchorText, context, href);

    // Skip if we couldn't get a good title
    if (!title || isJunkTitle(title)) return;

    // Determine category
    const category = guessCategory(title, context, href);

    // Check if this looks like a crowdsourced recommendation
    const isCrowdsourced = /—\s*\w+\s*$/.test(context) ||
                          context.toLowerCase().includes('community') ||
                          context.toLowerCase().includes('installer reader');

    // Extract contributor name if crowdsourced
    let contributorName = null;
    if (isCrowdsourced) {
      const match = context.match(/—\s*(\w+)\s*$/);
      if (match) {
        contributorName = match[1];
      }
    }

    recommendations.push({
      title: title,
      url: href,
      description: context.length > 10 ? context : null,
      isPrimaryLink: context.toLowerCase().includes('(link)'),
      isCrowdsourced,
      contributorName,
      sectionName: null,
      category,
    });
  });

  return recommendations;
}

/**
 * Scrape a single newsletter issue
 */
async function scrapeIssue(page, issue) {
  console.log(`\nScraping: ${issue.title || issue.url}`);

  // Skip invalid entries
  if (!issue.url || issue.title?.includes('Comment') || (issue.title && issue.title.length < 10)) {
    console.log('  Skipping invalid entry');
    return [];
  }

  try {
    await page.goto(issue.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await delay(2000);
    await page.waitForSelector('article', { timeout: 10000 }).catch(() => {});

    const html = await page.content();

    // Save raw HTML for backup
    const safeFilename = issue.url.replace(/[^a-z0-9]/gi, '_').substring(0, 100) + '.html';
    const htmlPath = join(config.rawHtmlDir, safeFilename);
    writeFileSync(htmlPath, html);

    // Parse recommendations
    const recommendations = parseNewsletterContent(html, issue.url);

    console.log(`  Found ${recommendations.length} recommendations`);

    // Save to database
    for (const rec of recommendations) {
      dbOperations.addRecommendation({
        issueId: issue.id,
        ...rec,
      });
    }

    // Mark issue as scraped
    dbOperations.markIssueScraped(issue.id, htmlPath);

    return recommendations;

  } catch (error) {
    console.error(`  Error scraping ${issue.url}:`, error.message);
    return [];
  }
}

/**
 * Scrape all unscraped issues
 */
async function scrapeAllIssues() {
  await dbOperations.init();

  const allIssues = dbOperations.getUnscrapedIssues();

  const issues = allIssues.filter(i =>
    i.title &&
    i.title.length > 15 &&
    !i.title.includes('Comment') &&
    !i.title.includes('See All') &&
    i.url &&
    i.url.includes('theverge.com') &&
    (i.url.includes('/installer-newsletter/') || i.url.match(/\/\d{4}\/\d{1,2}\/\d{1,2}\//))
  );

  if (issues.length === 0) {
    console.log('No valid unscraped issues found. Run the archive scraper first.');
    console.log(`(${allIssues.length} total issues in database, but none match criteria)`);
    return;
  }

  console.log(`Found ${issues.length} valid issues to scrape (out of ${allIssues.length} total)\n`);

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  let totalRecs = 0;

  try {
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      console.log(`\n[${i + 1}/${issues.length}]`);

      const recs = await scrapeIssue(page, issue);
      totalRecs += recs.length;

      if (i < issues.length - 1) {
        await delay(config.delayBetweenRequests);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Scraped ${issues.length} issues`);
    console.log(`Total recommendations extracted: ${totalRecs}`);

    const stats = dbOperations.getStats();
    console.log(`\nDatabase stats:`);
    console.log(`  Total issues: ${stats.totalIssues}`);
    console.log(`  Total recommendations: ${stats.totalRecommendations}`);
    console.log(`\n  By category:`);
    for (const cat of stats.byCategory) {
      console.log(`    ${cat.category}: ${cat.count}`);
    }

  } finally {
    await browser.close();
    dbOperations.close();
  }
}

// Run if called directly
scrapeAllIssues()
  .then(() => {
    console.log('\nParsing complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { parseNewsletterContent, scrapeIssue };
