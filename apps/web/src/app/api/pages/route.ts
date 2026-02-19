import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createStaticPageSchema, updateStaticPageSchema } from "@/lib/validations";
import { markdownToHtml } from "@/lib/markdown";

// GET /api/pages - list static pages
export async function GET() {
  const pages = await prisma.staticPage.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      sortOrder: true,
      isVisible: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(pages);
}

// POST /api/pages - create static page (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validated = createStaticPageSchema.parse(body);

    const htmlContent = await markdownToHtml(validated.markdownContent);

    const page = await prisma.staticPage.create({
      data: {
        ...validated,
        htmlContent,
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A page with this slug already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
