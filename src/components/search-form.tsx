"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { UI_TIMING } from "@/lib/constants";
import { formatDateString, formatCategoryLabel } from "@/lib/utils/format";

interface SearchFormProps {
  issues: {
    id: number;
    title: string;
    date: Date | string | null;
  }[];
  tags: {
    id: number;
    name: string;
    _count: { recommendations: number };
  }[];
  categories: string[];
  initialValues: {
    search: string;
    category: string;
    issueId?: number;
    tag: string;
    date: string;
  };
}

export function SearchForm({
  issues,
  tags,
  categories,
  initialValues,
}: SearchFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push("/");
    });
  }, [router]);

  const hasFilters =
    initialValues.search ||
    initialValues.category ||
    initialValues.issueId ||
    initialValues.tag ||
    initialValues.date;

  // Get unique dates from issues, sorted newest to oldest
  // Note: Date objects from server become strings when passed to client components
  const uniqueDates = useMemo(() => {
    return [...new Set(
      issues
        .filter((issue) => issue.date)
        .map((issue) => {
          const date = issue.date!;
          // Handle both Date objects and ISO strings
          const isoString = typeof date === 'string' ? date : date.toISOString();
          return isoString.split("T")[0];
        })
    )].sort((a, b) => b.localeCompare(a));
  }, [issues]);

  return (
    <div className="relative mb-6 p-3 md:p-4 rounded-xl md:rounded-2xl bg-card/30 border border-border/50 backdrop-blur-sm">
      {/* Loading indicator - absolutely positioned */}
      {isPending && (
        <div className="absolute top-2 right-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}

      {/* Search Input - Full width on mobile */}
      <div className="relative group mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input
          type="search"
          placeholder="Search recommendations..."
          defaultValue={initialValues.search}
          onChange={(e) => {
            const value = e.target.value;
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = setTimeout(() => {
              updateParams("q", value);
            }, UI_TIMING.SEARCH_DEBOUNCE_MS);
          }}
          className="w-full pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Filters Grid - 2 columns on mobile, flex on larger screens */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap md:justify-center gap-2 md:gap-3">
        {/* Category Filter */}
        <Select
          value={initialValues.category || "all"}
          onValueChange={(value) =>
            updateParams("category", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-full md:w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {formatCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <Select
            value={initialValues.tag || "all"}
            onValueChange={(value) =>
              updateParams("tag", value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-full md:w-36">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.name}>
                  {tag.name} ({tag._count.recommendations})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Issue Filter */}
        <Select
          value={initialValues.issueId?.toString() || "all"}
          onValueChange={(value) =>
            updateParams("issue", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Issue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Issues</SelectItem>
            {issues.map((issue) => (
              <SelectItem key={issue.id} value={issue.id.toString()}>
                {issue.title.length > 25
                  ? issue.title.substring(0, 25) + "..."
                  : issue.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Filter */}
        <Select
          value={initialValues.date || "all"}
          onValueChange={(value) =>
            updateParams("date", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-full md:w-36">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            {uniqueDates.map((date) => (
              <SelectItem key={date} value={date}>
                {formatDateString(date)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters - below filters on mobile */}
      <div className={`flex justify-center mt-2 transition-opacity ${hasFilters ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 mt-0 overflow-hidden'}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
        >
          Clear filters
        </Button>
      </div>
    </div>
  );
}
