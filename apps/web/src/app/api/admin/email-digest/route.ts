import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendBulkDigestEmails } from "@/lib/email";

// POST /api/admin/email-digest - send weekly digest to subscribers
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find posts published in the last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const posts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      select: {
        title: true,
        slug: true,
        excerpt: true,
      },
    });

    if (posts.length === 0) {
      return NextResponse.json(
        { error: "No posts published in the last 7 days", sent: 0 },
        { status: 400 }
      );
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const digestPeriod = `${weekAgo.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })} — ${now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })}`;

    const sent = await sendBulkDigestEmails(posts, digestPeriod);

    return NextResponse.json({
      message: `Digest sent successfully`,
      sent,
      postsIncluded: posts.length,
    });
  } catch (error) {
    console.error("Digest send error:", error);
    return NextResponse.json(
      { error: "Failed to send digest emails" },
      { status: 500 }
    );
  }
}
