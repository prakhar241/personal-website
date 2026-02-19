import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/posts/[slug]/like - toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const visitorFingerprint = body.fingerprint || "anonymous";

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        postId_visitorFingerprint: {
          postId: post.id,
          visitorFingerprint,
        },
      },
    });

    if (existingLike) {
      // Unlike
      await prisma.like.delete({ where: { id: existingLike.id } });
      const count = await prisma.like.count({ where: { postId: post.id } });
      return NextResponse.json({ liked: false, count });
    } else {
      // Like
      await prisma.like.create({
        data: {
          postId: post.id,
          visitorFingerprint,
        },
      });
      const count = await prisma.like.count({ where: { postId: post.id } });
      return NextResponse.json({ liked: true, count });
    }
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/posts/[slug]/like?fingerprint=xxx - check like status
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const fingerprint =
    new URL(req.url).searchParams.get("fingerprint") || "anonymous";

  const [liked, count] = await Promise.all([
    prisma.like.findUnique({
      where: {
        postId_visitorFingerprint: {
          postId: post.id,
          visitorFingerprint: fingerprint,
        },
      },
    }),
    prisma.like.count({ where: { postId: post.id } }),
  ]);

  return NextResponse.json({ liked: !!liked, count });
}
