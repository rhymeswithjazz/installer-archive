# Installer Archive

A searchable archive of recommendations from The Verge's Installer Newsletter by David Pierce.

## Overview

This project scrapes, parses, and archives all recommendations from The Verge's Installer Newsletter, providing a searchable web interface and an admin panel for curating the data.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite via Prisma ORM
- **Auth**: NextAuth v5 (credentials provider)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Scraping**: Playwright (browser automation)
- **Deployment**: Docker

## Architecture

```
installer-archive/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Public homepage (search/filter)
│   │   ├── login/page.tsx        # Login page
│   │   ├── admin/page.tsx        # Admin dashboard
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── scrape/route.ts   # Scrape trigger API
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── admin/                # Admin-specific components
│   │   ├── search-form.tsx       # Public search filters
│   │   └── recommendation-card.tsx
│   ├── lib/
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── actions/
│   │   │   ├── recommendations.ts # Public data queries
│   │   │   └── admin.ts          # Admin CRUD operations
│   │   └── scraper/
│   │       ├── config.ts         # Scraper configuration
│   │       ├── parser.ts         # Newsletter content parser
│   │       └── scraper.ts        # Main scraper logic
│   └── types/index.ts            # Type definitions
├── prisma/
│   └── schema.prisma             # Database schema
├── scripts/
│   └── seed.ts                   # Database seeding script
├── data/
│   └── installer.db              # SQLite database
├── Dockerfile
├── docker-compose.yml
└── docker-entrypoint.sh
```

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String   // bcrypt hashed
  name      String?
}

model Issue {
  id              Int              @id @default(autoincrement())
  title           String
  url             String           @unique
  date            DateTime?
  scrapedAt       DateTime?
  recommendations Recommendation[]
}

model Recommendation {
  id              Int      @id @default(autoincrement())
  title           String
  url             String?
  description     String?
  category        String   @default("articles")
  sectionName     String?
  isPrimaryLink   Boolean  @default(false)
  isCrowdsourced  Boolean  @default(false)
  contributorName String?
  hidden          Boolean  @default(false)
  dead            Boolean  @default(false)
  issue           Issue    @relation(...)
  issueId         Int
  tags            Tag[]
}

model Tag {
  id              Int              @id @default(autoincrement())
  name            String           @unique
  recommendations Recommendation[]
}
```

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
- `food-drink` - Recipes, restaurants, beverages

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server

# Database
npx prisma migrate dev    # Run migrations in development
npx prisma migrate deploy # Run migrations in production
npx prisma studio         # Open Prisma Studio GUI
npx tsx scripts/seed.ts   # Seed database with initial data
```

## Environment Variables

```bash
# Database
DATABASE_URL="file:./data/installer.db"

# NextAuth
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# Admin (for Docker deployment)
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="your-secure-password"
```

## Public Site Features

- Search across titles, descriptions, URLs
- Filter by category, issue, tag
- Results show category badge, title (linked), description, tags, source issue
- Hidden and dead items automatically filtered out
- Responsive design, dark theme

## Admin Panel Features

### Authentication
- Email/password login via NextAuth
- Protected by middleware (`/admin/*` routes)

### Viewing & Filtering
- Table view of all recommendations
- Filter by category, issue, tag
- Search by title, URL, description
- "Show hidden" toggle to see hidden items
- "Dead only" filter to review broken links

### Editing
- **Title**: Double-click to edit inline
- **URL**: Double-click to edit inline
- **Category**: Dropdown selector (saves immediately)
- **Tags**: Add/remove with autocomplete

### Status Actions
- **Hide/Show**: Toggle visibility on public site
- **Dead/Alive**: Mark broken links

### Bulk Actions
- Select multiple items with checkboxes
- Bulk set category
- Bulk hide/show

### Scraper Panel
- **Scrape Archive**: Find new newsletter URLs
- **Scrape Issues**: Parse unscraped newsletters
- **Full Scrape**: Run both operations

## API Endpoints

### Public (Server Actions)
- `getRecommendations(params)` - List visible recommendations
- `getIssues()` - List all issues
- `getTags()` - List all tags with counts
- `getStats()` - Get counts and category breakdown

### Admin (Server Actions)
- `updateRecommendation(id, data)` - Update fields
- `addTagToRecommendation(id, tagName)` - Add tag
- `removeTagFromRecommendation(id, tagId)` - Remove tag
- `bulkUpdateCategory(ids, category)` - Bulk update
- `bulkHide(ids, hidden)` - Bulk hide/show

### Scrape API
```
POST /api/scrape
Body: { action: "archive" | "issues" | "all", limit?: number }
```

## Scraping Details

### How It Works
1. **Archive Scraper**: Crawls `/installer-newsletter/archives` pages to find newsletter URLs
2. **Issue Parser**: Visits each newsletter, extracts `__NEXT_DATA__` JSON to bypass paywall, parses recommendations

### Parser Features
- Extracts from `__NEXT_DATA__` JSON (bypasses The Verge's paywall)
- Tracks section names (intro, screen_share, crowdsourced, signing_off)
- Captures contributor names from crowdsourced sections
- Auto-categorizes based on URL domain and content keywords
- Filters out navigation, social, and junk links

## Docker Deployment

### Build and Run
```bash
# Copy environment template
cp .env.example .env
# Edit .env with your values

# Build and start
docker-compose up -d
```

### Docker Compose
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/installer.db
      - AUTH_SECRET=${AUTH_SECRET}
      - ADMIN_EMAIL=${ADMIN_EMAIL}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    volumes:
      - installer-data:/app/data
```

### Entrypoint
The Docker entrypoint automatically:
1. Runs Prisma migrations
2. Creates admin user if ADMIN_EMAIL and ADMIN_PASSWORD are set
3. Starts the Next.js server

## Development Notes

### Adding New Categories
1. Add to `CATEGORIES` array in `src/types/index.ts`
2. Add URL/content patterns in `guessCategory()` in `src/lib/scraper/parser.ts`
3. Add color mapping in `categoryColors` in `src/components/recommendation-card.tsx` and `src/components/admin/admin-table.tsx`

### Re-scraping
To trigger a re-scrape, either:
- Use the Scrape Panel in the admin interface
- Call the API: `POST /api/scrape { "action": "all" }`
- Reset and re-seed the database

### Database Location
SQLite database is at `data/installer.db`. All changes persist directly to the database (no JSON export needed).

## Credits

- Data source: [The Verge's Installer Newsletter](https://www.theverge.com/installer-newsletter) by David Pierce
- This is an unofficial archive. All content belongs to Vox Media / The Verge.
