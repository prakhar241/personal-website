# Building an Event-Driven Telemetry Pipeline for a Next.js Blog — From Browser Click to KQL Dashboard

Most personal blogs slap on Google Analytics and call it a day. I wanted something different — a **production-grade, event-driven telemetry system** that gives me full ownership of my data, real-time analytics with KQL, Power BI dashboards, and a pipeline that could scale to enterprise workloads. Here's how I built it.

This post walks through the full architecture: client-side event capture, server-side ingestion with geo-enrichment, Azure Event Hubs for streaming, Azure Data Explorer (ADX) for analytics, OpenTelemetry for distributed tracing, and the Kubernetes infrastructure that ties it all together.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Event Schema](#the-event-schema)
3. [Client-Side: Capturing Every Interaction](#client-side-capturing-every-interaction)
   - [The Telemetry Event SDK](#the-telemetry-event-sdk)
   - [Session and Visitor Identity](#session-and-visitor-identity)
   - [Batched Event Queue](#batched-event-queue)
   - [Automatic Page View Tracking with TelemetryProvider](#automatic-page-view-tracking-with-telemetryprovider)
   - [Dual-Write: Application Insights + Event Pipeline](#dual-write-application-insights--event-pipeline)
4. [Server-Side: Ingestion, Enrichment, and Fan-Out](#server-side-ingestion-enrichment-and-fan-out)
   - [The Batched Ingestion API](#the-batched-ingestion-api)
   - [Geo-Location Enrichment](#geo-location-enrichment)
   - [Event Hub Producer](#event-hub-producer)
   - [PostgreSQL Dual-Write](#postgresql-dual-write)
5. [Distributed Tracing with OpenTelemetry](#distributed-tracing-with-opentelemetry)
   - [Server-Side Instrumentation](#server-side-instrumentation)
   - [OTel Collector on Kubernetes](#otel-collector-on-kubernetes)
6. [Azure Infrastructure (IaC with Bicep)](#azure-infrastructure-iac-with-bicep)
   - [Event Hubs Namespace](#event-hubs-namespace)
   - [Azure Data Explorer Cluster](#azure-data-explorer-cluster)
   - [ADX Table Schema and Ingestion Mapping](#adx-table-schema-and-ingestion-mapping)
   - [Automatic Ingestion: Event Hub → ADX Data Connection](#automatic-ingestion-event-hub--adx-data-connection)
7. [Querying Telemetry with KQL](#querying-telemetry-with-kql)
8. [Power BI Integration](#power-bi-integration)
9. [The Admin Dashboard](#the-admin-dashboard)
10. [Lessons Learned](#lessons-learned)

---

## Architecture Overview

Here's the 30,000-foot view of how data flows from a user's browser to an analytics dashboard:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│                                                          │
│  TelemetryProvider → trackPageView() on every route     │
│  LikeButton → trackLike(slug)                           │
│  ShareButton → trackShare(slug, method)                 │
│  CommentSection → trackComment(slug)                    │
│  All links → trackLinkClick(path, target)               │
│                                                          │
│  Events batched (20 events or 3s) → POST /api/events    │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON batch (keepalive: true)
                           ▼
┌─────────────────────────────────────────────────────────┐
│          POST /api/telemetry/events (Next.js)           │
│                                                          │
│  1. Validate event types (whitelist)                    │
│  2. Enrich with geo-location from proxy headers         │
│  3. Parallel fan-out:                                   │
│     ├── Azure Event Hubs (Kafka) → streaming pipeline   │
│     └── PostgreSQL → immediate admin dashboard queries  │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
         Event Hubs    PostgreSQL    OTel Collector
         (Kafka)       (page_views)   (sidecar)
              │                          │
    ┌─────────┼──────────┐       ┌──────┼──────┐
    ▼         ▼          ▼       ▼      ▼      ▼
   ADX    Databricks  Alerts   Azure  Event   Debug
  (KQL)   (ML/Adv.)  (Mon.)  Monitor  Hubs    Logs
    │
    ├── KQL Queries (real-time)
    ├── Power BI Dashboards
    └── Materialized Views (pre-aggregated)
```

The key design decisions:

- **Event Hubs as the central nervous system** — all events pass through a single Kafka-compatible hub, enabling any number of downstream consumers without modifying the producer.
- **Dual-write to PostgreSQL** — page views are written to both Event Hubs (for analytics) and PostgreSQL (for immediate admin dashboard queries). This avoids the latency of the streaming pipeline for the admin UI.
- **OpenTelemetry for distributed tracing** — separate from the custom event pipeline, OTel handles request traces across the Next.js server and exports to Azure Monitor and Event Hubs.
- **Geo-enrichment at the server** — client events don't include location data (privacy). The server extracts country/city from reverse proxy headers.

---

## The Event Schema

Every telemetry event, regardless of type, follows a unified schema:

```typescript
interface TelemetryEvent {
  eventType: string;       // "page_view", "blog_like", "link_click", etc.
  timestamp: string;       // ISO 8601 timestamp
  sessionId: string;       // Per-tab session (sessionStorage)
  visitorId: string;       // Persistent visitor (localStorage)
  url: string;             // Full URL including query params
  path: string;            // URL pathname only
  referrer: string;        // document.referrer
  userAgent: string;       // navigator.userAgent
  screenWidth: number;     // screen.width
  screenHeight: number;    // screen.height
  language: string;        // navigator.language
  timezone: string;        // Intl timezone (e.g., "Asia/Calcutta")
  properties: Record<string, string>; // Event-specific data
}
```

After server-side enrichment, four additional fields are added:

```typescript
{
  country: string | null;  // "IN", "US", etc.
  city: string | null;     // "Mumbai", "Seattle"
  region: string | null;   // "Maharashtra", "Washington"
  ip: string | null;       // Client IP (not stored in ADX)
}
```

Six event types are supported:

| Event Type | Trigger | Properties |
|---|---|---|
| `page_view` | Every page navigation | `pageTitle`, `pagePath` |
| `blog_view` | Blog post opened | `slug`, `blogTitle` |
| `blog_like` | Like button clicked | `slug` |
| `blog_comment` | Comment submitted | `slug` |
| `blog_share` | Share button used | `slug`, `method` |
| `link_click` | External link clicked | `pagePath`, `targetUrl`, `linkText` |

---

## Client-Side: Capturing Every Interaction

### The Telemetry Event SDK

The client-side SDK lives in `telemetry-events.ts`. It's a "use client" module that exposes typed tracking functions:

```typescript
// Public API — used by components throughout the app
export function trackPageView(path?: string, title?: string) { ... }
export function trackBlogView(slug: string, title: string) { ... }
export function trackLike(slug: string) { ... }
export function trackComment(slug: string) { ... }
export function trackShare(slug: string, method: string) { ... }
export function trackLinkClick(pagePath: string, targetUrl: string, linkText?: string) { ... }
```

Each function calls an internal `buildEvent()` that assembles the full `TelemetryEvent` object with all the contextual data:

```typescript
function buildEvent(
  eventType: string,
  properties: Record<string, string> = {}
): TelemetryEvent {
  return {
    eventType,
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    visitorId: getVisitorId(),
    url: window.location.href,
    path: window.location.pathname,
    referrer: document.referrer || "",
    userAgent: navigator.userAgent,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    properties,
  };
}
```

### Session and Visitor Identity

Identity management uses two tiers:

- **Session ID** — stored in `sessionStorage`. Unique per browser tab. Dies when the tab closes. Generated using `crypto.getRandomValues()` for a 32-character hex string.
- **Visitor ID** — stored in `localStorage`. Persists across sessions. Allows tracking returning visitors without cookies or authentication.

```typescript
function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  let sessionId = sessionStorage.getItem("telemetry_session_id");
  if (!sessionId) {
    sessionId = generateId();
    sessionStorage.setItem("telemetry_session_id", sessionId);
  }
  cachedSessionId = sessionId;
  return sessionId;
}
```

Both IDs are cached in module-level variables after first read to avoid repeated `Storage` access.

### Batched Event Queue

Events are **not sent immediately**. They're queued and flushed in batches for efficiency:

- **Batch size**: 20 events
- **Flush interval**: 3 seconds
- **Max queue**: 100 events (prevents runaway memory on persistent errors)

```typescript
const eventQueue: TelemetryEvent[] = [];
const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 20;

function enqueueEvent(event: TelemetryEvent) {
  eventQueue.push(event);
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushEvents();        // Immediate flush if batch is full
  } else {
    scheduleFlush();      // Otherwise, wait for the timer
  }
}
```

The flush function uses `fetch()` with `keepalive: true` — critical for ensuring events are delivered even when the page is unloading:

```typescript
async function flushEvents() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  try {
    const response = await fetch("/api/telemetry/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (!response.ok && eventQueue.length < 100) {
      eventQueue.push(...batch); // Re-queue on failure
    }
  } catch {
    if (eventQueue.length < 100) {
      eventQueue.push(...batch); // Re-queue on network error
    }
  }
}
```

Two browser events trigger an immediate flush: `visibilitychange` (tab switch/minimize) and `pagehide` (navigation/close). This ensures we capture the last events before the user leaves:

```typescript
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushEvents();
});
window.addEventListener("pagehide", () => flushEvents());
```

### Automatic Page View Tracking with TelemetryProvider

Instead of calling `trackPageView()` in every page component, a single `TelemetryProvider` is mounted once in the root layout and automatically tracks **all** page navigations using Next.js's `usePathname()`:

```tsx
export function TelemetryProvider() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>("");

  // Initialize Application Insights on mount
  useEffect(() => {
    import("@/lib/telemetry")
      .then(({ initTelemetry }) => initTelemetry())
      .catch(() => {});
  }, []);

  // Track page views on every route change
  useEffect(() => {
    if (!pathname || pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;
    const timer = setTimeout(() => {
      trackPageView(pathname, document.title);
    }, 150); // Small delay to let document.title update
    return () => clearTimeout(timer);
  }, [pathname]);

  return null; // No UI — just a side-effect component
}
```

The 150ms delay on `setTimeout` is intentional — Next.js's client-side navigation updates the DOM title asynchronously, and we want to capture the correct page title, not the previous one.

### Dual-Write: Application Insights + Event Pipeline

A thin wrapper in `telemetry.ts` ensures backward compatibility. Every tracking function writes to both Application Insights (the old system) and the new event pipeline:

```typescript
export function trackLike(slug: string) {
  appInsights?.trackEvent({ name: "BlogLike" }, { slug });
  trackLikeEvent(slug); // → event pipeline → Event Hubs
}
```

This dual-write approach meant zero downtime during migration — we could validate the new pipeline's data against Application Insights before decommissioning it.

---

## Server-Side: Ingestion, Enrichment, and Fan-Out

### The Batched Ingestion API

The server-side endpoint at `POST /api/telemetry/events` handles batch ingestion:

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { events } = body as { events: ClientEvent[] };

  // Limit batch size to prevent abuse
  const batch = events.slice(0, MAX_EVENTS_PER_BATCH); // Max 50

  // Validate event types against whitelist
  const validEvents = batch.filter(
    (e) => e.eventType && ALLOWED_EVENT_TYPES.has(e.eventType)
          && e.path && e.timestamp
  );

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
  await Promise.allSettled([
    sendEventsToEventHub(enrichedEvents),
    writePageViewsToDb(pageViewEvents),
  ]);

  return NextResponse.json({ ok: true, processed: enrichedEvents.length });
}
```

Key design choices:

1. **Whitelist validation** — only 6 known event types are accepted. Anything else is silently dropped.
2. **Batch size limit** (50) — prevents a malicious client from flooding the API.
3. **`Promise.allSettled()`** — Event Hub or PostgreSQL failures don't block each other. The API always returns 200 to the client.
4. **Never fails the response** — telemetry should never degrade the user experience. Even on internal errors, we return `{ ok: true }`.

### Geo-Location Enrichment

The `getGeoFromRequest()` function extracts location data from reverse proxy headers. It supports multiple CDN/proxy platforms with a priority fallback chain:

```typescript
export function getGeoFromRequest(req: NextRequest): GeoInfo {
  const headers = req.headers;

  // Country (priority: Cloudflare → Vercel → Azure → custom)
  const country =
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-azure-clientip-country") ||
    headers.get("x-geo-country") ||
    null;

  // Client IP for potential server-side lookup
  const ip =
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-azure-clientip") ||
    getIpFromForwardedFor(headers.get("x-forwarded-for")) ||
    null;

  return { country, region, city, ip };
}
```

This approach means the geo-enrichment layer is CDN-agnostic — whether I deploy behind Cloudflare, Azure Front Door, Vercel, or a custom nginx with GeoIP, the same code works.

### Event Hub Producer

The `eventhub.ts` module manages the connection to Azure Event Hubs using the `@azure/event-hubs` SDK:

```typescript
export async function sendEventsToEventHub(
  events: TelemetryEventPayload[]
): Promise<void> {
  // Try buffered producer first (high-throughput, auto-batching)
  const buffered = getProducer();
  if (buffered) {
    for (const event of events) {
      await buffered.enqueueEvent({
        body: event,
        contentType: "application/json",
        properties: {
          eventType: event.eventType,
          visitorId: event.visitorId,
          country: event.country || "unknown",
        },
      });
    }
    return;
  }

  // Fallback: simple producer with explicit batch management
  const simple = getSimpleProducer();
  if (simple) {
    const batch = await simple.createBatch();
    for (const event of events) {
      if (!batch.tryAdd({ body: event })) {
        await simple.sendBatch(batch); // Batch full → send it
        // ... create new batch and add event
      }
    }
    if (batch.count > 0) await simple.sendBatch(batch);
  }
}
```

Two producer strategies:

- **`EventHubBufferedProducerClient`** (primary) — auto-batches events in memory (up to 100 per partition) and flushes every 5 seconds. Best for high-throughput scenarios.
- **`EventHubProducerClient`** (fallback) — explicit batch management. Used when the buffered producer isn't available.

In development mode (no `EVENTHUB_CONNECTION_STRING`), events are logged to the console:

```typescript
if (process.env.NODE_ENV === "development") {
  console.log(`[EventHub:dev] Would send ${events.length} events:`,
    events.map((e) => `${e.eventType}:${e.path}`));
}
```

### PostgreSQL Dual-Write

Page view events are simultaneously written to PostgreSQL for the admin dashboard:

```typescript
async function writePageViewsToDb(events) {
  const writes = events.map(async (event) => {
    let postId = null;
    if (event.path.startsWith("/blogs/")) {
      const slug = event.path.replace("/blogs/", "").split("?")[0];
      const post = await prisma.post.findUnique({
        where: { slug }, select: { id: true },
      });
      postId = post?.id || null;
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
```

The Prisma `PageView` model links to the `Post` model via slug resolution, enabling queries like "views per blog post" directly from PostgreSQL without hitting ADX.

---

## Distributed Tracing with OpenTelemetry

### Server-Side Instrumentation

OpenTelemetry is initialized via Next.js's `instrumentation.ts` hook — this runs once when the server starts:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerTelemetry } = await import("./lib/otel-server");
    initServerTelemetry();
  }
}
```

The `otel-server.ts` module configures a `NodeTracerProvider` with two exporters:

```typescript
// OTLP exporter → OTel Collector sidecar
const otlpExporter = new OTLPTraceExporter({
  url: `${collectorUrl}/v1/traces`,
});
spanProcessors.push(new BatchSpanProcessor(otlpExporter));

// Azure Monitor exporter → Application Insights (backup path)
if (aiConnectionString) {
  const azureExporter = new AzureMonitorTraceExporter({
    connectionString: aiConnectionString,
  });
  spanProcessors.push(new BatchSpanProcessor(azureExporter));
}
```

This dual-export ensures traces reach Azure Monitor even if the OTel Collector is down.

### OTel Collector on Kubernetes

The OTel Collector runs as a separate Kubernetes Deployment with a ClusterIP Service:

```yaml
containers:
  - name: otel-collector
    image: otel/opentelemetry-collector-contrib:0.96.0
    ports:
      - containerPort: 4317  # OTLP gRPC
      - containerPort: 4318  # OTLP HTTP
      - containerPort: 13133 # Health check
    resources:
      requests: { cpu: 100m, memory: 128Mi }
      limits:   { cpu: 500m, memory: 256Mi }
```

The collector's pipeline:

```
               ┌──────────────┐
  OTLP ──────►│   Receivers   │
  (gRPC/HTTP)  └──────┬───────┘
                       │
               ┌───────┴───────┐
               │   Processors  │
               │  memory_limit │
               │  batch (256)  │
               │  resource     │
               └───────┬───────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    Azure Monitor   Event Hubs     Debug
    (App Insights)  (Kafka)        (stdout)
```

The Kafka exporter sends traces to the `otel-traces` Event Hub using SASL PLAIN authentication — Azure Event Hubs' Kafka endpoint accepts the connection string as the SASL password:

```yaml
kafka:
  brokers:
    - "${EVENTHUB_NAMESPACE}.servicebus.windows.net:9093"
  topic: "otel-traces"
  auth:
    sasl:
      mechanism: "PLAIN"
      username: "$ConnectionString"
      password: "${EVENTHUB_CONNECTION_STRING}"
    tls:
      insecure: false
```

---

## Azure Infrastructure (IaC with Bicep)

All Azure resources are defined in Bicep templates under `infra/modules/`.

### Event Hubs Namespace

```bicep
resource eventHubNamespace 'Microsoft.EventHub/namespaces@2024-01-01' = {
  name: '${namePrefix}-ehns'
  location: location
  sku: { name: 'Standard', tier: 'Standard', capacity: 1 }
  properties: {
    isAutoInflateEnabled: true
    maximumThroughputUnits: 10
    kafkaEnabled: true
    minimumTlsVersion: '1.2'
  }
}
```

Two Event Hubs within the namespace:

| Hub | Partitions | Retention | Purpose |
|---|---|---|---|
| `telemetry-events` | 4 | 3 days | Client telemetry events |
| `otel-traces` | 2 | 3 days | OTel Collector trace export |

Four consumer groups on `telemetry-events`:

- `$Default` — system default
- `adx-consumer` — Azure Data Explorer auto-ingestion
- `databricks-consumer` — future Databricks streaming
- `otel-consumer` — OTel Collector

Three authorization policies with least-privilege access:

| Policy | Rights | Used By |
|---|---|---|
| `app-send-policy` | Send | Next.js app |
| `consumer-listen-policy` | Listen | ADX, Databricks |
| `otel-policy` | Send + Listen | OTel Collector |

### Azure Data Explorer Cluster

```bicep
resource adxCluster 'Microsoft.Kusto/clusters@2023-08-15' = {
  name: '${replace(namePrefix, '-', '')}adx'
  location: location
  sku: { name: 'Dev(No SLA)_Standard_E2a_v4', tier: 'Basic', capacity: 1 }
  identity: { type: 'SystemAssigned' }
  properties: {
    enableStreamingIngest: true
    enableAutoStop: true
    publicNetworkAccess: 'Enabled'
  }
}
```

The cluster uses a System-Assigned Managed Identity, which is granted the **Azure Event Hubs Data Receiver** role on the Event Hubs namespace — this allows ADX to pull events without any shared secrets:

```bicep
var eventHubsDataReceiverRoleId = 'a638d3c7-ab3a-418d-83e6-5f17a39d4fde'

resource eventHubRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(adxCluster.id, eventHubNamespaceId, eventHubsDataReceiverRoleId)
  scope: eventHubNamespaceRef
  properties: {
    principalId: adxCluster.identity.principalId
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions', eventHubsDataReceiverRoleId)
    principalType: 'ServicePrincipal'
  }
}
```

### ADX Table Schema and Ingestion Mapping

The table schema matches the enriched event payload exactly:

```kql
.create-merge table TelemetryEvents (
  EventType: string,
  Timestamp: datetime,
  SessionId: string,
  VisitorId: string,
  Url: string,
  Path: string,
  Referrer: string,
  UserAgent: string,
  ScreenWidth: int,
  ScreenHeight: int,
  Language: string,
  Timezone: string,
  Country: string,
  City: string,
  Region: string,
  Properties: dynamic
)
```

A JSON ingestion mapping tells ADX how to map the Event Hub JSON payload to table columns:

```kql
.create-or-alter table TelemetryEvents ingestion json mapping 'TelemetryEventsMapping'
'[
  {"column":"EventType","path":"$.eventType"},
  {"column":"Timestamp","path":"$.timestamp"},
  {"column":"SessionId","path":"$.sessionId"},
  {"column":"VisitorId","path":"$.visitorId"},
  {"column":"Url","path":"$.url"},
  {"column":"Path","path":"$.path"},
  {"column":"Referrer","path":"$.referrer"},
  {"column":"UserAgent","path":"$.userAgent"},
  {"column":"ScreenWidth","path":"$.screenWidth"},
  {"column":"ScreenHeight","path":"$.screenHeight"},
  {"column":"Language","path":"$.language"},
  {"column":"Timezone","path":"$.timezone"},
  {"column":"Country","path":"$.country"},
  {"column":"City","path":"$.city"},
  {"column":"Region","path":"$.region"},
  {"column":"Properties","path":"$.properties"}
]'
```

Two **materialized views** pre-aggregate common queries for fast lookups:

```kql
// Views by country per day — powers the geo heatmap
.create-or-alter materialized-view PageViewsByCountry on table TelemetryEvents
{
  TelemetryEvents
  | where EventType == "page_view" or EventType == "blog_view"
  | summarize ViewCount = count(), UniqueVisitors = dcount(VisitorId)
    by Country, Path, bin(Timestamp, 1d)
}

// Daily unique visitors — powers the trend chart
.create-or-alter materialized-view DailyUniqueVisitors on table TelemetryEvents
{
  TelemetryEvents
  | where EventType == "page_view" or EventType == "blog_view"
  | summarize UniqueVisitors = dcount(VisitorId), TotalViews = count()
    by bin(Timestamp, 1d)
}
```

### Automatic Ingestion: Event Hub → ADX Data Connection

The Bicep template also creates an Event Hub data connection that **automatically** ingests JSON events from Event Hubs into ADX — no consumer code needed:

```bicep
resource dataConnection 'Microsoft.Kusto/clusters/databases/dataConnections@2023-08-15' = {
  parent: telemetryDb
  name: 'eh-telemetry-ingestion'
  kind: 'EventHub'
  properties: {
    eventHubResourceId: eventHubResourceId
    consumerGroup: 'adx-consumer'
    tableName: 'TelemetryEvents'
    mappingRuleName: 'TelemetryEventsMapping'
    dataFormat: 'MULTIJSON'
    managedIdentityResourceId: adxCluster.id
  }
}
```

Once deployed, events flow automatically: Next.js app → Event Hubs → ADX. No Spark jobs, no Kafka consumers, no glue code.

---

## Querying Telemetry with KQL

KQL (Kusto Query Language) is where ADX truly shines. Here are the queries I use most:

### Top Pages by Views (Last 30 Days)

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId) by Path
| order by Views desc
```

### Visitors by Country

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize Visitors = dcount(VisitorId), Views = count() by Country
| order by Visitors desc
```

### Daily Trend (Time-Series Chart)

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId)
  by bin(Timestamp, 1d)
| order by Timestamp asc
| render timechart
```

### Most Popular Blog Posts

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "blog_view"
| extend Slug = tostring(Properties.slug)
| summarize Views = count(), UniqueReaders = dcount(VisitorId) by Slug
| order by Views desc
| take 20
```

### Blog Engagement (Likes, Comments, Shares)

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("blog_like", "blog_comment", "blog_share")
| extend Slug = tostring(Properties.slug)
| summarize
  Likes = countif(EventType == "blog_like"),
  Comments = countif(EventType == "blog_comment"),
  Shares = countif(EventType == "blog_share")
  by Slug
| order by Likes + Comments + Shares desc
```

### Live Visitors (Real-Time)

```kql
TelemetryEvents
| where Timestamp > ago(5m)
| where EventType in ("page_view", "blog_view")
| summarize ActiveVisitors = dcount(VisitorId), CurrentPages = dcount(Path)
```

### Session Duration Analysis

```kql
TelemetryEvents
| where Timestamp > ago(7d)
| where EventType in ("page_view", "blog_view")
| summarize
    SessionStart = min(Timestamp),
    SessionEnd = max(Timestamp),
    PageCount = count()
  by SessionId
| where PageCount > 1
| extend SessionDuration = SessionEnd - SessionStart
| summarize AvgDuration = avg(SessionDuration), MedianPages = percentile(PageCount, 50)
```

### Top Referrer Sources

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "page_view"
| where isnotempty(Referrer)
| extend ReferrerDomain = extract("https?://([^/]+)", 1, Referrer)
| summarize Visits = count() by ReferrerDomain
| order by Visits desc
| take 20
```

You can run these queries in the [Azure Data Explorer Web Explorer](https://dataexplorer.azure.com) by connecting to your cluster.

---

## Power BI Integration

Power BI connects natively to ADX using the **Azure Data Explorer (Kusto)** connector:

1. **Get Data** → **Azure Data Explorer (Kusto)**
2. Cluster: `https://blogpreprodadx.centralus.kusto.windows.net`
3. Database: `TelemetryDb`
4. Paste any KQL query as the data source

The geographic heatmap query is specifically designed for Power BI's Map visual:

```kql
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize
    TotalViews = count(),
    UniqueVisitors = dcount(VisitorId)
  by Country
| order by UniqueVisitors desc
```

Drop `Country` into the Location field and `UniqueVisitors` into the Size field — instant geographic heatmap of your visitors.

---

## The Admin Dashboard

For quick at-a-glance stats, the `/admin/dashboard` page queries PostgreSQL directly through a Prisma-backed API:

```typescript
const [totalViews, recentViews, postStats, topPages] = await Promise.all([
  prisma.pageView.count(),
  prisma.pageView.count({ where: { createdAt: { gte: since } } }),
  prisma.post.findMany({
    select: {
      title: true, slug: true, status: true,
      _count: { select: { likes: true, comments: true, views: true } },
    },
  }),
  prisma.pageView.groupBy({
    by: ["pagePath"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
    where: { createdAt: { gte: since } },
  }),
]);
```

This gives: total posts, page views, likes, comments (with unread count), per-post performance breakdown, top pages by views, and a list of unread comments with mark-as-read. All with a time range selector (7d / 30d / 90d / 1yr).

The admin dashboard hits PostgreSQL, not ADX — giving sub-100ms response times without waiting for the streaming pipeline.

---

## Lessons Learned

### 1. Dual-write is your friend during migration

Writing to both Application Insights and the event pipeline simultaneously let us validate data parity before cutting over. Zero downtime, zero data loss.

### 2. Never let telemetry break user experience

The ingestion API **always** returns 200. `Promise.allSettled()` ensures Event Hub or DB failures are logged but never propagated to the user. Telemetry is fire-and-forget from the client's perspective.

### 3. Event Hubs + ADX = auto-magic ingestion

Once the Event Hub data connection is configured, ADX pulls events automatically. No Kafka consumers, no Spark jobs, no Lambda functions. The managed identity handles auth — no secrets to rotate.

### 4. Geo-enrichment belongs on the server

Client-side geolocation APIs require user permission. Reverse proxy headers (Cloudflare, Azure Front Door) give us country-level accuracy for free, invisibly, and with zero user friction.

### 5. Batch on the client, batch on the server

Client-side batching (20 events / 3s) reduces HTTP requests by ~90%. Server-side batching (Event Hub buffered producer, 100 events / 5s) reduces Event Hub API calls further. Network efficiency compounds.

### 6. Materialized views for repeated queries

The `PageViewsByCountry` and `DailyUniqueVisitors` materialized views pre-compute aggregations incrementally as new data arrives. Queries that would scan millions of rows instead read from pre-built summaries.

### 7. Dev SKU for pre-prod, Standard for prod

ADX's Dev SKU (`Dev(No SLA)_Standard_E2a_v4`) costs a fraction of Standard and is perfect for pre-production. It auto-stops after inactivity, saving even more. Promote to Standard SKU with `enableAutoStop: false` for production.

### 8. `keepalive: true` is non-negotiable

Without `keepalive` on the fetch call, events fired during page unload (the most important ones — the last page the user sees before leaving) would be silently dropped by the browser.

---

## What's Next

- **Azure Databricks** streaming — consuming from the `databricks-consumer` group for ML-driven anomaly detection on traffic patterns.
- **Real-time alerts** — Azure Monitor alert rules triggered by KQL queries (e.g., traffic spikes, error rate increases).
- **A/B testing framework** — using the event pipeline to track experiment variants and conversion metrics.

The beauty of event-driven architecture is that adding new consumers doesn't require changing the producer. The data is already flowing through Event Hubs — just add another consumer group and start processing.

---

*Built with: Next.js 14, TypeScript, Azure Event Hubs, Azure Data Explorer, OpenTelemetry, Prisma, PostgreSQL, Azure Bicep, Kubernetes (AKS)*
