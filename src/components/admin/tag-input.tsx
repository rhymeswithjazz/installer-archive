"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TagWithCount } from "@/types";

interface TagInputProps {
  allTags: TagWithCount[];
  currentTagIds: number[];
  onAddTag: (tagName: string) => void;
  onClose: () => void;
}

export function TagInput({
  allTags,
  currentTagIds,
  onAddTag,
  onClose,
}: TagInputProps) {
  const [value, setValue] = useState("");

  const filteredSuggestions = allTags.filter(
    (t) =>
      t.name.toLowerCase().includes(value.toLowerCase()) &&
      !currentTagIds.includes(t.id)
  );

  const handleSubmit = () => {
    if (value.trim()) {
      onAddTag(value.trim());
      setValue("");
      onClose();
    }
  };

  const handleSelectSuggestion = (tagName: string) => {
    onAddTag(tagName);
    setValue("");
    onClose();
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") {
            setValue("");
            onClose();
          }
        }}
        className="h-6 w-24 text-xs"
        placeholder="Add tag"
        autoFocus
      />
      {value && filteredSuggestions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-32 bg-popover border rounded-md shadow-md z-10">
          {filteredSuggestions.slice(0, 5).map((tag) => (
            <div
              key={tag.id}
              className="px-2 py-1 text-xs cursor-pointer hover:bg-muted"
              onClick={() => handleSelectSuggestion(tag.name)}
            >
              {tag.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TagInputTriggerProps {
  onClick: () => void;
}

export function TagInputTrigger({ onClick }: TagInputTriggerProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-xs"
      onClick={onClick}
    >
      +
    </Button>
  );
}
