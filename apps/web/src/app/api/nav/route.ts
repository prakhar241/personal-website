import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Cache for 5 minutes for performance
export const revalidate = 300;

export async function GET() {
  try {
    // Fetch visible navigation links from database
    const links = await prisma.navLink.findMany({
      where: { isVisible: true },
      select: {
        href: true,
        label: true,
        sortOrder: true,
        openInNewTab: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      links,
    });
  } catch (error) {
    console.error("Error fetching nav links:", error);
    // Return default links if database is unavailable
    return NextResponse.json({
      success: true,
      links: [
        { href: "/blogs", label: "Blogs", sortOrder: 10, openInNewTab: false },
        { href: "/contact", label: "Contact", sortOrder: 110, openInNewTab: false },
      ],
    });
  }
}

