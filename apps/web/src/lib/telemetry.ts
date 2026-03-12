"use client";

// ============================================
// Unified Telemetry - OpenTelemetry + Event Hub Pipeline
//
// Client-side: OpenTelemetry Web SDK for traces/spans
// + Custom event pipeline → /api/telemetry/events → Azure Event Hubs
//
// Keeps Application Insights for backward compat but
// all new events flow through the event-driven pipeline.
// ============================================

import { ApplicationInsights } from "@microsoft/applicationinsights-web";
import {
  trackPageView as trackPageViewEvent,
  trackBlogView as trackBlogViewEvent,
  trackLike as trackLikeEvent,
  trackComment as trackCommentEvent,
  trackShare as trackShareEvent,
  trackLinkClick as trackLinkClickEvent,
  trackCustomEvent,
} from "./telemetry-events";

let appInsights: ApplicationInsights | null = null;
let initialized = false;

export function initTelemetry(): ApplicationInsights | null {
  if (typeof window === "undefined") return null;
  if (initialized) return appInsights;
  initialized = true;

  // Initialize Application Insights (backward compat)
  const connectionString =
    process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING;
  if (connectionString) {
    appInsights = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: false, // We handle route tracking ourselves now
        enableCorsCorrelation: true,
        enableRequestHeaderTracking: true,
        enableResponseHeaderTracking: true,
        disableFetchTracking: false,
      },
    });
    appInsights.loadAppInsights();
  }

  return appInsights;
}

// ---- Dual-write: App Insights + Event Hub Pipeline ----

export function trackEvent(name: string, properties?: Record<string, string>) {
  appInsights?.trackEvent({ name }, properties);
  trackCustomEvent(name, properties || {});
}

export function trackPageView(name: string, uri?: string) {
  appInsights?.trackPageView({ name, uri });
  trackPageViewEvent(uri, name);
}

export function trackLinkClick(
  pagePath: string,
  targetUrl: string,
  linkText?: string
) {
  appInsights?.trackEvent(
    { name: "LinkClick" },
    { pagePath, targetUrl, linkText: linkText || "" }
  );
  trackLinkClickEvent(pagePath, targetUrl, linkText);
}

export function trackBlogView(slug: string, title: string) {
  appInsights?.trackEvent({ name: "BlogView" }, { slug, title });
  trackBlogViewEvent(slug, title);
}

export function trackLike(slug: string) {
  appInsights?.trackEvent({ name: "BlogLike" }, { slug });
  trackLikeEvent(slug);
}

export function trackComment(slug: string) {
  appInsights?.trackEvent({ name: "BlogComment" }, { slug });
  trackCommentEvent(slug);
}

export function trackShare(slug: string, method: string) {
  appInsights?.trackEvent({ name: "BlogShare" }, { slug, method });
  trackShareEvent(slug, method);
}

export { appInsights };
