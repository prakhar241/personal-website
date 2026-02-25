"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Save, Loader2, Eye, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface PageEditorProps {
  params: { slug: string };
}

interface PageData {
  id: string;
  slug: string;
  title: string;
  markdownContent: string;
  sortOrder: number;
  isVisible: boolean;
  showInNav: boolean;
}

export default function PageEditorPage({ params }: PageEditorProps) {
  const router = useRouter();
  const isNew = params.slug === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<PageData>({
    id: "",
    slug: "",
    title: "",
    markdownContent: "",
    sortOrder: 0,
    isVisible: true,
    showInNav: true,
  });

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pages/${params.slug}`);
      if (res.ok) {
        const data = await res.json();
        setPage(data);
      } else {
        toast.error("Page not found");
        router.push("/admin/pages");
      }
    } catch (error) {
      toast.error("Failed to load page");
    } finally {
      setLoading(false);
    }
  }, [params.slug, router]);

  useEffect(() => {
    if (!isNew) {
      fetchPage();
    }
  }, [isNew, fetchPage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!page.title || !page.slug) {
      toast.error("Title and slug are required");
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? "/api/pages" : `/api/pages/${params.slug}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: page.title,
          slug: page.slug,
          markdownContent: page.markdownContent,
          sortOrder: page.sortOrder,
          isVisible: page.isVisible,
          showInNav: page.showInNav,
        }),
      });

      if (res.ok) {
        toast.success(isNew ? "Page created!" : "Page saved!");
        if (isNew) {
          const data = await res.json();
          router.push(`/admin/pages/${data.slug}`);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save page");
    }
    setSaving(false);
  }

  function generateSlug(title: string) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pages"
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isNew ? "New Page" : "Edit Page"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isNew ? "Create a new static page" : `Editing /${params.slug}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <a
              href={`/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Preview
            </a>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Page"}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Page Title
              </label>
              <input
                type="text"
                value={page.title}
                onChange={(e) => {
                  setPage((p) => ({
                    ...p,
                    title: e.target.value,
                    slug: isNew ? generateSlug(e.target.value) : p.slug,
                  }));
                }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="About Me"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <input
                  type="text"
                  value={page.slug}
                  onChange={(e) => setPage((p) => ({ ...p, slug: e.target.value }))}
                  disabled={!isNew}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  placeholder="about"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={page.sortOrder}
                onChange={(e) => setPage((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground mb-1">
                Visibility
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={page.isVisible}
                  onChange={(e) => setPage((p) => ({ ...p, isVisible: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm text-foreground">Visible to public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={page.showInNav}
                  onChange={(e) => setPage((p) => ({ ...p, showInNav: e.target.checked }))}
                  className="rounded border-input"
                />
                <span className="text-sm text-foreground">Show in navigation</span>
              </label>
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <div className="rounded-xl border border-border bg-card p-6">
          <label className="block text-sm font-medium text-foreground mb-3">
            Page Content (Markdown)
          </label>
          <div data-color-mode="auto">
            <MDEditor
              value={page.markdownContent}
              onChange={(val) => setPage((p) => ({ ...p, markdownContent: val || "" }))}
              height={500}
              preview="live"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
