/**
 * Test parser on a few issues
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from './config.js';
import dbOperations from './db.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

mkdirSync(config.rawHtmlDir, { recursive: true });

/**
 * Extract recommendations from newsletter HTML (simplified for testing)
 */
function parseNewsletterContent(html) {
  const $ = cheerio.load(html);
  const recommendations = [];

  // Remove navigation, footer, ads
  $('nav, footer, [class*="ad-"], [class*="newsletter-signup"], [class*="sidebar"]').remove();

  // Get the main article content
  const articleContent = $('article').first();
  const content$ = articleContent.length ? cheerio.load(articleContent.html() || '') : $;

  // Extract all links with context
  content$('a').each((_, el) => {
    const anchor = content$(el);
    const href = anchor.attr('href');
    const text = anchor.text().trim();

    // Skip navigation, self-references, and social links
    if (!href ||
        href.startsWith('#') ||
        href.includes('theverge.com/installer-newsletter') ||
        href.includes('twitter.com') ||
        href.includes('facebook.com') ||
        href.includes('mailto:') ||
        text.length < 3) {
      return;
    }

    // Get surrounding context
    const parent = anchor.parent();
    const context = parent.text().trim().substring(0, 300);

    // Check for "(link)" pattern
    const isPrimary = context.toLowerCase().includes('(link)');

    recommendations.push({
      title: text,
      url: href,
      description: context,
      isPrimaryLink: isPrimary,
    });
  });

  return recommendations;
}

async function testParser() {
  console.log('Initializing...');
  await dbOperations.init();

  // Get a few valid issues
  const allIssues = dbOperations.getAllIssues();
  const validIssues = allIssues
    .filter(i => i.title && i.title.length > 15 && !i.title.includes('Comment'))
    .slice(0, 3);

  console.log(`Testing with ${validIssues.length} issues:\n`);
  validIssues.forEach(i => console.log(`  - ${i.title}`));

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ userAgent: config.userAgent });
  const page = await context.newPage();

  for (const issue of validIssues) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Scraping: ${issue.title}`);
    console.log(`URL: ${issue.url}`);
    console.log('='.repeat(60));

    try {
      await page.goto(issue.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delay(3000);

      const html = await page.content();

      // Save HTML for debugging
      const filename = `test-${issue.id}.html`;
      writeFileSync(join(config.rawHtmlDir, filename), html);
      console.log(`Saved HTML to ${filename}`);

      const recommendations = parseNewsletterContent(html);
      console.log(`\nFound ${recommendations.length} links:`);

      // Show first 10 recommendations
      recommendations.slice(0, 10).forEach((rec, i) => {
        console.log(`\n  ${i + 1}. ${rec.title.substring(0, 50)}`);
        console.log(`     URL: ${rec.url?.substring(0, 60)}...`);
        console.log(`     Primary: ${rec.isPrimaryLink}`);
      });

      if (recommendations.length > 10) {
        console.log(`\n  ... and ${recommendations.length - 10} more`);
      }

      await delay(config.delayBetweenRequests);

    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }

  await browser.close();
  console.log('\nTest complete!');
}

testParser().catch(console.error);
