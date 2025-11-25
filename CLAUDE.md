# Installer Archive

A searchable archive of recommendations from The Verge's Installer Newsletter by David Pierce.

## Overview

This project scrapes, parses, and archives all recommendations from The Verge's Installer Newsletter, providing a searchable web interface and an admin panel for curating the data.

## Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Scraping**: Playwright (browser automation)
- **HTML Parsing**: Cheerio
- **Database**: sql.js (SQLite compiled to WebAssembly)
- **Frontend**: Vanilla JavaScript, CSS
- **Search**: Fuse.js (client-side fuzzy search)
- **Server**: Express.js (admin API)

## Architecture

```
installer-archive/
├── src/
│   ├── config.js      # Configuration constants
│   ├── db.js          # SQLite database operations
│   ├── scraper.js     # Archive page scraper (finds newsletter URLs)
│   ├── parser.js      # Newsletter content parser (extracts recommendations)
│   ├── export.js      # Exports database to JSON
│   └── server.js      # Express server for admin API
├── public/
│   ├── index.html     # Main search interface
│   ├── admin.html     # Admin panel (single file with CSS/JS)
│   ├── app.js         # Main app JavaScript
│   ├── style.css      # Main app styles
│   └── data/
│       └── installer-archive.json  # Exported data for frontend
├── data/
│   ├── installer.db   # SQLite database
│   └── *.json         # Exported JSON files
├── raw-html/          # Cached HTML from scraped pages
└── package.json
```

## Data Flow

1. **Scrape** (`npm run scrape`): Crawls The Verge's Installer Newsletter archive pages, extracts newsletter URLs, and stores them in the database.

2. **Parse** (`npm run parse`): Visits each newsletter URL, extracts recommendation links from the article content, categorizes them, and stores in the database.

3. **Export** (`npm run export`): Exports the SQLite database to JSON files for the frontend.

4. **Build** (`npm run build`): Copies the JSON data to the public folder.

5. **Serve** (`npm run admin`): Runs the Express server with admin API and serves the public files.

## Database Schema

### Issues Table
```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  title TEXT,
  url TEXT UNIQUE,
  date TEXT,
  scraped_at TEXT,
  html_path TEXT
)
```

### Recommendations Table
```sql
CREATE TABLE recommendations (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER,
  title TEXT,
  url TEXT,
  description TEXT,
  category TEXT,
  is_primary_link INTEGER,
  is_crowdsourced INTEGER,
  contributor_name TEXT,
  section_name TEXT,
  FOREIGN KEY (issue_id) REFERENCES issues(id)
)
```

### JSON Export Fields (extended via admin)
- `id`, `issueId`, `title`, `url`, `description`, `category`
- `issueTitle`, `issueDate`, `issueUrl` (denormalized)
- `tags` (array of strings, added via admin)
- `hidden` (boolean, hide from public view)
- `dead` (boolean, marks broken links)

## Categories

Recommendations are auto-categorized based on URL patterns and content:
- `apps` - Mobile/desktop applications
- `shows` - TV series, streaming content
- `movies` - Films
- `games` - Video games
- `books` - Books, ebooks
- `videos` - YouTube, video content
- `music` - Albums, songs, playlists
- `podcasts` - Podcast shows
- `articles` - News, blog posts (default)
- `gadgets` - Hardware, devices

## Commands

```bash
npm run scrape   # Scrape newsletter archive for issue URLs
npm run parse    # Parse each issue for recommendations
npm run export   # Export database to JSON
npm run build    # Copy JSON to public folder
npm run serve    # Static file server (port 3000)
npm run admin    # Admin server with API (port 3000)
```

## Admin Panel Features

### Viewing & Filtering
- Table view of all recommendations
- Filter by category, issue, tag
- Search by title, URL, description
- "Show hidden" toggle to see hidden items
- "Dead only" filter to review broken links

### Editing
- **Title**: Double-click or click "edit" button
  - Debounced auto-save (500ms after typing stops)
  - "saving..." / "saved" indicator
  - Enter to save and close, Escape to cancel
- **URL**: Double-click or click "edit" button
  - Enter to save, Escape to cancel
- **Category**: Dropdown selector (saves immediately)

### Tags
- Add tags with autocomplete from existing tags
- Type to filter suggestions
- Arrow keys to navigate, Tab/Enter to select
- Click suggestion or type new tag name
- Click × to remove tags
- Tags appear in filter dropdown

### Status
- **Hide/Restore**: Hide items from public view
- **Dead/Alive**: Mark broken links
  - Dead links show strikethrough + "DEAD" badge
  - Filtered out of public view automatically

### Bulk Actions
- Checkbox to select multiple items
- Bulk set category
- Bulk hide

## Public Site Features

- Fuzzy search across titles, descriptions, tags
- Filter by category, issue, tag
- Results show category badge, title (linked), description, tags, source issue
- Hidden and dead items automatically filtered out
- Responsive design, dark theme

## Admin API Endpoints

```
GET  /api/recommendations      # List all (with ?category, ?issueId, ?search filters)
GET  /api/issues               # List all issues
GET  /api/stats                # Get counts and category breakdown
PATCH /api/recommendations/:id # Update fields (category, title, url, tags, hidden, dead)
POST /api/recommendations/bulk-update  # Bulk update category
DELETE /api/recommendations/:id # Hide a recommendation
```

## Scraping Details

### Archive Scraper (`scraper.js`)
- Starts at `/installer-newsletter/archives`
- Paginates through archive pages
- Filters URLs matching newsletter patterns:
  - `/installer-newsletter/[id]/[slug]`
  - `/YYYY/MM/DD/[id]/[slug]`
- Skips navigation, comment links, author pages

### Content Parser (`parser.js`)
- Loads each newsletter page with Playwright
- Extracts links from `[class*="dangerously-set-cms-markup"]` elements
- Filters out:
  - Verge internal pages (ethics, privacy, terms, etc.)
  - Social media share links
  - Navigation/footer links
  - Short or junk titles
- Auto-categorizes based on URL domain and content keywords
- Saves raw HTML to `raw-html/` for debugging

## Configuration (`src/config.js`)

```javascript
export const config = {
  archiveUrl: 'https://www.theverge.com/installer-newsletter',
  baseUrl: 'https://www.theverge.com',
  delayBetweenRequests: 2000,  // Be respectful
  maxRetries: 3,
  timeout: 30000,
  dbPath: './data/installer.db',
  rawHtmlDir: './raw-html',
  headless: true,
  userAgent: '...'
};
```

## Development Notes

### Re-scraping
To reset and re-scrape everything:
```bash
rm -f data/installer.db
npm run scrape
npm run parse
npm run export
npm run build
```

### Database Location
The SQLite database is at `data/installer.db`. The admin panel modifies `data/installer-archive.json` directly and also updates `public/data/installer-archive.json`.

### Adding New Categories
1. Add to `categories` array in `src/config.js`
2. Add URL/content patterns in `guessCategory()` in `src/parser.js`
3. Add option to dropdowns in `public/index.html` and `public/admin.html`
4. Add CSS color variable in `public/style.css`

## Credits

- Data source: [The Verge's Installer Newsletter](https://www.theverge.com/installer-newsletter) by David Pierce
- This is an unofficial archive. All content belongs to Vox Media / The Verge.
