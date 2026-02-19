import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { updateStaticPageSchema } from "@/lib/validations";
import { markdownToHtml } from "@/lib/markdown";

// GET /api/pages/[slug]
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const page = await prisma.staticPage.findUnique({
    where: { slug: params.slug },
  });

  if (!page || !page.isVisible) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json(page);
}

// PATCH /api/pages/[slug] - update static page (admin only)
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
    const validated = updateStaticPageSchema.parse(body);

    const data: any = { ...validated };
    if (validated.markdownContent) {
      data.htmlContent = await markdownToHtml(validated.markdownContent);
    }

    const page = await prisma.staticPage.update({
      where: { slug: params.slug },
      data,
    });

    return NextResponse.json(page);
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

// DELETE /api/pages/[slug] - delete static page (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.staticPage.delete({ where: { slug: params.slug } });
  return NextResponse.json({ message: "Page deleted" });
}
