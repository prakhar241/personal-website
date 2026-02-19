"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { MessageCircle, Send } from "lucide-react";
import { trackComment } from "@/lib/telemetry";
import toast from "react-hot-toast";

interface Comment {
  id: string;
  authorName: string;
  authorEmail: string | null;
  body: string;
  createdAt: Date | string;
}

interface CommentSectionProps {
  slug: string;
  initialComments: Comment[];
}

export function CommentSection({ slug, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !body.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: name.trim(),
          authorEmail: email.trim() || undefined,
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post comment");
      }

      const newComment = await res.json();
      setComments([newComment, ...comments]);
      setBody("");
      trackComment(slug);
      toast.success("Comment posted!");
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-xl font-bold text-foreground mb-6">
        <MessageCircle className="h-5 w-5" />
        Comments ({comments.length})
      </h2>

      {/* Comment Form */}
      <form
        onSubmit={handleSubmit}
        className="mb-8 rounded-xl border border-border/60 bg-card p-5 space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Your name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Email <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="your@email.com"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="comment"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Comment <span className="text-red-500">*</span>
          </label>
          <textarea
            id="comment"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="Write your comment..."
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !name.trim() || !body.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </form>

      {/* Comment List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-lg border border-border/40 bg-card p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-foreground">
                {comment.authorName}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {comment.body}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        )}
      </div>
    </section>
  );
}
