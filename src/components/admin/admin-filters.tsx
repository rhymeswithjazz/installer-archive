"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface AdminFiltersProps {
  issues: {
    id: number;
    title: string;
    date: Date | null;
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
    showHidden: boolean;
    deadOnly: boolean;
  };
}

export function AdminFilters({
  issues,
  tags,
  categories,
  initialValues,
}: AdminFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (key: string, value: string | boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 when filters change
      params.delete("page");

      if (typeof value === "boolean") {
        if (value) {
          params.set(key, "true");
        } else {
          params.delete(key);
        }
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      startTransition(() => {
        router.push(`/admin?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    startTransition(() => {
      router.push("/admin");
    });
  }, [router]);

  const hasFilters =
    initialValues.search ||
    initialValues.category ||
    initialValues.issueId ||
    initialValues.tag ||
    !initialValues.showHidden ||
    initialValues.deadOnly;

  return (
    <div className="space-y-4 mb-6 bg-card rounded-lg border p-4">
      {/* Search Input */}
      <div>
        <Input
          type="search"
          placeholder="Search title, URL, or description..."
          defaultValue={initialValues.search}
          onChange={(e) => {
            const value = e.target.value;
            const timeout = setTimeout(() => {
              updateParams("q", value);
            }, 300);
            return () => clearTimeout(timeout);
          }}
          className="max-w-md"
        />
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Category Filter */}
        <Select
          value={initialValues.category || "all"}
          onValueChange={(value) =>
            updateParams("category", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " & ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Issue Filter */}
        <Select
          value={initialValues.issueId?.toString() || "all"}
          onValueChange={(value) =>
            updateParams("issue", value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Issue" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Issues</SelectItem>
            {issues.map((issue) => (
              <SelectItem key={issue.id} value={issue.id.toString()}>
                {issue.title.length > 30
                  ? issue.title.substring(0, 30) + "..."
                  : issue.title}
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
            <SelectTrigger className="w-40">
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

        {/* Checkboxes */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="showHidden"
            checked={initialValues.showHidden}
            onCheckedChange={(checked) =>
              updateParams("showHidden", checked === true ? "" : "false")
            }
          />
          <Label htmlFor="showHidden" className="text-sm cursor-pointer">
            Show hidden
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="deadOnly"
            checked={initialValues.deadOnly}
            onCheckedChange={(checked) =>
              updateParams("deadOnly", checked === true)
            }
          />
          <Label htmlFor="deadOnly" className="text-sm cursor-pointer">
            Dead only
          </Label>
        </div>

        {/* Clear Filters */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        {isPending && (
          <span className="text-sm text-muted-foreground">Loading...</span>
        )}
      </div>
    </div>
  );
}
