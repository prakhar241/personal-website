import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updatePostSchema } from "@/lib/validations";
import { slugify } from "@/lib/utils";
import { markdownToHtml } from "@/lib/markdown";
import { sendBulkPostNotifications } from "@/lib/email";

// GET /api/posts/[slug] - get single post
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { name: true, image: true } },
      comments: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Non-admin cannot see drafts
  if (post.status === "DRAFT" && !isAdmin) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Track page view (non-blocking)
  const visitorId = req.headers.get("x-visitor-id") || req.ip || "anonymous";
  prisma.pageView
    .create({
      data: {
        pagePath: `/blogs/${params.slug}`,
        postId: post.id,
        visitorId,
        referrer: req.headers.get("referer") || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    })
    .catch(() => {}); // Fire and forget

  return NextResponse.json(post);
}

// PATCH /api/posts/[slug] - update post (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = updatePostSchema.parse(body);

    const existing = await prisma.post.findUnique({
      where: { slug: params.slug },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const data: any = { ...validated };

    // Re-generate slug if title changed
    if (validated.title && validated.title !== existing.title) {
      let newSlug = slugify(validated.title);
      const slugExists = await prisma.post.findFirst({
        where: { slug: newSlug, id: { not: existing.id } },
      });
      if (slugExists) {
        newSlug = `${newSlug}-${Date.now().toString(36)}`;
      }
      data.slug = newSlug;
    }

    // Re-generate HTML if markdown changed
    if (validated.markdownContent) {
      data.htmlContent = await markdownToHtml(validated.markdownContent);
    }

    // Set publishedAt when publishing
    const isNewlyPublished =
      validated.status === "PUBLISHED" && existing.status === "DRAFT";
    if (isNewlyPublished) {
      data.publishedAt = new Date();
    }

    const post = await prisma.post.update({
      where: { slug: params.slug },
      data,
    });

    // Notify subscribers on DRAFT → PUBLISHED transition only
    if (isNewlyPublished) {
      sendBulkPostNotifications(post).catch((err) =>
        console.error("Failed to send post notifications:", err)
      );
    }

    return NextResponse.json(post);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Update post error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[slug] - delete post (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.post.delete({ where: { slug: params.slug } });
  return NextResponse.json({ message: "Post deleted" });
}
