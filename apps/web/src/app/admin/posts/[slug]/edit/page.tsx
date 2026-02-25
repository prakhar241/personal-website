"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { MarkdownEditor } from "@/components/editor/MarkdownEditor";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchPost() {
      const res = await fetch(`/api/posts/${slug}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data);
      } else {
        toast.error("Post not found");
        router.push("/admin/posts");
      }
      setLoading(false);
    }
    fetchPost();
  }, [slug, router]);

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
      const res = await fetch(`/api/posts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update post");
      }

      const updated = await res.json();
      toast.success(
        data.status === "PUBLISHED"
          ? "Post published!"
          : "Draft saved!"
      );

      // If slug changed, redirect
      if (updated.slug !== slug) {
        router.push(`/admin/posts/${updated.slug}/edit`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/posts/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Post deleted");
      router.push("/admin/posts");
    } catch {
      toast.error("Failed to delete post");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Posts
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            Edit Post
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {post.status === "PUBLISHED" && (
            <Link
              href={`/blogs/${post.slug}`}
              target="_blank"
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Eye className="h-4 w-4" />
              View Live
            </Link>
          )}
          <button
            onClick={handleDelete}
            className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <MarkdownEditor
        initialTitle={post.title}
        initialContent={post.markdownContent}
        initialExcerpt={post.excerpt || ""}
        initialTags={post.tags}
        initialCoverUrl={post.coverImageUrl || ""}
        postSlug={post.slug}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
