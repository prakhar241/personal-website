import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSampleVariables } from "@/lib/email-templates";

// POST /api/admin/email-templates/preview - render template with sample data
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateKey, subject, htmlBody } = await req.json();
  if (!templateKey || !subject || !htmlBody) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const sampleVars = getSampleVariables(templateKey);

  // Replace placeholders with sample values
  const replacePlaceholders = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleVars[key] ?? `{{${key}}}`);

  return NextResponse.json({
    subject: replacePlaceholders(subject),
    html: replacePlaceholders(htmlBody),
  });
}
