import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { scrapeArchive, scrapeIssues, scrapeAll, backfillDates, backfillTitles, scrapeSingleUrl } from "@/lib/scraper/scraper";

export async function POST(req: NextRequest) {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "all";
    const limit = body.limit;
    const url = body.url;

    let result;

    switch (action) {
      case "archive":
        result = await scrapeArchive();
        break;
      case "issues":
        result = await scrapeIssues(limit);
        break;
      case "backfill-dates":
        result = await backfillDates();
        break;
      case "backfill-titles":
        result = await backfillTitles({ limit: limit || 50 });
        break;
      case "single-url":
        if (!url) {
          return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }
        result = await scrapeSingleUrl(url);
        break;
      case "all":
      default:
        result = await scrapeAll();
        break;
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Scrape failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check authentication
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return scrape status/info
  return NextResponse.json({
    endpoints: {
      POST: {
        description: "Trigger a scrape",
        body: {
          action: "archive | issues | all (default)",
          limit: "number (optional, for issues action)",
        },
      },
    },
  });
}
