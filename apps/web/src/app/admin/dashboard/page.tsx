"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Globe,
  Heart,
  MessageCircle,
  Eye,
  BarChart3,
  Bell,
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

interface Analytics {
  overview: {
    totalPosts: number;
    publishedPosts: number;
    draftPosts: number;
    totalComments: number;
    unreadComments: number;
    totalLikes: number;
    totalViews: number;
    recentViews: number;
  };
  postStats: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    publishedAt: string | null;
    _count: { likes: number; comments: number; views: number };
  }>;
  topPages: Array<{ pagePath: string; views: number }>;
  recentComments: Array<{
    id: string;
    authorName: string;
    body: string;
    createdAt: string;
    post: { title: string; slug: string };
  }>;
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      const res = await fetch(`/api/admin/analytics?days=${days}`);
      if (res.ok) {
        setAnalytics(await res.json());
      }
      setLoading(false);
    }
    fetchAnalytics();
  }, [days]);

  async function markCommentsRead(ids: string[]) {
    await fetch("/api/admin/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, isRead: true }),
    });
    // Refresh
    const res = await fetch(`/api/admin/analytics?days=${days}`);
    if (res.ok) setAnalytics(await res.json());
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;
  const { overview, postStats, topPages, recentComments } = analytics;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your blog analytics
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total Posts"
          value={overview.totalPosts}
          sub={`${overview.publishedPosts} published, ${overview.draftPosts} drafts`}
        />
        <StatCard
          icon={<Eye className="h-5 w-5" />}
          label="Page Views"
          value={overview.totalViews}
          sub={`${overview.recentViews} recent`}
          color="blue"
        />
        <StatCard
          icon={<Heart className="h-5 w-5" />}
          label="Total Likes"
          value={overview.totalLikes}
          color="red"
        />
        <StatCard
          icon={<MessageCircle className="h-5 w-5" />}
          label="Comments"
          value={overview.totalComments}
          sub={
            overview.unreadComments > 0
              ? `${overview.unreadComments} unread`
              : undefined
          }
          color="green"
          highlight={overview.unreadComments > 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Post Performance */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
            <BarChart3 className="h-5 w-5" />
            Post Performance
          </h2>
          <div className="space-y-3">
            {postStats.slice(0, 10).map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <Link
                    href={`/admin/posts/${post.slug}/edit`}
                    className="text-sm font-medium text-foreground hover:text-brand-600 truncate block"
                  >
                    {post.title}
                  </Link>
                  <span
                    className={`text-xs ${
                      post.status === "PUBLISHED"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {post._count.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" /> {post._count.likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {post._count.comments}
                  </span>
                </div>
              </div>
            ))}
            {postStats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No posts yet
              </p>
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4">
            <TrendingUp className="h-5 w-5" />
            Top Pages (last {days} days)
          </h2>
          <div className="space-y-2">
            {topPages.map((page, i) => (
              <div
                key={page.pagePath}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">
                    {i + 1}.
                  </span>
                  <span className="text-sm text-foreground font-mono">
                    {page.pagePath}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {page.views} views
                </span>
              </div>
            ))}
            {topPages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No page views yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Unread Comments */}
      {recentComments.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Bell className="h-5 w-5" />
              Unread Comments ({recentComments.length})
            </h2>
            <button
              onClick={() => markCommentsRead(recentComments.map((c) => c.id))}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Mark all as read
            </button>
          </div>
          <div className="space-y-3">
            {recentComments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg bg-muted/50 p-3 border-l-4 border-brand-500"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">
                    {comment.authorName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {comment.body}
                </p>
                <Link
                  href={`/blogs/${comment.post.slug}`}
                  className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                >
                  on &quot;{comment.post.title}&quot;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color = "default",
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  color?: "default" | "blue" | "red" | "green";
  highlight?: boolean;
}) {
  const colorClasses = {
    default: "text-foreground",
    blue: "text-blue-600 dark:text-blue-400",
    red: "text-red-600 dark:text-red-400",
    green: "text-green-600 dark:text-green-400",
  };

  return (
    <div
      className={`rounded-xl border bg-card p-4 ${
        highlight
          ? "border-brand-500 ring-1 ring-brand-500/20"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={colorClasses[color]}>{icon}</span>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      {sub && (
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      )}
    </div>
  );
}
