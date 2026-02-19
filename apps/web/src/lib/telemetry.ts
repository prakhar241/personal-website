"use client";

import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsights: ApplicationInsights | null = null;

export function initTelemetry(): ApplicationInsights | null {
  if (typeof window === "undefined") return null;
  if (appInsights) return appInsights;

  const connectionString =
    process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    console.warn("App Insights connection string not configured");
    return null;
  }

  appInsights = new ApplicationInsights({
    config: {
      connectionString,
      enableAutoRouteTracking: true,
      enableCorsCorrelation: true,
      enableRequestHeaderTracking: true,
      enableResponseHeaderTracking: true,
    },
  });

  appInsights.loadAppInsights();
  return appInsights;
}

export function trackEvent(name: string, properties?: Record<string, string>) {
  appInsights?.trackEvent({ name }, properties);
}

export function trackPageView(name: string, uri?: string) {
  appInsights?.trackPageView({ name, uri });
}

export function trackLinkClick(
  pagePath: string,
  targetUrl: string,
  linkText?: string
) {
  trackEvent("LinkClick", { pagePath, targetUrl, linkText: linkText || "" });
}

export function trackBlogView(slug: string, title: string) {
  trackEvent("BlogView", { slug, title });
}

export function trackLike(slug: string) {
  trackEvent("BlogLike", { slug });
}

export function trackComment(slug: string) {
  trackEvent("BlogComment", { slug });
}

export function trackShare(slug: string, method: string) {
  trackEvent("BlogShare", { slug, method });
}

export { appInsights };
