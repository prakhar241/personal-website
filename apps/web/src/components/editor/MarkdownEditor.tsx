"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Eye, Edit3, Save, Send, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Lazy-load the markdown editor (it's heavy)
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  initialContent?: string;
  initialTitle?: string;
  initialExcerpt?: string;
  initialTags?: string[];
  initialCoverUrl?: string;
  postSlug?: string; // If editing existing post
  onSave: (data: {
    title: string;
    markdownContent: string;
    excerpt: string;
    tags: string[];
    coverImageUrl: string;
    status: "DRAFT" | "PUBLISHED";
  }) => Promise<void>;
  saving?: boolean;
}

export function MarkdownEditor({
  initialContent = "",
  initialTitle = "",
  initialExcerpt = "",
  initialTags = [],
  initialCoverUrl = "",
  postSlug,
  onSave,
  saving = false,
}: MarkdownEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [excerpt, setExcerpt] = useState(initialExcerpt);
  const [tags, setTags] = useState(initialTags.join(", "));
  const [coverUrl, setCoverUrl] = useState(initialCoverUrl);
  const [mode, setMode] = useState<"edit" | "preview" | "split">("split");

  const handleSave = useCallback(
    async (status: "DRAFT" | "PUBLISHED") => {
      await onSave({
        title,
        markdownContent: content,
        excerpt,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        coverImageUrl: coverUrl,
        status,
      });
    },
    [title, content, excerpt, tags, coverUrl, onSave]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode("edit")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "edit"
                ? "bg-brand-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => setMode("split")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "split"
                ? "bg-brand-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            Split
          </button>
          <button
            onClick={() => setMode("preview")}
            className={cn(
              "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "preview"
                ? "bg-brand-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("DRAFT")}
            disabled={saving || !title.trim() || !content.trim()}
            className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave("PUBLISHED")}
            disabled={saving || !title.trim() || !content.trim()}
            className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
            {saving ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      {/* Metadata Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-lg font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="react, typescript, azure"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Excerpt
          </label>
          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Brief description of the post..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Cover Image URL
          </label>
          <input
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Editor / Preview */}
      <div
        className={cn(
          "rounded-xl border border-border overflow-hidden",
          mode === "split" && "grid grid-cols-2 divide-x divide-border"
        )}
      >
        {/* Editor Pane */}
        {(mode === "edit" || mode === "split") && (
          <div className="min-h-[500px]" data-color-mode="auto">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || "")}
              height={500}
              preview="edit"
              hideToolbar={false}
            />
          </div>
        )}

        {/* Preview Pane */}
        {(mode === "preview" || mode === "split") && (
          <div className="min-h-[500px] overflow-auto bg-background p-6">
            <div className="prose dark:prose-dark max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || "*Start typing to see preview...*"}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
