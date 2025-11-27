# Categorization System

## Current Approach

The categorization system attempts to automatically assign categories to recommendations based on URL patterns and page content.

### Categories

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
- `food-drink` - Recipes, restaurants, beverages
- `blog` - Personal blogs
- `website` - General websites/tools

### Implementation

Located in `src/lib/scraper/parser.ts` - `guessCategory()` function.

**Domain-based matching** (high confidence):
- App stores → `apps`
- Streaming services (Netflix, Hulu, etc.) → `shows`
- YouTube, Vimeo, TikTok → `videos`
- Spotify tracks/albums, Apple Music → `music`
- Podcast platforms (Spotify shows, Apple Podcasts, Overcast) → `podcasts`
- Game stores (Steam, Epic, etc.) → `games`
- Book sites (Goodreads, Bookshop.org) → `books`
- IMDb → `movies`
- Food sites (Serious Eats, Bon Appétit, etc.) → `food-drink`

**Text-based matching** (conservative):
- Only used when domain doesn't match
- Requires specific patterns to avoid false positives
- Falls back to `articles` when uncertain

## Problems Encountered

### Over-categorization Issues

1. **Shows** - Initial patterns like "series", "episode" were too broad. Many articles got miscategorized as shows.
   - Fixed: Tightened to require "tv series", "season X episode", etc.

2. **Podcasts** - Matching "podcast" in text caught articles *about* podcasts.
   - Fixed: Removed text-based matching entirely. Now relies only on domain detection.

3. **General issue** - Text-based heuristics are inherently flawed. Common words appear in many contexts.

## Batch Enrichment

The admin panel has an "Enrich All" button that:
1. Fetches each URL to extract the page title
2. Runs the categorization logic
3. Updates the database
4. Shows failures with a red indicator

Failed items (timeouts, blocked requests, etc.) show a warning icon that clears when manually edited.

## Future: LLM-based Categorization

The heuristic approach has significant limitations. Plan to implement LLM-based categorization:

### Approach
- Send the page title, URL, and optionally a snippet of content to an LLM
- Ask it to categorize into one of our predefined categories
- LLM can understand context and nuance that regex patterns cannot

### Benefits
- Better understanding of content context
- Can distinguish "article about podcasts" vs "actual podcast"
- Can handle edge cases and ambiguous content
- More accurate categorization with less manual correction

### Considerations
- Cost per API call (batch wisely)
- Rate limiting
- Fallback to heuristics if LLM unavailable
- Caching results to avoid re-processing

### Implementation Notes
- Could use Claude API or OpenAI
- Batch multiple items per request to reduce costs
- Consider confidence scores - only update if confident
- May want to show LLM's reasoning for transparency
