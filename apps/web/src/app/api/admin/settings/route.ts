import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/admin/settings - Fetch all settings grouped
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
