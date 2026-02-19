"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function NewPostPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(data: {
    title: string;
    markdownContent: string;
    excerpt: string;
    tags: string[];
    coverImageUrl: string;
    status: "DRAFT" | "PUBLISHED";
  }) {
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create post");
      }

      const post = await res.json();
      toast.success(
        data.status === "PUBLISHED"
          ? "Post published!"
          : "Draft saved!"
      );
      router.push(`/admin/posts/${post.slug}/edit`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/posts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Posts
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-foreground">New Post</h1>
      </div>
      <MarkdownEditor onSave={handleSave} saving={saving} />
    </div>
  );
}
