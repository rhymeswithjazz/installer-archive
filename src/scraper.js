/**
 * Archive Scraper
 * Collects all Installer newsletter issue URLs from The Verge archive pages
 */

import { chromium } from 'playwright';
import { config } from './config.js';
import dbOperations from './db.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrapeArchivePage(page, url) {
  console.log(`Scraping archive page: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Give the page time to load dynamic content
  await delay(3000);

  // Extract newsletter issue links - be very specific about what we want
  const issues = await page.evaluate(() => {
    const results = [];
    const seen = new Set();

    // Find all links on the page
    const allLinks = document.querySelectorAll('a[href]');

    for (const link of allLinks) {
      const href = link.href;
      const text = link.textContent?.trim() || '';

      // Skip if already seen
      if (seen.has(href)) continue;

      // Must be a Verge URL
      if (!href.includes('theverge.com')) continue;

      // Skip obvious non-article links
      if (href.includes('/authors/') ||
          href.includes('/ethics-statement') ||
          href.includes('twitter.com') ||
          href.includes('facebook.com') ||
          href.includes('#comments') ||
          href.endsWith('/installer-newsletter') ||
          href.endsWith('/installer-newsletter/')) continue;

      // Check for newsletter article patterns:
      // Pattern 1: /installer-newsletter/[id]/[slug]
      // Pattern 2: /YYYY/MM/DD/[id]/[slug] with installer in URL
      const isInstallerNewsletterUrl = href.match(/\/installer-newsletter\/\d+\/[\w-]+/) !== null;
      const isDateBasedInstallerUrl = href.match(/\/\d{4}\/\d{1,2}\/\d{1,2}\/\d+\/.*installer/) !== null;

      if (isInstallerNewsletterUrl || isDateBasedInstallerUrl) {
        // Validate the title - must be a real headline, not UI text
        const isValidTitle = text.length > 15 &&
                            text.length < 200 &&
                            !text.includes('Comment') &&
                            !text.includes('See All') &&
                            !text.includes('Icon') &&
                            !text.match(/^\d+$/) && // Not just numbers
                            !text.startsWith('By ');

        if (isValidTitle) {
          seen.add(href);
          results.push({
            url: href,
            title: text,
          });
        }
      }
    }

    return results;
  });

  return issues;
}

async function scrapeAllArchivePages() {
  console.log('Starting Installer Newsletter archive scrape...\n');

  // Initialize database
  await dbOperations.init();

  const browser = await chromium.launch({
    headless: config.headless,
  });

  const context = await browser.newContext({
    userAgent: config.userAgent,
  });

  const page = await context.newPage();

  let allIssues = [];

  // The Verge archive pages - check more pages to be thorough
  const archiveUrls = [
    config.archiveUrl,
    `${config.archiveUrl}/archives/2`,
    `${config.archiveUrl}/archives/3`,
    `${config.archiveUrl}/archives/4`,
    `${config.archiveUrl}/archives/5`,
    `${config.archiveUrl}/archives/6`,
    `${config.archiveUrl}/archives/7`,
    `${config.archiveUrl}/archives/8`,
  ];

  try {
    for (let i = 0; i < archiveUrls.length; i++) {
      const currentUrl = archiveUrls[i];

      console.log(`\n--- Page ${i + 1} ---`);

      const issues = await scrapeArchivePage(page, currentUrl);
      console.log(`Found ${issues.length} newsletter issues on this page`);

      // If we get 0 issues, we've probably hit the end
      if (issues.length === 0) {
        console.log('No more issues found, stopping pagination.');
        break;
      }

      allIssues = allIssues.concat(issues);
      await delay(config.delayBetweenRequests);
    }

    // Deduplicate by URL
    const uniqueIssues = [];
    const seenUrls = new Set();
    for (const issue of allIssues) {
      if (!seenUrls.has(issue.url)) {
        seenUrls.add(issue.url);
        uniqueIssues.push(issue);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total unique newsletter issues found: ${uniqueIssues.length}`);

    // Save to database
    console.log('\nSaving to database...');
    let newCount = 0;
    for (const issue of uniqueIssues) {
      // Try to extract date from URL
      let date = null;
      const dateMatch = issue.url.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
      if (dateMatch) {
        date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }

      const result = dbOperations.addIssue({
        title: issue.title,
        url: issue.url,
        date: date,
      });

      if (result.changes > 0) {
        newCount++;
        console.log(`  + ${issue.title.substring(0, 50)}`);
      }
    }

    console.log(`\nAdded ${newCount} new issues to database`);

    const stats = dbOperations.getStats();
    console.log(`Total issues in database: ${stats.totalIssues}`);

    return uniqueIssues;

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    await browser.close();
    dbOperations.close();
  }
}

// Run if called directly
scrapeAllArchivePages()
  .then(() => {
    console.log('\nScraping complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
