"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { BulkActionsBar } from "./bulk-actions-bar";
import { AdminToolbar } from "./admin-toolbar";
import { TagInput, TagInputTrigger } from "./tag-input";
import { ExternalLink, X, Eye, EyeOff, Skull, Pencil, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "@/lib/constants";
import { formatCategoryLabel } from "@/lib/utils/format";
import type { Tag, TagWithCount, IssueRef, AIResultData, Category } from "@/types";

interface Recommendation {
  id: number;
  title: string;
  url: string | null;
  description: string | null;
  category: Category | string; // Allow string for compatibility
  sectionName: string | null;
  isCrowdsourced: boolean;
  contributorName: string | null;
  hidden: boolean;
  dead: boolean;
  issue: IssueRef;
  tags: Tag[];
}

interface AdminTableProps {
  recommendations: Recommendation[];
  tags: TagWithCount[];
  categories: string[];
}


export function AdminTable({ recommendations, tags, categories }: AdminTableProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tagInput, setTagInput] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingRec, setEditingRec] = useState<Recommendation | null>(null);
  const [failedIds, setFailedIds] = useState<Map<number, string>>(new Map());
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "fetching" | "categorizing">("idle");
  const [aiResults, setAiResults] = useState<Map<number, AIResultData>>(new Map());

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
      try {
        await updateRecommendation(id, { category });
      } catch (error) {
        toast.error("Failed to update category", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleToggleHidden = (id: number, currentHidden: boolean) => {
    startTransition(async () => {
      try {
        await updateRecommendation(id, { hidden: !currentHidden });
      } catch (error) {
        toast.error("Failed to update visibility", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleToggleDead = (id: number, currentDead: boolean) => {
    startTransition(async () => {
      try {
        await updateRecommendation(id, { dead: !currentDead });
      } catch (error) {
        toast.error("Failed to update dead status", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleRemoveTag = (recommendationId: number, tagId: number) => {
    startTransition(async () => {
      try {
        await removeTagFromRecommendation(recommendationId, tagId);
      } catch (error) {
        toast.error("Failed to remove tag", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleBulkCategory = (category: string) => {
    if (selected.size === 0) return;

    startTransition(async () => {
      try {
        await bulkUpdateCategory(Array.from(selected), category);
        setSelected(new Set());
        toast.success(`Updated ${selected.size} items to ${category}`);
      } catch (error) {
        toast.error("Failed to bulk update category", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  };

  const handleBulkHide = (hidden: boolean) => {
    if (selected.size === 0) return;

    startTransition(async () => {
      try {
        await bulkHide(Array.from(selected), hidden);
        const count = selected.size;
        setSelected(new Set());
        toast.success(`${hidden ? "Hidden" : "Shown"} ${count} items`);
      } catch (error) {
        toast.error(`Failed to ${hidden ? "hide" : "show"} items`, {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
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
      toast.error("Failed to fetch titles", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Phase 2: AI categorization and tagging
    setEnrichStatus("categorizing");

    try {
      const { results } = await aiCategorizeRecommendations(ids);
      const newAiResults = new Map<number, AIResultData>();

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

      // Show summary toast
      if (newAiResults.size > 0) {
        const totalTags = Array.from(newAiResults.values()).reduce(
          (sum, r) => sum + r.addedTags.length,
          0
        );
        toast.success(`AI processed ${newAiResults.size} items`, {
          description: totalTags > 0 ? `Added ${totalTags} tags` : undefined,
        });
      }
      if (enrichFailedIds.size > 0) {
        toast.error(`${enrichFailedIds.size} items failed`, {
          description: "Check the error icons for details",
        });
      }
    } catch (error) {
      toast.error("AI categorization failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
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
      <BulkActionsBar
        selectedCount={selected.size}
        categories={categories}
        onBulkCategory={handleBulkCategory}
        onBulkHide={handleBulkHide}
        onClearSelection={() => setSelected(new Set())}
      />

      {/* Toolbar */}
      <AdminToolbar
        itemCount={recommendations.length}
        selectedCount={selected.size}
        failedCount={failedIds.size}
        aiResults={aiResults}
        enrichStatus={enrichStatus}
        onAIEnrich={handleAIEnrich}
      />

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
                        className={`${CATEGORY_COLORS[rec.category] || DEFAULT_CATEGORY_COLOR} text-xs`}
                      >
                        {formatCategoryLabel(rec.category)}
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
                      <TagInput
                        allTags={tags}
                        currentTagIds={rec.tags.map((t) => t.id)}
                        onAddTag={(tagName) => {
                          startTransition(async () => {
                            try {
                              await addTagToRecommendation(rec.id, tagName);
                            } catch (error) {
                              toast.error("Failed to add tag", {
                                description: error instanceof Error ? error.message : "Unknown error",
                              });
                            }
                          });
                        }}
                        onClose={() => setTagInput(null)}
                      />
                    ) : (
                      <TagInputTrigger onClick={() => setTagInput(rec.id)} />
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
