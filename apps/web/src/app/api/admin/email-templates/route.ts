import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureDefaultTemplates, TEMPLATE_VARIABLES } from "@/lib/email-templates";

// GET /api/admin/email-templates - list all templates
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure defaults exist
  await ensureDefaultTemplates();

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { templateKey: "asc" },
  });

  return NextResponse.json({ templates, variables: TEMPLATE_VARIABLES });
}

// PUT /api/admin/email-templates - batch update templates
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templates } = await req.json();
  if (!Array.isArray(templates)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const results = await Promise.all(
    templates.map((t: { templateKey: string; subject: string; htmlBody: string }) =>
      prisma.emailTemplate.update({
        where: { templateKey: t.templateKey },
        data: {
          subject: t.subject,
          htmlBody: t.htmlBody,
        },
      })
    )
  );

  return NextResponse.json({ updated: results.length });
}
