// ============================================
// KQL Queries for Azure Data Explorer
//
// Run these in ADX Web Explorer or connect from
// Power BI using the "Azure Data Explorer" connector.
//
// Database: TelemetryDb
// Table: TelemetryEvents
// ============================================

// ---- Page Views ----

// Total page views by page (last 30 days)
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | summarize Views = count(), UniqueVisitors = dcount(VisitorId)
//     by Path
//   | order by Views desc

// ---- Country Analytics ----

// Visitors by country (last 30 days)
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | where isnotempty(Country)
//   | summarize Visitors = dcount(VisitorId), Views = count()
//     by Country
//   | order by Visitors desc

// Country breakdown by page
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | where isnotempty(Country)
//   | summarize Views = count()
//     by Country, Path
//   | order by Views desc

// ---- Time Series ----

// Daily page views trend
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | summarize Views = count(), UniqueVisitors = dcount(VisitorId)
//     by bin(Timestamp, 1d)
//   | order by Timestamp asc
//   | render timechart

// Hourly traffic pattern (for understanding peak hours)
// KQL: TelemetryEvents
//   | where Timestamp > ago(7d)
//   | where EventType in ("page_view", "blog_view")
//   | extend Hour = hourofday(Timestamp)
//   | summarize Views = count()
//     by Hour
//   | order by Hour asc
//   | render columnchart

// ---- Blog Analytics ----

// Most popular blog posts
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType == "blog_view"
//   | extend Slug = tostring(Properties.slug)
//   | summarize Views = count(), UniqueReaders = dcount(VisitorId)
//     by Slug
//   | order by Views desc
//   | take 20

// Blog engagement: likes, comments, shares per post
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("blog_like", "blog_comment", "blog_share")
//   | extend Slug = tostring(Properties.slug)
//   | summarize Likes = countif(EventType == "blog_like"),
//              Comments = countif(EventType == "blog_comment"),
//              Shares = countif(EventType == "blog_share")
//     by Slug
//   | order by Likes + Comments + Shares desc

// ---- User Behavior ----

// Average session duration (approximate from page view timestamps)
// KQL: TelemetryEvents
//   | where Timestamp > ago(7d)
//   | where EventType in ("page_view", "blog_view")
//   | summarize
//       SessionStart = min(Timestamp),
//       SessionEnd = max(Timestamp),
//       PageCount = count()
//     by SessionId
//   | where PageCount > 1
//   | extend SessionDuration = SessionEnd - SessionStart
//   | summarize AvgDuration = avg(SessionDuration), MedianPages = percentile(PageCount, 50)

// Pages per session distribution
// KQL: TelemetryEvents
//   | where Timestamp > ago(7d)
//   | where EventType in ("page_view", "blog_view")
//   | summarize PageCount = count() by SessionId
//   | summarize Sessions = count() by PageCount
//   | order by PageCount asc
//   | render columnchart

// ---- Referrer Analysis ----

// Top referrer sources
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType == "page_view"
//   | where isnotempty(Referrer)
//   | extend ReferrerDomain = extract("https?://([^/]+)", 1, Referrer)
//   | summarize Visits = count() by ReferrerDomain
//   | order by Visits desc
//   | take 20

// ---- Device / Browser Analytics ----

// Screen resolution distribution
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType == "page_view"
//   | extend Resolution = strcat(tostring(ScreenWidth), "x", tostring(ScreenHeight))
//   | summarize Visitors = dcount(VisitorId) by Resolution
//   | order by Visitors desc
//   | take 10

// Language distribution
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | summarize Visitors = dcount(VisitorId) by Language
//   | order by Visitors desc

// ---- Geographic Heatmap Query (for Power BI Map visual) ----

// Country-level visitor heatmap
// KQL: TelemetryEvents
//   | where Timestamp > ago(30d)
//   | where EventType in ("page_view", "blog_view")
//   | where isnotempty(Country)
//   | summarize
//       TotalViews = count(),
//       UniqueVisitors = dcount(VisitorId),
//       AvgSessionPages = avg(1.0)
//     by Country
//   | order by UniqueVisitors desc

// ---- Real-time Dashboard Queries ----

// Live visitors in last 5 minutes
// KQL: TelemetryEvents
//   | where Timestamp > ago(5m)
//   | where EventType in ("page_view", "blog_view")
//   | summarize ActiveVisitors = dcount(VisitorId), CurrentPages = dcount(Path)

// Last 10 page views (real-time feed)
// KQL: TelemetryEvents
//   | where Timestamp > ago(1h)
//   | where EventType in ("page_view", "blog_view")
//   | project Timestamp, Path, Country, VisitorId
//   | order by Timestamp desc
//   | take 10

export const KQL_QUERIES = {
  // These strings can be used programmatically if needed
  pageViewsByPath: `TelemetryEvents | where Timestamp > ago(30d) | where EventType in ("page_view", "blog_view") | summarize Views = count(), UniqueVisitors = dcount(VisitorId) by Path | order by Views desc`,
  visitorsByCountry: `TelemetryEvents | where Timestamp > ago(30d) | where EventType in ("page_view", "blog_view") | where isnotempty(Country) | summarize Visitors = dcount(VisitorId), Views = count() by Country | order by Visitors desc`,
  dailyTrend: `TelemetryEvents | where Timestamp > ago(30d) | where EventType in ("page_view", "blog_view") | summarize Views = count(), UniqueVisitors = dcount(VisitorId) by bin(Timestamp, 1d) | order by Timestamp asc`,
  topBlogs: `TelemetryEvents | where Timestamp > ago(30d) | where EventType == "blog_view" | extend Slug = tostring(Properties.slug) | summarize Views = count(), UniqueReaders = dcount(VisitorId) by Slug | order by Views desc | take 20`,
  liveVisitors: `TelemetryEvents | where Timestamp > ago(5m) | where EventType in ("page_view", "blog_view") | summarize ActiveVisitors = dcount(VisitorId), CurrentPages = dcount(Path)`,
} as const;
