import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getGeoFromRequest } from "@/lib/geo";
import { sendEventsToEventHub } from "@/lib/eventhub";

// POST /api/telemetry - track page views and link clicks (legacy endpoint)
// New clients should use POST /api/telemetry/events instead.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, pagePath, targetUrl, linkText, visitorId } = body;

    // Enrich with geo-location
    const geo = getGeoFromRequest(req);

    if (type === "pageview") {
      // Find associated post if applicable
      let postId: string | null = null;
      if (pagePath.startsWith("/blogs/")) {
        const slug = pagePath.replace("/blogs/", "");
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
          country: geo.country,
        },
      });

      // Also forward to Event Hubs
      sendEventsToEventHub([
        {
          eventType: "page_view",
          timestamp: new Date().toISOString(),
          sessionId: "",
          visitorId: visitorId || "",
          url: pagePath,
          path: pagePath,
          referrer: req.headers.get("referer") || "",
          userAgent: req.headers.get("user-agent") || "",
          screenWidth: 0,
          screenHeight: 0,
          language: "",
          timezone: "",
          country: geo.country,
          city: geo.city,
          region: geo.region,
          ip: geo.ip,
          properties: { pagePath },
        },
      ]).catch(() => {});
    } else if (type === "click") {
      await prisma.linkClick.create({
        data: {
          pagePath,
          targetUrl: targetUrl || "",
          linkText: linkText || null,
          visitorId: visitorId || null,
        },
      });

      // Also forward to Event Hubs
      sendEventsToEventHub([
        {
          eventType: "link_click",
          timestamp: new Date().toISOString(),
          sessionId: "",
          visitorId: visitorId || "",
          url: pagePath,
          path: pagePath,
          referrer: "",
          userAgent: req.headers.get("user-agent") || "",
          screenWidth: 0,
          screenHeight: 0,
          language: "",
          timezone: "",
          country: geo.country,
          city: geo.city,
          region: geo.region,
          ip: geo.ip,
          properties: { pagePath, targetUrl: targetUrl || "", linkText: linkText || "" },
        },
      ]).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telemetry error:", error);
    // Don't fail the request for telemetry errors
    return NextResponse.json({ ok: true });
  }
}
