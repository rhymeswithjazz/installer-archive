import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Calendar } from "lucide-react";

// Format date without timezone issues
function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

interface RecommendationCardProps {
  recommendation: {
    id: number;
    title: string;
    url: string | null;
    description: string | null;
    category: string;
    sectionName: string | null;
    isCrowdsourced: boolean;
    contributorName: string | null;
    issue: {
      id: number;
      title: string;
      url: string;
      date: Date | null;
    };
    tags: {
      id: number;
      name: string;
    }[];
  };
}

const categoryColors: Record<string, string> = {
  apps: "bg-green-500/15 text-green-500",
  shows: "bg-pink-500/15 text-pink-500",
  movies: "bg-amber-500/15 text-amber-500",
  games: "bg-violet-500/15 text-violet-500",
  books: "bg-cyan-500/15 text-cyan-500",
  videos: "bg-red-500/15 text-red-500",
  music: "bg-teal-500/15 text-teal-500",
  podcasts: "bg-orange-500/15 text-orange-500",
  articles: "bg-slate-500/15 text-slate-400",
  gadgets: "bg-lime-500/15 text-lime-500",
  "food-drink": "bg-pink-400/15 text-pink-400",
  blog: "bg-indigo-500/15 text-indigo-500",
  website: "bg-sky-500/15 text-sky-500",
};

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const domain = recommendation.url ? extractDomain(recommendation.url) : "";

  return (
    <Card className="group hover:bg-accent/30 transition-all duration-200 border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="flex gap-4 p-4">
        {/* Category Badge */}
        <div className="flex-shrink-0">
          <Badge
            variant="secondary"
            className={`${categoryColors[recommendation.category] || categoryColors.articles} transition-transform group-hover:scale-105`}
          >
            {recommendation.category.replace("-", " & ")}
          </Badge>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <h3 className="font-semibold text-base leading-tight">
            {recommendation.url ? (
              <a
                href={recommendation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group/link"
              >
                <span>{recommendation.title}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover/link:opacity-60 transition-opacity flex-shrink-0" />
              </a>
            ) : (
              recommendation.title
            )}
          </h3>

          {/* Tags */}
          {recommendation.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recommendation.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {domain && (
              <span className="text-muted-foreground/70 font-mono">{domain}</span>
            )}
            <a
              href={recommendation.issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              <span>{formatDate(recommendation.issue.date)}</span>
            </a>
            {recommendation.contributorName && (
              <span className="text-purple-400/80">
                via {recommendation.contributorName}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
