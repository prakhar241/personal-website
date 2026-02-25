import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - Fetch all navigation links (admin only)
export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await prisma.navLink.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, links });
  } catch (error) {
    console.error("Error fetching navigation links:", error);
    return NextResponse.json(
      { error: "Failed to fetch navigation links" },
      { status: 500 }
    );
  }
}

// PUT - Update all navigation links (admin only)
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { links } = await request.json();

    if (!Array.isArray(links)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // Use a transaction to update all links atomically
    await prisma.$transaction(async (tx) => {
      // Get existing link IDs
      const existingLinks = await tx.navLink.findMany({
        select: { id: true },
      });
      const existingIds = new Set<string>(existingLinks.map((l: { id: string }) => l.id));

      // Separate new links from existing ones
      const newLinks = links.filter((l: { id: string }) => l.id.startsWith("new-"));
      const updatedLinks = links.filter((l: { id: string }) => !l.id.startsWith("new-"));
      const updatedIds = new Set<string>(updatedLinks.map((l: { id: string }) => l.id));

      // Delete links that are no longer in the list (except system links)
      const idsToDelete = [...existingIds].filter((id: string) => !updatedIds.has(id));
      if (idsToDelete.length > 0) {
        await tx.navLink.deleteMany({
          where: {
            id: { in: idsToDelete },
            isSystem: false, // Don't delete system links
          },
        });
      }

      // Update existing links
      for (const link of updatedLinks) {
        await tx.navLink.update({
          where: { id: link.id },
          data: {
            label: link.label,
            href: link.href,
            sortOrder: link.sortOrder,
            isVisible: link.isVisible,
            openInNewTab: link.openInNewTab,
            // Don't update isSystem - it should stay as is
          },
        });
      }

      // Create new links
      for (const link of newLinks) {
        await tx.navLink.create({
          data: {
            label: link.label,
            href: link.href,
            sortOrder: link.sortOrder,
            isVisible: link.isVisible,
            openInNewTab: link.openInNewTab,
            isSystem: false,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating navigation links:", error);
    return NextResponse.json(
      { error: "Failed to update navigation links" },
      { status: 500 }
    );
  }
}
