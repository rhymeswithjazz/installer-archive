"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Archive, FileText, Loader2, Calendar, Type, Link } from "lucide-react";

interface ScrapeResult {
  success: boolean;
  issuesFound?: number;
  issuesScraped?: number;
  recommendationsAdded?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
  debug?: string[];
}

export function ScrapePanel() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [singleUrl, setSingleUrl] = useState("");

  const runScrape = async (action: "archive" | "issues" | "all" | "backfill-dates" | "backfill-titles" | "single-url", url?: string) => {
    setIsLoading(true);
    setCurrentAction(action);
    setResult(null);

    const actionLabels: Record<string, string> = {
      archive: "Archive scrape",
      issues: "Issues scrape",
      all: "Full scrape",
      "backfill-dates": "Date backfill",
      "backfill-titles": "Title extraction",
      "single-url": "URL scrape",
    };

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, url }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        if (action === "single-url") {
          setSingleUrl("");
        }

        // Build success message
        const parts: string[] = [];
        if (data.issuesFound) parts.push(`${data.issuesFound} issues found`);
        if (data.issuesScraped) parts.push(`${data.issuesScraped} scraped`);
        if (data.recommendationsAdded) parts.push(`${data.recommendationsAdded} recommendations added`);
        if (data.updated) parts.push(`${data.updated} updated`);

        toast.success(`${actionLabels[action]} completed`, {
          description: parts.length > 0 ? parts.join(", ") : undefined,
        });
      } else {
        toast.error(`${actionLabels[action]} failed`, {
          description: data.error || "Unknown error",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setResult({
        success: false,
        issuesFound: 0,
        issuesScraped: 0,
        recommendationsAdded: 0,
        errors: [],
        error: errorMessage,
      });
      toast.error(`${actionLabels[action]} failed`, {
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Scraper
        </CardTitle>
        <CardDescription>
          Scrape new newsletters from The Verge
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single URL input */}
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Paste newsletter URL to scrape..."
            value={singleUrl}
            onChange={(e) => setSingleUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => runScrape("single-url", singleUrl)}
            disabled={isLoading || !singleUrl.trim()}
          >
            {isLoading && currentAction === "single-url" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            Scrape URL
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => runScrape("archive")}
            disabled={isLoading}
          >
            {isLoading && currentAction === "archive" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Archive className="h-4 w-4 mr-2" />
            )}
            Scrape Archive
          </Button>
          <Button
            variant="outline"
            onClick={() => runScrape("issues")}
            disabled={isLoading}
          >
            {isLoading && currentAction === "issues" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Scrape Issues
          </Button>
          <Button
            onClick={() => runScrape("all")}
            disabled={isLoading}
          >
            {isLoading && currentAction === "all" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Full Scrape
          </Button>
          <Button
            variant="outline"
            onClick={() => runScrape("backfill-dates")}
            disabled={isLoading}
          >
            {isLoading && currentAction === "backfill-dates" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            Backfill Dates
          </Button>
          <Button
            variant="outline"
            onClick={() => runScrape("backfill-titles")}
            disabled={isLoading}
          >
            {isLoading && currentAction === "backfill-titles" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Type className="h-4 w-4 mr-2" />
            )}
            Extract Titles
          </Button>
        </div>

        {isLoading && (
          <div className="text-sm text-muted-foreground">
            Scraping in progress... This may take a few minutes.
          </div>
        )}

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {result.success ? (
              <div className="space-y-1 text-sm">
                {result.issuesFound !== undefined && (
                  <p>
                    <strong>Issues found:</strong> {result.issuesFound}
                  </p>
                )}
                {result.issuesScraped !== undefined && (
                  <p>
                    <strong>Issues scraped:</strong> {result.issuesScraped}
                  </p>
                )}
                {result.recommendationsAdded !== undefined && (
                  <p>
                    <strong>Recommendations added:</strong> {result.recommendationsAdded}
                  </p>
                )}
                {result.updated !== undefined && (
                  <p>
                    <strong>Updated:</strong> {result.updated}
                  </p>
                )}
                {result.skipped !== undefined && (
                  <p>
                    <strong>Skipped:</strong> {result.skipped}
                  </p>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-2">
                    <strong>Warnings:</strong>
                    <ul className="list-disc list-inside text-yellow-600">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>...and {result.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {result.debug && result.debug.length > 0 && (
                  <div className="mt-2">
                    <strong>Debug info:</strong>
                    <ul className="list-disc list-inside text-muted-foreground text-xs">
                      {result.debug.map((msg, i) => (
                        <li key={i}>{msg}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-500">
                <strong>Error:</strong> {result.error || "Unknown error"}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
