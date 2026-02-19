import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCommentSchema } from "@/lib/validations";

// GET /api/posts/[slug]/comments
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

  const comments = await prisma.comment.findMany({
    where: { postId: post.id, isApproved: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

// POST /api/posts/[slug]/comments
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
    const validated = createCommentSchema.parse(body);

    const comment = await prisma.comment.create({
      data: {
        postId: post.id,
        authorName: validated.authorName,
        authorEmail: validated.authorEmail || null,
        body: validated.body,
        isRead: false,
        isApproved: true, // auto-approve; change to false for moderation
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
