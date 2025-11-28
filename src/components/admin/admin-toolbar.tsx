"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import type { AIResultData } from "@/types";

type EnrichStatus = "idle" | "fetching" | "categorizing";

interface AdminToolbarProps {
  itemCount: number;
  selectedCount: number;
  failedCount: number;
  aiResults: Map<number, AIResultData>;
  enrichStatus: EnrichStatus;
  onAIEnrich: () => void;
}

export function AdminToolbar({
  itemCount,
  selectedCount,
  failedCount,
  aiResults,
  enrichStatus,
  onAIEnrich,
}: AdminToolbarProps) {
  const totalTags = Array.from(aiResults.values()).reduce(
    (sum, r) => sum + r.addedTags.length,
    0
  );

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        {itemCount} items
        {failedCount > 0 && (
          <span className="ml-2 text-red-500">
            ({failedCount} failed)
          </span>
        )}
        {aiResults.size > 0 && (
          <span className="ml-2 text-green-500">
            ({aiResults.size} processed
            {totalTags > 0 ? `, +${totalTags} tags` : ""})
          </span>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onAIEnrich}
        disabled={enrichStatus !== "idle" || itemCount === 0}
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
            : selectedCount > 0
              ? `AI Update (${selectedCount})`
              : "AI Update All"}
      </Button>
    </div>
  );
}
