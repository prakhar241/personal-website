import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/telemetry - track page views and link clicks
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, pagePath, targetUrl, linkText, visitorId } = body;

    if (type === "pageview") {
      // Find associated post if applicable
      let postId: string | null = null;
      if (pagePath.startsWith("/blog/")) {
        const slug = pagePath.replace("/blog/", "");
        const post = await prisma.post.findUnique({
          where: { slug },
          select: { id: true },
        });
        postId = post?.id || null;
      }

      await prisma.pageView.create({
        data: {
          pagePath,
          postId,
          visitorId: visitorId || null,
          referrer: req.headers.get("referer") || null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });
    } else if (type === "click") {
      await prisma.linkClick.create({
        data: {
          pagePath,
          targetUrl: targetUrl || "",
          linkText: linkText || null,
          visitorId: visitorId || null,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telemetry error:", error);
    // Don't fail the request for telemetry errors
    return NextResponse.json({ ok: true });
  }
}
