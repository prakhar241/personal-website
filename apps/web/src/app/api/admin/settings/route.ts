import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/* ---------- defaults that are auto-created when missing ---------- */
const DEFAULT_SETTINGS = [
  // General
  { key: "site_name", value: "My Blog", type: "text", label: "Site Name", group: "general", sortOrder: 1 },
  { key: "site_tagline", value: "Developer & Builder", type: "text", label: "Tagline", group: "general", sortOrder: 2 },
  { key: "site_description", value: "Personal blog about software development", type: "text", label: "Description", group: "general", sortOrder: 3 },
  // Hero
  { key: "hero_greeting", value: "Hey, I'm", type: "text", label: "Hero Greeting", group: "hero", sortOrder: 1 },
  { key: "hero_highlight", value: "a software developer", type: "text", label: "Hero Highlight (colored text)", group: "hero", sortOrder: 2 },
  { key: "hero_suffix", value: "with flavour.", type: "text", label: "Hero Suffix", group: "hero", sortOrder: 3 },
  { key: "hero_description", value: "Welcome to my corner of the internet. I write about software development, technology, and the things I'm building. Grab a coffee and stay a while.", type: "richtext", label: "Hero Description", group: "hero", sortOrder: 4 },
  { key: "hero_cta_primary", value: "Read the Blog", type: "text", label: "Primary Button Text", group: "hero", sortOrder: 5 },
  { key: "hero_cta_secondary", value: "Contact Me", type: "text", label: "Secondary Button Text", group: "hero", sortOrder: 6 },
  // Footer
  { key: "footer_text", value: "Built with", type: "text", label: "Footer Text", group: "footer", sortOrder: 1 },
  { key: "footer_copyright", value: "All rights reserved.", type: "text", label: "Copyright Text", group: "footer", sortOrder: 2 },
  // Social
  { key: "social_github", value: "", type: "text", label: "GitHub URL", group: "social", sortOrder: 1 },
  { key: "social_linkedin", value: "", type: "text", label: "LinkedIn URL", group: "social", sortOrder: 2 },
  { key: "social_twitter", value: "", type: "text", label: "Twitter URL", group: "social", sortOrder: 3 },
  { key: "social_email", value: "", type: "text", label: "Email Address", group: "social", sortOrder: 4 },
  // SEO
  { key: "seo_title", value: "Personal Blog", type: "text", label: "SEO Title", group: "seo", sortOrder: 1 },
  { key: "seo_description", value: "A personal blog about technology", type: "text", label: "SEO Description", group: "seo", sortOrder: 2 },
  { key: "seo_keywords", value: "blog, developer, technology", type: "text", label: "SEO Keywords", group: "seo", sortOrder: 3 },
];

// GET /api/admin/settings - Fetch all settings grouped (auto-creates defaults if empty)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-create any missing default settings
  const existingKeys = (
    await prisma.siteSetting.findMany({ select: { key: true } })
  ).map((s) => s.key);

  const missing = DEFAULT_SETTINGS.filter((d) => !existingKeys.includes(d.key));
  if (missing.length > 0) {
    await prisma.siteSetting.createMany({ data: missing, skipDuplicates: true });
  }

  const settings = await prisma.siteSetting.findMany({
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
  });

  // Group settings
  const grouped = settings.reduce((acc, setting) => {
    if (!acc[setting.group]) {
      acc[setting.group] = [];
    }
    acc[setting.group].push(setting);
    return acc;
  }, {} as Record<string, typeof settings>);

  return NextResponse.json({ settings, grouped });
}

// PUT /api/admin/settings - Update multiple settings
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { settings } = body as { settings: Array<{ key: string; value: string }> };

    if (!Array.isArray(settings)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Update each setting (upsert to handle new keys gracefully)
    const updates = await Promise.all(
      settings.map((s) =>
        prisma.siteSetting.upsert({
          where: { key: s.key },
          update: { value: s.value },
          create: { key: s.key, value: s.value },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error: any) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
