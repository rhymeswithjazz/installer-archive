import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { getAdminRecommendations, getAllTags } from "@/lib/actions/admin";
import { getIssues, getStats } from "@/lib/actions/recommendations";
import { AdminTable } from "@/components/admin/admin-table";
import { AdminFilters } from "@/components/admin/admin-filters";
import { ScrapePanel } from "@/components/admin/scrape-panel";
import { Pagination } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/types";

const DEFAULT_PAGE_SIZE = 50;

interface AdminPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    issue?: string;
    tag?: string;
    showHidden?: string;
    deadOnly?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.q || "";
  const category = params.category || "";
  const issueId = params.issue ? parseInt(params.issue) : undefined;
  const tag = params.tag || "";
  const showHidden = params.showHidden !== "false";
  const deadOnly = params.deadOnly === "true";
  const page = params.page ? parseInt(params.page) : 1;
  const pageSize = params.pageSize ? parseInt(params.pageSize) : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const [{ recommendations, total }, issues, stats, tags] = await Promise.all([
    getAdminRecommendations({
      search,
      category,
      issueId,
      tag,
      showHidden,
      deadOnly,
      limit: pageSize,
      offset,
    }),
    getIssues(),
    getStats(),
    getAllTags(),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Manage recommendations, tags, and content
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.totalRecommendations}</div>
            <div className="text-sm text-muted-foreground">Total Recommendations</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.visibleRecommendations}</div>
            <div className="text-sm text-muted-foreground">Visible</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.totalRecommendations - stats.visibleRecommendations}</div>
            <div className="text-sm text-muted-foreground">Hidden</div>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="text-2xl font-bold">{stats.totalIssues}</div>
            <div className="text-sm text-muted-foreground">Issues</div>
          </div>
        </div>

        {/* Scrape Panel */}
        <div className="mb-6">
          <ScrapePanel />
        </div>

        {/* Filters */}
        <Suspense fallback={<div>Loading filters...</div>}>
          <AdminFilters
            issues={issues}
            tags={tags}
            categories={[...CATEGORIES]}
            initialValues={{
              search,
              category,
              issueId,
              tag,
              showHidden,
              deadOnly,
            }}
          />
        </Suspense>

        {/* Pagination - Top */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={total}
        />

        {/* Table */}
        <AdminTable
          recommendations={recommendations}
          tags={tags}
          categories={[...CATEGORIES]}
        />

        {/* Pagination - Bottom */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={total}
        />
      </main>
    </div>
  );
}
