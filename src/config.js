// Configuration for the Installer Archive scraper

export const config = {
  // Base URLs
  archiveUrl: 'https://www.theverge.com/installer-newsletter',
  baseUrl: 'https://www.theverge.com',

  // Scraping settings
  delayBetweenRequests: 2000, // ms - be respectful
  maxRetries: 3,
  timeout: 30000,

  // File paths
  dbPath: './data/installer.db',
  rawHtmlDir: './raw-html',

  // Browser settings
  headless: true,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Known categories in Installer newsletter
export const categories = [
  'apps',
  'games',
  'shows',
  'movies',
  'podcasts',
  'music',
  'books',
  'articles',
  'tips',
  'gadgets',
  'crowdsourced',
  'other'
];
