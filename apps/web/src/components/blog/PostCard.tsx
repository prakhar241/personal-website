import Link from "next/link";
import { formatDate, readingTime } from "@/lib/utils";
import { Heart, MessageCircle, Clock } from "lucide-react";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    tags: string[];
    publishedAt: Date | null;
    createdAt: Date;
    author: { name: string | null; image: string | null };
    _count: { likes: number; comments: number };
  };
}

export function PostCard({ post }: PostCardProps) {
  return (
    <article className="group rounded-xl border border-border/60 bg-card overflow-hidden hover:border-border hover:shadow-lg transition-all duration-200">
      {post.coverImageUrl && (
        <div className="aspect-video overflow-hidden">
          <img
            src={post.coverImageUrl}
            alt={post.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-5">
        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-brand-50 dark:bg-brand-950/30 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:text-brand-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-semibold text-card-foreground group-hover:text-brand-600 transition-colors">
          <Link href={`/blogs/${post.slug}`}>{post.title}</Link>
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {post.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {formatDate(post.publishedAt || post.createdAt)}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {post._count.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {post._count.comments}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
