"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateRecommendation,
  addTagToRecommendation,
  removeTagFromRecommendation,
  bulkUpdateCategory,
  bulkHide,
  batchEnrichRecommendations,
  aiCategorizeRecommendations,
} from "@/lib/actions/admin";
import { EditRecommendationModal } from "./edit-recommendation-modal";
import { ExternalLink, X, Eye, EyeOff, Skull, Pencil, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Recommendation {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  category: string;
  sectionName: string | null;
  isCrowdsourced: boolean;
  contributorName: string | null;
  hidden: boolean;
  dead: boolean;
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
}

interface AdminTableProps {
  recommendations: Recommendation[];
  tags: {
    id: number;
    name: string;
    _count: { recommendations: number };
  }[];
  categories: string[];
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

export function AdminTable({ recommendations, tags, categories }: AdminTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tagInput, setTagInput] = useState<number | null>(null);
  const [tagValue, setTagValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingRec, setEditingRec] = useState<Recommendation | null>(null);
  const [failedIds, setFailedIds] = useState<Map<number, string>>(new Map());
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "fetching" | "categorizing">("idle");
  const [aiResults, setAiResults] = useState<Map<number, { category: string; previous: string; confidence: string; reasoning: string; addedTags: string[] }>>(new Map());

  const allSelected = recommendations.length > 0 && selected.size === recommendations.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recommendations.map((r) => r.id)));
    }
  };

  const toggleOne = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleCategoryChange = (id: number, category: string) => {
    startTransition(async () => {
      await updateRecommendation(id, { category });
    });
  };

  const handleToggleHidden = (id: number, currentHidden: boolean) => {
    startTransition(async () => {
      await updateRecommendation(id, { hidden: !currentHidden });
    });
  };

  const handleToggleDead = (id: number, currentDead: boolean) => {
    startTransition(async () => {
      await updateRecommendation(id, { dead: !currentDead });
    });
  };

  const handleAddTag = (id: number) => {
    if (!tagValue.trim()) return;

    startTransition(async () => {
      await addTagToRecommendation(id, tagValue.trim());
      setTagInput(null);
      setTagValue("");
    });
  };

  const handleRemoveTag = (recommendationId: number, tagId: number) => {
    startTransition(async () => {
      await removeTagFromRecommendation(recommendationId, tagId);
    });
  };

  const handleBulkCategory = (category: string) => {
    if (selected.size === 0) return;

    startTransition(async () => {
      await bulkUpdateCategory(Array.from(selected), category);
      setSelected(new Set());
    });
  };

  const handleBulkHide = (hidden: boolean) => {
    if (selected.size === 0) return;

    startTransition(async () => {
      await bulkHide(Array.from(selected), hidden);
      setSelected(new Set());
    });
  };

  const handleAIEnrich = async () => {
    // Use selected items if any, otherwise all visible items
    const ids = selected.size > 0
      ? Array.from(selected)
      : recommendations.map((r) => r.id);

    if (ids.length === 0) return;

    setEnrichStatus("fetching");
    setAiResults(new Map());
    setFailedIds(new Map());

    const enrichFailedIds = new Map<number, string>();

    // Phase 1: Fetch titles from URLs
    try {
      const { results } = await batchEnrichRecommendations(ids);
      for (const result of results) {
        if (!result.success) {
          enrichFailedIds.set(result.id, result.error || "Failed to fetch title");
        }
      }
    } catch (error) {
      console.error("Batch enrich failed:", error);
    }

    // Phase 2: AI categorization and tagging
    setEnrichStatus("categorizing");

    try {
      const { results } = await aiCategorizeRecommendations(ids);
      const newAiResults = new Map<number, { category: string; previous: string; confidence: string; reasoning: string; addedTags: string[] }>();

      for (const result of results) {
        if (result.success && result.category) {
          newAiResults.set(result.id, {
            category: result.category,
            previous: result.previousCategory || "",
            confidence: result.confidence || "unknown",
            reasoning: result.reasoning || "",
            addedTags: result.addedTags || [],
          });
        } else {
          enrichFailedIds.set(result.id, result.error || "AI categorization failed");
        }
      }

      setAiResults(newAiResults);
      setFailedIds(enrichFailedIds);

      // Clear selection after processing
      if (selected.size > 0) {
        setSelected(new Set());
      }
    } catch (error) {
      console.error("AI categorization failed:", error);
      setFailedIds(enrichFailedIds);
    } finally {
      setEnrichStatus("idle");
    }
  };

  const handleEditModalClose = (open: boolean) => {
    if (!open && editingRec) {
      // Clear failed state for this item when modal closes (user may have fixed it)
      setFailedIds((prev) => {
        const next = new Map(prev);
        next.delete(editingRec.id);
        return next;
      });
      setEditingRec(null);
    }
  };

  const filteredTagSuggestions = tags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagValue.toLowerCase()) &&
      !recommendations.find((r) => r.id === tagInput)?.tags.some((rt) => rt.id === t.id)
  );

  return (
    <div className="space-y-4">
      {/* Edit Modal */}
      <EditRecommendationModal
        recommendation={editingRec}
        categories={categories}
        allTags={tags}
        open={editingRec !== null}
        onOpenChange={handleEditModalClose}
      />

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={handleBulkCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Set category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " & ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkHide(true)}
          >
            <EyeOff className="h-4 w-4 mr-1" />
            Hide
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkHide(false)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Show
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {recommendations.length} items
          {failedIds.size > 0 && (
            <span className="ml-2 text-red-500">
              ({failedIds.size} failed)
            </span>
          )}
          {aiResults.size > 0 && (
            <span className="ml-2 text-green-500">
              ({aiResults.size} processed
              {(() => {
                const totalTags = Array.from(aiResults.values()).reduce((sum, r) => sum + r.addedTags.length, 0);
                return totalTags > 0 ? `, +${totalTags} tags` : "";
              })()})
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAIEnrich}
          disabled={enrichStatus !== "idle" || recommendations.length === 0}
        >
          {enrichStatus !== "idle" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {enrichStatus === "fetching"
            ? "Fetching titles..."
            : enrichStatus === "categorizing"
              ? "AI categorizing..."
              : selected.size > 0
                ? `AI Update (${selected.size})`
                : "AI Update All"}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="w-28">Category</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-44">Tags</TableHead>
              <TableHead className="w-36">Issue</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recommendations.map((rec) => (
              <TableRow
                key={rec.id}
                className={`${rec.hidden ? "opacity-50" : ""} ${rec.dead ? "bg-red-500/5" : ""}`}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(rec.id)}
                    onCheckedChange={() => toggleOne(rec.id)}
                  />
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Select
                    value={rec.category}
                    onValueChange={(value) => handleCategoryChange(rec.id, value)}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <Badge
                        className={`${categoryColors[rec.category] || categoryColors.articles} text-xs`}
                      >
                        {rec.category.replace("-", " & ")}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " & ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>

                {/* Title */}
                <TableCell>
                  <div className="space-y-1">
                    <div className={`font-medium ${rec.dead ? "line-through" : ""} flex items-center gap-1`}>
                      {failedIds.has(rec.id) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{failedIds.get(rec.id)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {rec.title.length > 70 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>{rec.title.substring(0, 70)}...</span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-md">
                              <p>{rec.title}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span>{rec.title}</span>
                      )}
                      {rec.dead && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          DEAD
                        </Badge>
                      )}
                      {rec.hidden && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          HIDDEN
                        </Badge>
                      )}
                    </div>
                    {rec.url && (
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {rec.url.length > 50 ? rec.url.substring(0, 50) + "..." : rec.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {rec.contributorName && (
                      <div className="text-xs text-muted-foreground">
                        via {rec.contributorName}
                      </div>
                    )}
                  </div>
                </TableCell>

                {/* Tags */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {rec.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => handleRemoveTag(rec.id, tag.id)}
                      >
                        {tag.name}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}

                    {tagInput === rec.id ? (
                      <div className="relative">
                        <Input
                          value={tagValue}
                          onChange={(e) => setTagValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddTag(rec.id);
                            if (e.key === "Escape") {
                              setTagInput(null);
                              setTagValue("");
                            }
                          }}
                          className="h-6 w-24 text-xs"
                          placeholder="Add tag"
                          autoFocus
                        />
                        {tagValue && filteredTagSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 mt-1 w-32 bg-popover border rounded-md shadow-md z-10">
                            {filteredTagSuggestions.slice(0, 5).map((tag) => (
                              <div
                                key={tag.id}
                                className="px-2 py-1 text-xs cursor-pointer hover:bg-muted"
                                onClick={() => {
                                  setTagValue(tag.name);
                                  handleAddTag(rec.id);
                                }}
                              >
                                {tag.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setTagInput(rec.id)}
                      >
                        +
                      </Button>
                    )}
                  </div>
                </TableCell>

                {/* Issue */}
                <TableCell>
                  <a
                    href={rec.issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    {rec.issue.title.length > 20
                      ? rec.issue.title.substring(0, 20) + "..."
                      : rec.issue.title}
                  </a>
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRec(rec)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleHidden(rec.id, rec.hidden)}
                      title={rec.hidden ? "Show" : "Hide"}
                    >
                      {rec.hidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleDead(rec.id, rec.dead)}
                      title={rec.dead ? "Mark alive" : "Mark dead"}
                      className={rec.dead ? "text-red-500" : ""}
                    >
                      <Skull className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isPending && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          Saving...
        </div>
      )}
    </div>
  );
}
