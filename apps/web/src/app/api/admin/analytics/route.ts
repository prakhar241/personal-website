import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/analytics - admin dashboard analytics
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [
    totalPosts,
    publishedPosts,
    draftPosts,
    totalComments,
    unreadComments,
    totalLikes,
    totalViews,
    recentViews,
    totalSubscribers,
    recentSubscribers,
    postStats,
    topPages,
    recentComments,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.comment.count(),
    prisma.comment.count({ where: { isRead: false } }),
    prisma.like.count(),
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: since } } }),
    prisma.subscriber.count({ where: { verified: true } }),
    prisma.subscriber.count({ where: { verified: true, subscribedAt: { gte: since } } }),
    // Per-post stats
    prisma.post.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        _count: { select: { likes: true, comments: true, views: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Top pages by view count
    prisma.pageView.groupBy({
      by: ["pagePath"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
      where: { createdAt: { gte: since } },
    }),
    // Recent unread comments
    prisma.comment.findMany({
      where: { isRead: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        post: { select: { title: true, slug: true } },
      },
    }),
  ]);

  return NextResponse.json({
    overview: {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalComments,
      unreadComments,
      totalLikes,
      totalViews,
      recentViews,
      totalSubscribers,
      recentSubscribers,
    },
    postStats,
    topPages: topPages.map((p) => ({
      pagePath: p.pagePath,
      views: p._count.id,
    })),
    recentComments,
  });
}
