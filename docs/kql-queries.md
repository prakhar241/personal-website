# KQL Query Reference — Telemetry Analytics

> **Database:** `TelemetryDb` on cluster `blogpreprodadx.centralus.kusto.windows.net`
>
> Run these in **ADX Web Explorer**, **Kusto Explorer**, or connect from **Power BI** using the Azure Data Explorer connector.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Schema Reference](#schema-reference)
3. [Client-Side Queries (ADX — TelemetryEvents)](#client-side-queries)
   - [Page Views](#page-views)
   - [Blog Analytics](#blog-analytics)
   - [Geographic Analytics](#geographic-analytics)
   - [Referrer Analysis](#referrer-analysis)
   - [Device & Browser](#device--browser)
   - [User Behavior / Sessions](#user-behavior--sessions)
   - [Time Series & Trends](#time-series--trends)
   - [Real-Time Dashboard](#real-time-dashboard)
   - [Materialized Views](#materialized-views)
4. [Server-Side Queries (Application Insights)](#server-side-queries)
   - [API Route Performance](#api-route-performance)
   - [Telemetry Ingestion Pipeline](#telemetry-ingestion-pipeline)
   - [Event Hub Producer Health](#event-hub-producer-health)
   - [Database Performance](#database-performance)
   - [Server Errors & Exceptions](#server-errors--exceptions)
   - [OTel Collector Health](#otel-collector-health)
   - [Dependency Tracking](#dependency-tracking)
5. [Server-Side Queries (OTel Traces via Event Hubs)](#server-side-queries-otel-traces)
6. [Combined Client + Server Queries](#combined-queries)
7. [Power BI Optimized Queries](#power-bi-optimized-queries)
8. [Admin Dashboard Queries](#admin-dashboard-queries)
9. [Alerting Queries](#alerting-queries)

---

## Architecture Overview

```
Client-Side Events                    Server-Side Traces
(browser → /api/telemetry/events)     (Next.js → OTel SDK)
         │                                     │
         ▼                                     ▼
   Azure Event Hubs ◄───────────── OTel Collector sidecar
   (telemetry-events hub)           (otel-traces hub)
         │                                     │
         ▼                                     ▼
   Azure Data Explorer              Azure Monitor /
   (TelemetryEvents table)          Application Insights
         │                           (traces, requests,
         └── KQL + Power BI          dependencies, exceptions)
```

**Two data stores, two query languages (both KQL, different endpoints):**

| Aspect | Client-Side | Server-Side |
|--------|------------|-------------|
| Data source | Browser events | Next.js server spans |
| Transport | Event Hubs → ADX ingestion | OTel → App Insights |
| Query endpoint | ADX cluster (`blogpreprodadx`) | Application Insights / Log Analytics |
| Table | `TelemetryEvents` | `requests`, `traces`, `dependencies`, `exceptions` |
| Event types | `page_view`, `blog_view`, `blog_like`, `blog_comment`, `blog_share`, `link_click` | HTTP requests, spans, errors |

---

## Schema Reference

### TelemetryEvents (ADX)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| `EventType` | string | Client | `page_view`, `blog_view`, `blog_like`, `blog_comment`, `blog_share`, `link_click` |
| `Timestamp` | datetime | Client | ISO 8601 timestamp from the browser |
| `SessionId` | string | Client | Per-tab session (sessionStorage) |
| `VisitorId` | string | Client | Persistent visitor (localStorage) |
| `Url` | string | Client | Full URL including query string |
| `Path` | string | Client | URL pathname (e.g., `/blogs/my-post`) |
| `Referrer` | string | Client | `document.referrer` |
| `UserAgent` | string | Client | `navigator.userAgent` |
| `ScreenWidth` | int | Client | `screen.width` |
| `ScreenHeight` | int | Client | `screen.height` |
| `Language` | string | Client | `navigator.language` |
| `Timezone` | string | Client | `Intl.DateTimeFormat` timezone |
| `Country` | string | Server | Geo-enriched from proxy headers |
| `City` | string | Server | Geo-enriched from proxy headers |
| `Region` | string | Server | Geo-enriched from proxy headers |
| `Properties` | dynamic | Client | Event-specific data (slug, method, etc.) |

### Application Insights Tables (Log Analytics)

| Table | Description |
|-------|-------------|
| `requests` | Server-side HTTP requests (API routes, pages) |
| `traces` | Custom log traces from `console.log`, `trackTrace()` |
| `dependencies` | Outbound calls (PostgreSQL, Event Hubs, external APIs) |
| `exceptions` | Unhandled exceptions and `trackException()` |
| `customEvents` | `trackEvent()` calls from the dual-write telemetry wrapper |
| `customMetrics` | Performance counters and custom metrics |
| `pageViews` | App Insights auto-tracked page views (disabled — we use our own) |

---

## Client-Side Queries

### Page Views

```kql
// Total page views by page (last 30 days)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId)
  by Path
| order by Views desc
```

```kql
// Page views for a specific page
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where Path == "/blogs/my-post-slug"
| summarize Views = count(), UniqueVisitors = dcount(VisitorId)
```

```kql
// New vs returning visitors
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize FirstSeen = min(Timestamp) by VisitorId
| extend IsNew = FirstSeen > ago(7d)
| summarize NewVisitors = countif(IsNew), ReturningVisitors = countif(not(IsNew))
```

```kql
// Bounce rate per page (single-page sessions)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize PageCount = dcount(Path), LandingPage = min(Path) by SessionId
| summarize
    TotalSessions = count(),
    BouncedSessions = countif(PageCount == 1)
  by LandingPage
| extend BounceRate = round(100.0 * BouncedSessions / TotalSessions, 1)
| order by TotalSessions desc
```

### Blog Analytics

```kql
// Most popular blog posts
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "blog_view"
| extend Slug = tostring(Properties.slug)
| summarize Views = count(), UniqueReaders = dcount(VisitorId)
  by Slug
| order by Views desc
| take 20
```

```kql
// Blog engagement: likes, comments, shares per post
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("blog_like", "blog_comment", "blog_share")
| extend Slug = tostring(Properties.slug)
| summarize
    Likes = countif(EventType == "blog_like"),
    Comments = countif(EventType == "blog_comment"),
    Shares = countif(EventType == "blog_share")
  by Slug
| extend TotalEngagement = Likes + Comments + Shares
| order by TotalEngagement desc
```

```kql
// Blog read-through estimation (time between blog_view and next event)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("blog_view", "page_view", "link_click")
| order by SessionId asc, Timestamp asc
| extend NextEvent = next(Timestamp), NextSessionId = next(SessionId)
| where EventType == "blog_view" and SessionId == NextSessionId
| extend ReadDuration = NextEvent - Timestamp
| where ReadDuration between (10s .. 30m)
| extend Slug = tostring(Properties.slug)
| summarize AvgReadTime = avg(ReadDuration), MedianReadTime = percentile(ReadDuration, 50) by Slug
| order by AvgReadTime desc
```

```kql
// Blog posts with high views but low engagement (optimization targets)
let views = TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "blog_view"
| extend Slug = tostring(Properties.slug)
| summarize Views = count() by Slug;
let engagement = TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("blog_like", "blog_comment", "blog_share")
| extend Slug = tostring(Properties.slug)
| summarize Engagements = count() by Slug;
views
| join kind=leftouter engagement on Slug
| extend Engagements = coalesce(Engagements, 0)
| extend EngagementRate = round(100.0 * Engagements / Views, 2)
| where Views > 10
| order by EngagementRate asc
```

### Geographic Analytics

```kql
// Visitors by country (last 30 days)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize Visitors = dcount(VisitorId), Views = count()
  by Country
| order by Visitors desc
```

```kql
// Country + city drill-down
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country) and isnotempty(City)
| summarize Visitors = dcount(VisitorId), Views = count()
  by Country, City
| order by Visitors desc
| take 50
```

```kql
// Country breakdown by page
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize Views = count()
  by Country, Path
| order by Views desc
```

```kql
// Regional traffic patterns (peak hours by timezone)
TelemetryEvents
| where Timestamp > ago(7d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Timezone)
| extend HourUTC = hourofday(Timestamp)
| summarize Views = count() by Timezone, HourUTC
| order by Timezone asc, HourUTC asc
```

```kql
// Country-level visitor heatmap (for Power BI Map visual)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize
    TotalViews = count(),
    UniqueVisitors = dcount(VisitorId),
    AvgPagesPerVisitor = count() * 1.0 / dcount(VisitorId)
  by Country
| order by UniqueVisitors desc
```

### Referrer Analysis

```kql
// Top referrer sources
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "page_view"
| where isnotempty(Referrer)
| extend ReferrerDomain = extract("https?://([^/]+)", 1, Referrer)
| summarize Visits = count(), UniqueVisitors = dcount(VisitorId)
  by ReferrerDomain
| order by Visits desc
| take 20
```

```kql
// Referrer → landing page flow
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Referrer)
| extend ReferrerDomain = extract("https?://([^/]+)", 1, Referrer)
| summarize Views = count() by ReferrerDomain, Path
| order by Views desc
| take 50
```

```kql
// Direct traffic vs referred traffic vs search engines
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| extend TrafficSource = case(
    isempty(Referrer), "Direct",
    Referrer has_any ("google", "bing", "duckduckgo", "yahoo", "baidu"), "Search Engine",
    Referrer has_any ("twitter", "linkedin", "facebook", "reddit", "hn"), "Social Media",
    "Other Referral")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId) by TrafficSource
| order by Views desc
```

### Device & Browser

```kql
// Screen resolution distribution
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "page_view"
| extend Resolution = strcat(tostring(ScreenWidth), "x", tostring(ScreenHeight))
| summarize Visitors = dcount(VisitorId) by Resolution
| order by Visitors desc
| take 15
```

```kql
// Mobile vs Desktop vs Tablet
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| extend DeviceType = case(
    ScreenWidth <= 480, "Mobile",
    ScreenWidth <= 1024, "Tablet",
    "Desktop")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId) by DeviceType
```

```kql
// Browser detection from user agent
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "page_view"
| extend Browser = case(
    UserAgent has "Edg/", "Edge",
    UserAgent has "Chrome/" and UserAgent !has "Edg/", "Chrome",
    UserAgent has "Firefox/", "Firefox",
    UserAgent has "Safari/" and UserAgent !has "Chrome/", "Safari",
    "Other")
| summarize Visitors = dcount(VisitorId) by Browser
| order by Visitors desc
```

```kql
// Language distribution
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Visitors = dcount(VisitorId) by Language
| order by Visitors desc
```

### User Behavior / Sessions

```kql
// Average session duration
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
| summarize
    AvgDuration = avg(SessionDuration),
    MedianDuration = percentile(SessionDuration, 50),
    P90Duration = percentile(SessionDuration, 90)
```

```kql
// Pages per session distribution
TelemetryEvents
| where Timestamp > ago(7d)
| where EventType in ("page_view", "blog_view")
| summarize PageCount = count() by SessionId
| summarize Sessions = count() by PageCount
| order by PageCount asc
| render columnchart
```

```kql
// User journey: most common navigation paths (top 3 page sequences)
TelemetryEvents
| where Timestamp > ago(7d)
| where EventType in ("page_view", "blog_view")
| order by SessionId, Timestamp asc
| summarize Pages = make_list(Path) by SessionId
| where array_length(Pages) >= 2
| extend Journey = strcat(tostring(Pages[0]), " → ", tostring(Pages[1]),
    iff(array_length(Pages) > 2, strcat(" → ", tostring(Pages[2])), ""))
| summarize Count = count() by Journey
| order by Count desc
| take 20
```

```kql
// Link click analysis
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType == "link_click"
| extend Target = tostring(Properties.target), LinkPath = tostring(Properties.path)
| summarize Clicks = count() by Target, LinkPath
| order by Clicks desc
| take 30
```

### Time Series & Trends

```kql
// Daily page views trend
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId)
  by bin(Timestamp, 1d)
| order by Timestamp asc
| render timechart
```

```kql
// Hourly traffic pattern (peak hours)
TelemetryEvents
| where Timestamp > ago(7d)
| where EventType in ("page_view", "blog_view")
| extend Hour = hourofday(Timestamp)
| summarize Views = count()
  by Hour
| order by Hour asc
| render columnchart
```

```kql
// Day-of-week traffic pattern
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| extend DayOfWeek = dayofweek(Timestamp) / 1d
| extend DayName = case(
    DayOfWeek == 0, "Sunday",
    DayOfWeek == 1, "Monday",
    DayOfWeek == 2, "Tuesday",
    DayOfWeek == 3, "Wednesday",
    DayOfWeek == 4, "Thursday",
    DayOfWeek == 5, "Friday",
    "Saturday")
| summarize Views = count() by DayOfWeek, DayName
| order by DayOfWeek asc
```

```kql
// Week-over-week comparison
TelemetryEvents
| where Timestamp > ago(14d)
| where EventType in ("page_view", "blog_view")
| extend Week = iff(Timestamp > ago(7d), "This Week", "Last Week")
| summarize Views = count(), UniqueVisitors = dcount(VisitorId) by Week
```

### Real-Time Dashboard

```kql
// Live visitors in last 5 minutes
TelemetryEvents
| where Timestamp > ago(5m)
| where EventType in ("page_view", "blog_view")
| summarize
    ActiveVisitors = dcount(VisitorId),
    ActiveSessions = dcount(SessionId),
    PagesViewed = count()
```

```kql
// Last 10 page views (real-time feed)
TelemetryEvents
| where Timestamp > ago(1h)
| where EventType in ("page_view", "blog_view")
| project Timestamp, Path, Country, City, VisitorId
| order by Timestamp desc
| take 10
```

```kql
// Current popular pages (last 15 minutes)
TelemetryEvents
| where Timestamp > ago(15m)
| where EventType in ("page_view", "blog_view")
| summarize Views = count() by Path
| order by Views desc
| take 10
```

### Materialized Views

These are pre-computed in ADX for faster queries:

```kql
// Fast: page views per country per day (materialized)
PageViewsByCountry
| where Timestamp > ago(30d)
| summarize TotalViews = sum(ViewCount), TotalUnique = sum(UniqueVisitors)
  by Country
| order by TotalViews desc
```

```kql
// Fast: daily unique visitors (materialized)
DailyUniqueVisitors
| where Timestamp > ago(30d)
| order by Timestamp desc
```

---

## Server-Side Queries

> **These queries run in Application Insights / Log Analytics**, not in ADX.
> Open your Application Insights resource → Logs, or use a Log Analytics workspace.
>
> Resource: The App Insights instance connected via `APPLICATIONINSIGHTS_CONNECTION_STRING`.

### API Route Performance

```kql
// API route latency (P50, P90, P99)
requests
| where timestamp > ago(24h)
| where url has "/api/"
| extend Route = extract("(/api/[^?]+)", 1, url)
| summarize
    P50 = percentile(duration, 50),
    P90 = percentile(duration, 90),
    P99 = percentile(duration, 99),
    Count = count(),
    FailureRate = round(100.0 * countif(success == false) / count(), 2)
  by Route
| order by Count desc
```

```kql
// Slowest API requests (last 24h)
requests
| where timestamp > ago(24h)
| where url has "/api/"
| where duration > 1000
| project timestamp, url, duration, resultCode, success
| order by duration desc
| take 20
```

```kql
// API error rate over time
requests
| where timestamp > ago(7d)
| where url has "/api/"
| summarize
    TotalRequests = count(),
    FailedRequests = countif(success == false),
    ErrorRate = round(100.0 * countif(success == false) / count(), 2)
  by bin(timestamp, 1h)
| render timechart
```

```kql
// HTTP status code distribution
requests
| where timestamp > ago(24h)
| where url has "/api/"
| summarize Count = count() by resultCode
| order by Count desc
```

### Telemetry Ingestion Pipeline

```kql
// Telemetry events API performance (the ingestion endpoint itself)
requests
| where timestamp > ago(24h)
| where url has "/api/telemetry/events"
| summarize
    AvgLatency = avg(duration),
    P90Latency = percentile(duration, 90),
    TotalRequests = count(),
    FailedRequests = countif(success == false),
    AvgEventsPerBatch = avg(toint(customDimensions.eventsProcessed))
  by bin(timestamp, 1h)
| order by timestamp desc
```

```kql
// Telemetry ingestion trace spans (from OTel traceEventIngestion)
traces
| where timestamp > ago(24h)
| where message has "telemetry" or customDimensions has "telemetry.ingest"
| project timestamp, message, severityLevel, customDimensions
| order by timestamp desc
| take 50
```

```kql
// Failed telemetry writes (Event Hub or PostgreSQL errors)
traces
| where timestamp > ago(24h)
| where message has "[Telemetry]" and message has "failed"
| project timestamp, message, severityLevel
| order by timestamp desc
```

### Event Hub Producer Health

```kql
// Event Hub send latency (outbound dependency)
dependencies
| where timestamp > ago(24h)
| where type == "Azure Event Hubs" or name has "eventhub" or target has "servicebus"
| summarize
    AvgDuration = avg(duration),
    P90Duration = percentile(duration, 90),
    TotalCalls = count(),
    Failures = countif(success == false)
  by bin(timestamp, 1h)
| order by timestamp desc
```

```kql
// Event Hub failures detailed
dependencies
| where timestamp > ago(24h)
| where (type == "Azure Event Hubs" or target has "servicebus") and success == false
| project timestamp, name, target, duration, resultCode, data
| order by timestamp desc
```

### Database Performance

```kql
// PostgreSQL query latency
dependencies
| where timestamp > ago(24h)
| where type == "PostgreSQL" or type has "postgres" or target has "postgres"
| summarize
    AvgDuration = avg(duration),
    P90Duration = percentile(duration, 90),
    TotalQueries = count(),
    Failures = countif(success == false)
  by bin(timestamp, 1h)
| order by timestamp desc
```

```kql
// Slowest database queries
dependencies
| where timestamp > ago(24h)
| where type has "postgres" or target has "postgres"
| where duration > 500
| project timestamp, name, data, duration, success
| order by duration desc
| take 20
```

### Server Errors & Exceptions

```kql
// All unhandled exceptions (last 24h)
exceptions
| where timestamp > ago(24h)
| summarize Count = count() by type, outerMessage
| order by Count desc
```

```kql
// Exception timeline
exceptions
| where timestamp > ago(7d)
| summarize Exceptions = count() by bin(timestamp, 1h)
| render timechart
```

```kql
// Full exception details with stack traces
exceptions
| where timestamp > ago(24h)
| project timestamp, type, outerMessage, innermostMessage, details
| order by timestamp desc
| take 20
```

```kql
// 5xx errors on page routes
requests
| where timestamp > ago(24h)
| where toint(resultCode) >= 500
| project timestamp, url, resultCode, duration
| order by timestamp desc
```

### OTel Collector Health

```kql
// Custom events from the dual-write telemetry wrapper
customEvents
| where timestamp > ago(24h)
| summarize Count = count() by name
| order by Count desc
```

```kql
// OTel initialization traces
traces
| where timestamp > ago(24h)
| where message has "[OTel]"
| project timestamp, message
| order by timestamp desc
```

### Dependency Tracking

```kql
// All outbound dependency calls (Event Hubs, PostgreSQL, external APIs)
dependencies
| where timestamp > ago(24h)
| summarize
    AvgDuration = avg(duration),
    Calls = count(),
    FailureRate = round(100.0 * countif(success == false) / count(), 2)
  by type, target
| order by Calls desc
```

```kql
// Dependency failure timeline
dependencies
| where timestamp > ago(7d)
| where success == false
| summarize Failures = count() by bin(timestamp, 1h), type
| render timechart
```

---

## Server-Side Queries (OTel Traces via Event Hubs)

> The OTel Collector also exports server traces to Event Hubs topic `otel-traces`.
> If this data is ingested into a separate ADX table, use these queries.
> Otherwise, these traces are available in Application Insights (see above).

```kql
// If OTel traces are ingested to an ADX table (e.g., OTelTraces):
// OTelTraces
// | where Timestamp > ago(24h)
// | where SpanName has "telemetry.ingest"
// | summarize AvgDuration = avg(DurationMs), Count = count()
//   by bin(Timestamp, 1h)
// | render timechart
```

---

## Combined Queries

> These correlate client-side events (ADX) with server-side data to get the full picture.

### Client vs Server Event Count Reconciliation

Run in **Application Insights**:
```kql
// How many telemetry event batches hit the server
requests
| where timestamp > ago(24h)
| where url has "/api/telemetry/events"
| summarize
    BatchRequests = count(),
    SuccessfulBatches = countif(success == true),
    FailedBatches = countif(success == false)
  by bin(timestamp, 1h)
```

Run in **ADX** to compare:
```kql
// How many events actually landed in ADX
TelemetryEvents
| where Timestamp > ago(24h)
| summarize EventsIngested = count() by bin(Timestamp, 1h)
| order by Timestamp desc
```

### Ingestion Lag Estimation

Run in **ADX**:
```kql
// Lag between client event timestamp and ADX ingestion time
TelemetryEvents
| where Timestamp > ago(1h)
| extend IngestionTime = ingestion_time()
| extend LagSeconds = datetime_diff('second', IngestionTime, Timestamp)
| summarize
    AvgLag = avg(LagSeconds),
    P90Lag = percentile(LagSeconds, 90),
    MaxLag = max(LagSeconds)
```

### Full Funnel: Visit → Engagement

Run in **ADX**:
```kql
// Funnel: page_view → blog_view → blog_like
let visitors = TelemetryEvents
| where Timestamp > ago(30d)
| summarize
    HasPageView = countif(EventType == "page_view") > 0,
    HasBlogView = countif(EventType == "blog_view") > 0,
    HasLike = countif(EventType == "blog_like") > 0,
    HasComment = countif(EventType == "blog_comment") > 0,
    HasShare = countif(EventType == "blog_share") > 0
  by VisitorId;
visitors
| summarize
    TotalVisitors = count(),
    ViewedBlog = countif(HasBlogView),
    LikedPost = countif(HasLike),
    Commented = countif(HasComment),
    Shared = countif(HasShare)
```

---

## Power BI Optimized Queries

> Use these as data sources in Power BI via the Azure Data Explorer connector.
> Keep queries simple and pre-aggregated for best performance.

```kql
// Daily metrics summary (single table for Power BI dashboard)
TelemetryEvents
| where Timestamp > ago(90d)
| where EventType in ("page_view", "blog_view")
| summarize
    TotalViews = count(),
    UniqueVisitors = dcount(VisitorId),
    UniqueSessions = dcount(SessionId)
  by Date = bin(Timestamp, 1d), Country
| order by Date desc
```

```kql
// Blog performance summary (for Power BI bar chart)
TelemetryEvents
| where Timestamp > ago(90d)
| where EventType in ("blog_view", "blog_like", "blog_comment", "blog_share")
| extend Slug = tostring(Properties.slug)
| summarize
    Views = countif(EventType == "blog_view"),
    Likes = countif(EventType == "blog_like"),
    Comments = countif(EventType == "blog_comment"),
    Shares = countif(EventType == "blog_share"),
    UniqueReaders = dcountif(VisitorId, EventType == "blog_view")
  by Slug
| order by Views desc
```

```kql
// Geographic heatmap data (for Power BI Map visual)
TelemetryEvents
| where Timestamp > ago(90d)
| where EventType in ("page_view", "blog_view")
| where isnotempty(Country)
| summarize
    TotalViews = count(),
    UniqueVisitors = dcount(VisitorId)
  by Country, City
| order by TotalViews desc
```

```kql
// Device type breakout (for Power BI pie chart)
TelemetryEvents
| where Timestamp > ago(90d)
| where EventType in ("page_view", "blog_view")
| extend DeviceType = case(
    ScreenWidth <= 480, "Mobile",
    ScreenWidth <= 1024, "Tablet",
    "Desktop")
| summarize Visitors = dcount(VisitorId), Views = count() by DeviceType
```

---

## Admin Dashboard Queries

> These match the queries used by the `/admin/dashboard` page,
> which currently queries PostgreSQL. Equivalent ADX versions below.

```kql
// Overall stats (equivalent to admin analytics API)
let days = 30;
TelemetryEvents
| where Timestamp > ago(30d)
| summarize
    TotalViews = countif(EventType in ("page_view", "blog_view")),
    UniqueVisitors = dcount(VisitorId),
    TotalLikes = countif(EventType == "blog_like"),
    TotalComments = countif(EventType == "blog_comment")
```

```kql
// Post performance (equivalent to admin post stats)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("blog_view", "blog_like", "blog_comment")
| extend Slug = tostring(Properties.slug)
| summarize
    Views = countif(EventType == "blog_view"),
    Likes = countif(EventType == "blog_like"),
    Comments = countif(EventType == "blog_comment")
  by Slug
| order by Views desc
```

```kql
// Top pages (equivalent to admin top pages)
TelemetryEvents
| where Timestamp > ago(30d)
| where EventType in ("page_view", "blog_view")
| summarize Views = count() by Path
| order by Views desc
| take 10
```

---

## Alerting Queries

> Use these in Azure Monitor alert rules or ADX continuous export.

### Drop in Traffic Alert

```kql
// Alert if page views drop > 50% compared to same hour yesterday
let currentHour = TelemetryEvents
| where Timestamp > ago(1h)
| where EventType in ("page_view", "blog_view")
| summarize CurrentViews = count();
let previousHour = TelemetryEvents
| where Timestamp between (ago(25h) .. ago(24h))
| where EventType in ("page_view", "blog_view")
| summarize PreviousViews = count();
currentHour
| extend PreviousViews = toscalar(previousHour | project PreviousViews)
| where CurrentViews < PreviousViews * 0.5
```

### Ingestion Lag Alert

```kql
// Alert if ingestion lag exceeds 5 minutes
TelemetryEvents
| where Timestamp > ago(30m)
| extend IngestionTime = ingestion_time()
| extend LagSeconds = datetime_diff('second', IngestionTime, Timestamp)
| summarize AvgLag = avg(LagSeconds), MaxLag = max(LagSeconds)
| where MaxLag > 300
```

### Zero Events Alert

```kql
// Alert if no events received in last 15 minutes
TelemetryEvents
| where Timestamp > ago(15m)
| count
| where Count == 0
```

### High Error Rate (Application Insights)

```kql
// Alert if API error rate exceeds 5%
requests
| where timestamp > ago(15m)
| where url has "/api/"
| summarize
    ErrorRate = round(100.0 * countif(toint(resultCode) >= 500) / count(), 2)
| where ErrorRate > 5
```

---

## Quick Reference

| What | Where to Query | Table |
|------|---------------|-------|
| Page views, blog views, likes, shares, comments | ADX (`blogpreprodadx`) | `TelemetryEvents` |
| Pre-aggregated country stats | ADX | `PageViewsByCountry` (materialized view) |
| Pre-aggregated daily visitors | ADX | `DailyUniqueVisitors` (materialized view) |
| API route latency & errors | Application Insights | `requests` |
| Outbound dependency health (Event Hub, PG) | Application Insights | `dependencies` |
| Server exceptions & stack traces | Application Insights | `exceptions` |
| Custom trace logs | Application Insights | `traces` |
| Dual-write custom events | Application Insights | `customEvents` |
| OTel collector traces | Application Insights + Event Hubs `otel-traces` topic | `traces` |
