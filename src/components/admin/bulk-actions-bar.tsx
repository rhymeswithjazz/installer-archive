"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { formatCategoryLabel } from "@/lib/utils/format";

interface BulkActionsBarProps {
  selectedCount: number;
  categories: string[];
  onBulkCategory: (category: string) => void;
  onBulkHide: (hidden: boolean) => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  categories,
  onBulkCategory,
  onBulkHide,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <Select onValueChange={onBulkCategory}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Set category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {formatCategoryLabel(cat)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onBulkHide(true)}
      >
        <EyeOff className="h-4 w-4 mr-1" />
        Hide
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onBulkHide(false)}
      >
        <Eye className="h-4 w-4 mr-1" />
        Show
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
      >
        Clear selection
      </Button>
    </div>
  );
}
