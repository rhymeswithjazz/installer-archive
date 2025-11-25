# Installer Archive

A scraper and searchable archive for [The Verge's Installer Newsletter](https://www.theverge.com/installer-newsletter) by David Pierce.

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Step 1: Scrape the archive index to get all newsletter URLs
npm run scrape

# Step 2: Parse each newsletter to extract recommendations
npm run parse

# Step 3: Export to JSON for frontend
node src/export.js
```

## Project Structure

```
installer-archive/
├── src/
│   ├── config.js      # Configuration settings
│   ├── db.js          # SQLite database operations
│   ├── scraper.js     # Archive page scraper (collects issue URLs)
│   ├── parser.js      # Newsletter parser (extracts recommendations)
│   └── export.js      # Export to JSON
├── data/
│   └── installer.db   # SQLite database
├── raw-html/          # Backup of scraped HTML
└── package.json
```

## How It Works

### 1. Archive Scraper (`npm run scrape`)
- Navigates to the Installer Newsletter archive page
- Finds all newsletter issue links across pagination
- Stores issue URLs and dates in SQLite

### 2. Parser (`npm run parse`)
- Visits each unscraped newsletter issue
- Extracts recommendations using:
  - The distinctive "(link)" pattern for primary recommendations
  - All other links with surrounding context
- Categorizes recommendations (apps, games, shows, etc.)
- Identifies crowdsourced/reader submissions
- Saves raw HTML as backup

### 3. Export (`node src/export.js`)
- Exports database to JSON for frontend use
- Creates category-specific JSON files

## Data Model

**Issues** (newsletter editions)
- title, url, date, issue_number

**Recommendations**
- title, url, description
- category (apps, games, shows, movies, podcasts, etc.)
- is_primary_link (the "(link)" format)
- is_crowdsourced (reader submissions)
- section_name

## Configuration

Edit `src/config.js` to adjust:
- `delayBetweenRequests` - Be respectful of The Verge's servers
- `headless` - Set to false to watch the browser
- File paths

## Next Steps

After scraping, you can:
1. Build a frontend using the exported JSON
2. Use the SQLite database directly for queries
3. Set up scheduled runs to capture new issues
