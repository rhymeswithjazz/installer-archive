"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateRecommendation, fetchTitleForRecommendation, addTagToRecommendation, removeTagFromRecommendation } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, X } from "lucide-react";

interface Tag {
  id: number;
  name: string;
}

interface Recommendation {
  id: number;
  title: string;
  url: string | null;
  category: string;
  tags: Tag[];
}

interface EditRecommendationModalProps {
  recommendation: Recommendation | null;
  categories: string[];
  allTags: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditRecommendationModal({
  recommendation,
  categories,
  allTags,
  open,
  onOpenChange,
}: EditRecommendationModalProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Reset form when recommendation changes
  useEffect(() => {
    if (recommendation) {
      setTitle(recommendation.title);
      setUrl(recommendation.url || "");
      setCategory(recommendation.category);
      setTags(recommendation.tags);
      setTagInput("");
    }
  }, [recommendation]);

  const filteredTagSuggestions = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(tagInput.toLowerCase()) &&
      !tags.some((rt) => rt.id === t.id)
  );

  const handleAddTag = (tagName: string) => {
    if (!recommendation || !tagName.trim()) return;
    const normalizedName = tagName.toLowerCase().trim();

    // Check if tag already exists
    if (tags.some((t) => t.name === normalizedName)) {
      setTagInput("");
      return;
    }

    // Optimistically add tag to local state
    const tempTag = { id: Date.now(), name: normalizedName };
    setTags((prev) => [...prev, tempTag]);
    setTagInput("");

    // Sync with server
    startTransition(async () => {
      const result = await addTagToRecommendation(recommendation.id, normalizedName);
      if (result?.tags) {
        setTags(result.tags);
      }
    });
  };

  const handleRemoveTag = (tagId: number) => {
    if (!recommendation) return;

    // Optimistically remove tag from local state
    setTags((prev) => prev.filter((t) => t.id !== tagId));

    // Sync with server
    startTransition(async () => {
      await removeTagFromRecommendation(recommendation.id, tagId);
    });
  };

  const handleSave = async () => {
    if (!recommendation) return;

    setIsSaving(true);
    try {
      await updateRecommendation(recommendation.id, {
        title,
        url: url || null,
        category,
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchTitle = async () => {
    if (!recommendation || !url) return;

    setIsFetchingTitle(true);
    try {
      const result = await fetchTitleForRecommendation(recommendation.id);
      if (result.success && result.title) {
        setTitle(result.title);
      }
    } finally {
      setIsFetchingTitle(false);
    }
  };

  if (!recommendation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Recommendation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">Title</Label>
              {url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFetchTitle}
                  disabled={isFetchingTitle}
                  className="h-7 text-xs"
                >
                  {isFetchingTitle ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3 mr-1" />
                  )}
                  Fetch from URL
                </Button>
              )}
            </div>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
            />
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemoveTag(tag.id)}
                >
                  {tag.name}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
              {tags.length === 0 && (
                <span className="text-sm text-muted-foreground">No tags</span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Add tag..."
                />
                {tagInput && filteredTagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-popover border rounded-md shadow-md z-10">
                    {filteredTagSuggestions.slice(0, 5).map((tag) => (
                      <div
                        key={tag.id}
                        className="px-2 py-1 text-sm cursor-pointer hover:bg-muted"
                        onClick={() => handleAddTag(tag.name)}
                      >
                        {tag.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTag(tagInput)}
                disabled={!tagInput.trim() || isPending}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " & ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
