import { NextRequest, NextResponse } from "next/server";
import { sendEventsToEventHub } from "@/lib/eventhub";
import { getGeoFromRequest } from "@/lib/geo";
import prisma from "@/lib/prisma";

// ============================================
// POST /api/telemetry/events
//
// Event-driven telemetry ingestion endpoint.
// Receives batched events from the client, enriches
// them with server-side geo-location data, then:
//   1. Forwards to Azure Event Hubs (Kafka protocol)
//   2. Writes page_views to PostgreSQL (immediate queries)
//
// Event Hubs consumers:
//   - Azure Data Explorer → KQL queries & Power BI
//   - Azure Databricks → Advanced analytics
//   - Azure Monitor → Alerts & dashboards
// ============================================

interface ClientEvent {
  eventType: string;
  timestamp: string;
  sessionId: string;
  visitorId: string;
  url: string;
  path: string;
  referrer: string;
  userAgent: string;
  screenWidth: number;
  screenHeight: number;
  language: string;
  timezone: string;
  properties: Record<string, string>;
}

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "blog_view",
  "blog_like",
  "blog_comment",
  "blog_share",
  "link_click",
]);

const MAX_EVENTS_PER_BATCH = 50;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { events } = body as { events: ClientEvent[] };

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ ok: false, error: "No events" }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    const batch = events.slice(0, MAX_EVENTS_PER_BATCH);

    // Validate event types
    const validEvents = batch.filter(
      (e) =>
        e.eventType &&
        ALLOWED_EVENT_TYPES.has(e.eventType) &&
        e.path &&
        e.timestamp
    );

    if (validEvents.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    // Enrich with geo-location from request headers
    const geo = getGeoFromRequest(req);

    const enrichedEvents = validEvents.map((event) => ({
      ...event,
      country: geo.country,
      city: geo.city,
      region: geo.region,
      ip: geo.ip,
    }));

    // Fan-out: Event Hubs + PostgreSQL in parallel
    const eventHubPromise = sendEventsToEventHub(enrichedEvents).catch(
      (err) => {
        console.error("[Telemetry] Event Hub send failed:", err);
      }
    );

    // Write page_view events to PostgreSQL for immediate querying
    const pageViewEvents = enrichedEvents.filter(
      (e) => e.eventType === "page_view" || e.eventType === "blog_view"
    );

    const pgPromise = writePageViewsToDb(pageViewEvents).catch((err) => {
      console.error("[Telemetry] PostgreSQL write failed:", err);
    });

    // Wait for both - but don't fail the response
    await Promise.allSettled([eventHubPromise, pgPromise]);

    return NextResponse.json({
      ok: true,
      processed: enrichedEvents.length,
    });
  } catch (error) {
    console.error("[Telemetry] Event ingestion error:", error);
    return NextResponse.json({ ok: true, processed: 0 });
  }
}

async function writePageViewsToDb(
  events: Array<{
    eventType: string;
    path: string;
    visitorId: string;
    referrer: string;
    userAgent: string;
    country: string | null;
    properties: Record<string, string>;
  }>
) {
  if (events.length === 0) return;

  const writes = events.map(async (event) => {
    // Resolve postId for blog paths
    let postId: string | null = null;
    if (event.path.startsWith("/blogs/")) {
      const slug = event.path.replace("/blogs/", "").split("?")[0];
      if (slug) {
        const post = await prisma.post.findUnique({
          where: { slug },
          select: { id: true },
        });
        postId = post?.id || null;
      }
    }

    return prisma.pageView.create({
      data: {
        pagePath: event.path,
        postId,
        visitorId: event.visitorId || null,
        referrer: event.referrer || null,
        userAgent: event.userAgent || null,
        country: event.country || null,
      },
    });
  });

  await Promise.allSettled(writes);
}
