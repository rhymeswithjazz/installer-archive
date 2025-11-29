import { Suspense } from "react";
import { getRecommendations, getIssues, getStats, getTags } from "@/lib/actions/recommendations";
import { SearchForm } from "@/components/search-form";
import { RecommendationCard } from "@/components/recommendation-card";
import { Pagination } from "@/components/admin/pagination";
import { ThemeToggle } from "@/components/theme-toggle";
import { CATEGORIES, type RecommendationWithIssue } from "@/types";
import { Sparkles, Newspaper } from "lucide-react";
import Image from "next/image";
import iconSvg from "./icon.svg";

/** Type for recommendation list item */
type RecommendationItem = Omit<RecommendationWithIssue, "hidden" | "dead" | "issueId">;

const DEFAULT_PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    issue?: string;
    tag?: string;
    page?: string;
    pageSize?: string;
    date?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.q || "";
  const category = params.category || "";
  const issueId = params.issue ? parseInt(params.issue) : undefined;
  const tag = params.tag || "";
  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const date = params.date || "";

  const [{ recommendations, total }, issues, stats, tags] = await Promise.all([
    getRecommendations({
      search,
      category,
      issueId,
      tag,
      date,
      limit: pageSize,
      offset,
    }),
    getIssues(),
    getStats(),
    getTags(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 py-6 md:py-8 backdrop-blur-sm bg-background/80 relative">
        <div className="absolute top-3 right-3 md:top-4 md:right-4">
          <ThemeToggle />
        </div>
        <div className="container mx-auto px-4">
          <div className="text-center space-y-2 md:space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3">
              <div className="p-2 md:p-2.5 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20">
                <Image src={iconSvg} alt="Installer Archive" className="h-7 w-7 md:h-9 md:w-9" />
              </div>
              <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Installer Archive
              </h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground max-w-xl mx-auto px-2">
              Search recommendations from{" "}
              <a
                href="https://www.theverge.com/installer-newsletter"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline decoration-primary/30 hover:decoration-primary/60 underline-offset-4 transition-colors"
              >
                The Verge&apos;s Installer Newsletter
              </a>{" "}
              by David Pierce
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        {/* Search and Filters */}
        <SearchForm
          issues={issues}
          tags={tags}
          categories={[...CATEGORIES]}
          initialValues={{ search, category, issueId, tag, date }}
        />

        {/* Stats */}
        <div className="flex flex-wrap gap-3 md:gap-6 justify-center items-center mb-6 md:mb-8">
          <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-card/50 border border-border/50 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
            <span className="text-xs md:text-sm">
              <strong className="text-foreground font-semibold">{stats.visibleRecommendations.toLocaleString()}</strong>
              <span className="text-muted-foreground"> recommendations</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-card/50 border border-border/50 backdrop-blur-sm">
            <Newspaper className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-400" />
            <span className="text-xs md:text-sm">
              <strong className="text-foreground font-semibold">{stats.totalIssues.toLocaleString()}</strong>
              <span className="text-muted-foreground"> issues</span>
            </span>
          </div>
        </div>

        {/* Pagination - Top */}
        <Suspense fallback={null}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={total}
            basePath="/"
          />
        </Suspense>

        {/* Results */}
        {recommendations.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
              <Image src={iconSvg} alt="" className="h-8 w-8 opacity-50" />
            </div>
            <p className="text-lg text-muted-foreground">No recommendations found</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {(recommendations as RecommendationItem[]).map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>
        )}

        {/* Pagination - Bottom */}
        {recommendations.length > 0 && (
          <Suspense fallback={null}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              basePath="/"
            />
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 mt-12 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Data sourced from{" "}
            <a
              href="https://www.theverge.com/installer-newsletter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline decoration-primary/30 hover:decoration-primary/60 underline-offset-4 transition-colors"
            >
              The Verge&apos;s Installer Newsletter
            </a>
          </p>
          <p className="text-xs text-muted-foreground/60">
            Unofficial archive. All content belongs to Vox Media / The Verge.
          </p>
        </div>
      </footer>
    </div>
  );
}
