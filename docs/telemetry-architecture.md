# Telemetry Architecture — Event-Driven Pipeline

## Overview

The telemetry system uses an **event-driven architecture** to track all user interactions across the website — every page visit (home, blogs, contact, dynamic pages), blog engagement (likes, comments, shares), and link clicks.

Country-level geo-location is captured for every visitor via request headers (Azure Front Door / Cloudflare / reverse proxy).

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  TelemetryProvider (root layout - all pages)                      │
│  ├── usePathname() + useSearchParams() → detect route changes    │
│  ├── trackPageView() on every navigation                         │
│  └── Batched event queue → POST /api/telemetry/events            │
│                                                                    │
│  Component Events:                                                │
│  ├── LikeButton   → trackLike(slug)                             │
│  ├── ShareButton  → trackShare(slug, method)                    │
│  ├── CommentSection → trackComment(slug)                         │
│  └── All links    → trackLinkClick(path, target)                │
│                                                                    │
│  Dual-write: App Insights SDK + Event Pipeline                   │
└──────────────────────────────────────────────────────────────────┘
                           │
                           │ Batched JSON events (every 3s or 20 events)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│              POST /api/telemetry/events                           │
│              (Next.js API Route)                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. Validate & sanitize events (whitelist event types)           │
│  2. Enrich with geo-location from request headers:               │
│     - CF-IPCountry (Cloudflare)                                  │
│     - X-Vercel-IP-Country (Vercel)                               │
│     - X-Azure-ClientIP-Country (Azure Front Door)                │
│  3. Fan-out (parallel):                                          │
│     ├── Azure Event Hubs (Kafka protocol) — streaming pipeline  │
│     └── PostgreSQL (page_views table) — immediate queries        │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┼─────────────┐
              ▼            ▼             ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Azure Event │  │  PostgreSQL  │  │  OTel        │
│  Hubs (Kafka)│  │  (page_views)│  │  Collector   │
└──────┬───────┘  └──────────────┘  └──────┬───────┘
       │                                    │
  ┌────┼────────────┐              ┌───────┼────────────┐
  ▼    ▼            ▼              ▼       ▼            ▼
┌────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ ┌──────────┐ ┌─────┐
│ADX │ │Databricks│ │ Monitor  │ │Azure │ │Event Hubs│ │Debug│
│    │ │          │ │ (alerts) │ │Monitor│ │(Kafka)   │ │     │
└──┬─┘ └──────────┘ └──────────┘ └──────┘ └──────────┘ └─────┘
   │
   ├── KQL Queries (real-time analytics)
   └── Power BI Dashboards (via ADX connector)
```

## Components

### 1. Client-Side Event SDK (`src/lib/telemetry-events.ts`)

- **Event queue** with configurable batch size (20) and flush interval (3s)
- **Session ID**: per-tab, stored in `sessionStorage`
- **Visitor ID**: persistent, stored in `localStorage`
- **Auto-flush** on `visibilitychange` (tab switch) and `pagehide` (navigation away)
- Uses `fetch()` with `keepalive: true` for reliable delivery
- Captures: URL, path, referrer, user agent, screen size, language, timezone

### 2. TelemetryProvider (`src/components/providers/TelemetryProvider.tsx`)

- Mounted once in root layout → tracks ALL pages automatically
- Uses Next.js `usePathname()` + `useSearchParams()` for SPA navigation detection
- Deduplicates consecutive identical path events
- Wrapped in `<Suspense>` for SSR compatibility

### 3. Server-Side Telemetry (`src/lib/telemetry.ts`)

- **Dual-write**: sends events to both Application Insights SDK and the event pipeline
- Backward compatible — existing `trackEvent`, `trackLike`, etc. functions unchanged
- Application Insights auto-route tracking disabled (handled by our provider)

### 4. Event Ingestion API (`src/app/api/telemetry/events/route.ts`)

- Accepts batched events with whitelist validation
- Enriches with geo-location (country, region, city) from proxy headers
- Parallel fan-out to Event Hubs and PostgreSQL
- Fault-tolerant: never fails the HTTP response due to downstream errors

### 5. Azure Event Hubs Producer (`src/lib/eventhub.ts`)

- Uses `@azure/event-hubs` SDK with Kafka-compatible protocol
- **Buffered producer** for high throughput (auto-batching, configurable flush)
- Falls back to simple producer if buffered fails
- Graceful shutdown via `closeEventHubProducer()`
- Development mode: logs events to console when no connection string

### 6. Geo-Location (`src/lib/geo.ts`)

- Extracts country, region, city from standard proxy headers
- Supports Cloudflare, Vercel, Azure Front Door, nginx GeoIP
- Falls back to `X-Forwarded-For` IP extraction for custom setups

### 7. OpenTelemetry Server Instrumentation (`src/lib/otel-server.ts`)

- Node.js `TracerProvider` with `BatchSpanProcessor`
- Exports to OTel Collector (OTLP/HTTP) and Azure Monitor (backup path)
- Auto-initialized via Next.js `instrumentation.ts` hook
- Creates traced spans for telemetry event processing

### 8. OTel Collector (`k8s/base/otel-collector.yaml`)

- Deployed as K8s Deployment + ClusterIP Service
- Receives OTLP (gRPC:4317, HTTP:4318) from Next.js app
- Exports to:
  - **Azure Monitor** (Application Insights)
  - **Azure Event Hubs** (Kafka protocol → ADX, Databricks)
  - **Debug** (development logging)
- Memory-limited (256Mi) with batch processing

## Infrastructure (Azure Bicep)

### Event Hubs Namespace (`infra/modules/eventhubs.bicep`)

| Property | Preprod | Prod |
|----------|---------|------|
| SKU | Standard | Standard |
| Throughput Units | 1 | 2 (auto-inflate to 10) |
| Kafka Enabled | Yes | Yes |
| Message Retention | 3 days | 7 days |
| Partitions | 4 | 8 |

**Event Hubs:**
- `telemetry-events` — client telemetry events
- `otel-traces` — OTel Collector trace export

**Consumer Groups:**
- `adx-consumer` — Azure Data Explorer ingestion
- `databricks-consumer` — Azure Databricks streaming
- `otel-consumer` — OTel Collector

**Auth Policies:**
- `app-send-policy` (Send only) — for Next.js app
- `consumer-listen-policy` (Listen only) — for ADX/Databricks
- `otel-policy` (Send + Listen) — for OTel Collector

### Azure Data Explorer (`infra/modules/dataexplorer.bicep`)

| Property | Preprod | Prod |
|----------|---------|------|
| SKU | Dev(No SLA) E2a_v4 | Standard E2a_v4 |
| Instances | 1 | 2 |
| Data Retention | 90 days | 365 days |
| Hot Cache | 7 days | 31 days |
| Streaming Ingest | Yes | Yes |

**Database:** `TelemetryDb`

**Table:** `TelemetryEvents`
```
EventType    | string   | page_view, blog_view, blog_like, etc.
Timestamp    | datetime | Event timestamp
SessionId    | string   | Per-tab session
VisitorId    | string   | Persistent visitor ID
Url          | string   | Full URL
Path         | string   | URL path
Referrer     | string   | HTTP referrer
UserAgent    | string   | Browser user agent
ScreenWidth  | int      | Screen width pixels
ScreenHeight | int      | Screen height pixels
Language     | string   | Browser language
Timezone     | string   | IANA timezone
Country      | string   | ISO country code
City         | string   | City name
Region       | string   | State/region
Properties   | dynamic  | Event-specific properties (slug, title, etc.)
```

**Materialized Views:**
- `PageViewsByCountry` — views and unique visitors by country/path/day
- `DailyUniqueVisitors` — daily unique visitor and total view counts

**Data Connection:** Event Hub → ADX auto-ingestion (JSON mapping)

## Event Types

| Event | Trigger | Properties |
|-------|---------|------------|
| `page_view` | Every page navigation | `pageTitle`, `pagePath` |
| `blog_view` | Blog post opened | `slug`, `blogTitle` |
| `blog_like` | Like button clicked | `slug` |
| `blog_comment` | Comment submitted | `slug` |
| `blog_share` | Share button used | `slug`, `method` |
| `link_click` | External link clicked | `pagePath`, `targetUrl`, `linkText` |

## KQL Query Examples

See `src/lib/kql-queries.ts` for a full library. Key queries:

- **Visitors by Country**: country-level heatmap data for Power BI maps
- **Daily Trend**: time-series chart of views and unique visitors
- **Top Blog Posts**: ranked by views and unique readers
- **Live Visitors**: real-time count (last 5 minutes)
- **Session Analysis**: average duration, pages per session
- **Referrer Analysis**: top traffic sources by domain

## Power BI Integration

1. Open Power BI Desktop
2. **Get Data → Azure Data Explorer (Kusto)**
3. Cluster URL: `https://<namePrefix>adx.<region>.kusto.windows.net`
4. Database: `TelemetryDb`
5. Use KQL queries from `src/lib/kql-queries.ts` as data sources
6. Recommended visuals:
   - **Map**: Visitors by Country (filled map)
   - **Line Chart**: Daily trend (views + unique visitors)
   - **Bar Chart**: Top pages and blog posts
   - **Card**: Live visitor count
   - **Table**: Session details with country

## Databricks Integration

1. Create a Databricks workspace in Azure
2. Set up Event Hubs connector using `databricks-consumer` consumer group
3. Connection string from Key Vault: `eventhub-connection-string`
4. Use Structured Streaming to process events:

```python
# Databricks notebook
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Read from Event Hubs
eh_conf = {
    "eventhubs.connectionString": dbutils.secrets.get("blog-kv", "eventhub-connection-string"),
    "eventhubs.consumerGroup": "databricks-consumer",
    "eventhubs.startingPosition": '{"offset":"-1","seqNo":-1,"enqueuedTime":null,"isInclusive":true}'
}

df = spark.readStream \
    .format("eventhubs") \
    .options(**eh_conf) \
    .load()

# Parse JSON body
telemetry_schema = StructType([
    StructField("eventType", StringType()),
    StructField("timestamp", TimestampType()),
    StructField("sessionId", StringType()),
    StructField("visitorId", StringType()),
    StructField("path", StringType()),
    StructField("country", StringType()),
    StructField("city", StringType()),
    StructField("properties", MapType(StringType(), StringType()))
])

parsed = df.select(
    from_json(col("body").cast("string"), telemetry_schema).alias("event")
).select("event.*")

# Aggregate: visitors by country per hour
country_stats = parsed \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(window("timestamp", "1 hour"), "country") \
    .agg(
        approx_count_distinct("visitorId").alias("unique_visitors"),
        count("*").alias("total_events")
    )

# Write to Delta table
country_stats.writeStream \
    .format("delta") \
    .outputMode("append") \
    .option("checkpointLocation", "/mnt/telemetry/checkpoints/country_stats") \
    .table("telemetry.country_stats_hourly")
```

## Environment Variables

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` | App Insights (client-side) | K8s Secret |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights (server-side OTel) | K8s Secret |
| `EVENTHUB_CONNECTION_STRING` | Event Hubs send policy | K8s Secret |
| `EVENTHUB_NAME` | Event Hub name (`telemetry-events`) | K8s Secret |
| `OTEL_SERVICE_NAME` | Service name for traces | K8s env |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel Collector endpoint | K8s env |

## Data Flow Summary

1. **User visits any page** → `TelemetryProvider` fires `page_view` event
2. **Event queued** in client-side batch (up to 20 events or 3s timeout)
3. **Batch sent** to `POST /api/telemetry/events`
4. **Server enriches** with geo-location (country from proxy headers)
5. **Parallel fan-out**:
   - → Azure Event Hubs (Kafka) → ADX auto-ingest → KQL queries → Power BI
   - → PostgreSQL `page_views` table → immediate admin dashboard queries
6. **OTel Collector** also exports server traces → Azure Monitor + Event Hubs
7. **Databricks** consumes from Event Hubs for advanced analytics
