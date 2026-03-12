"use client";

// ============================================
// Client-side Telemetry Event Types & Sender
// Sends structured events to /api/telemetry/events
// which forwards them to Azure Event Hubs (Kafka)
// ============================================

export interface TelemetryEvent {
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

// ---- Session & Visitor ID Management ----

let cachedSessionId: string | null = null;
let cachedVisitorId: string | null = null;

function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  if (typeof window === "undefined") return "server";

  let sessionId = sessionStorage.getItem("telemetry_session_id");
  if (!sessionId) {
    sessionId = generateId();
    sessionStorage.setItem("telemetry_session_id", sessionId);
  }
  cachedSessionId = sessionId;
  return sessionId;
}

export function getVisitorId(): string {
  if (cachedVisitorId) return cachedVisitorId;
  if (typeof window === "undefined") return "server";

  let visitorId = localStorage.getItem("telemetry_visitor_id");
  if (!visitorId) {
    visitorId = generateId();
    localStorage.setItem("telemetry_visitor_id", visitorId);
  }
  cachedVisitorId = visitorId;
  return visitorId;
}

// ---- Event Builder ----

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

// ---- Event Queue & Sender ----

const eventQueue: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 3000;
const MAX_BATCH_SIZE = 20;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushEvents();
  }, FLUSH_INTERVAL_MS);
}

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
    if (!response.ok) {
      // Re-queue on failure (best-effort, drop if queue gets too large)
      if (eventQueue.length < 100) {
        eventQueue.push(...batch);
      }
    }
  } catch {
    // Network error - re-queue with limit
    if (eventQueue.length < 100) {
      eventQueue.push(...batch);
    }
  }

  // If more events remain, schedule another flush
  if (eventQueue.length > 0) {
    scheduleFlush();
  }
}

function enqueueEvent(event: TelemetryEvent) {
  eventQueue.push(event);
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushEvents();
  } else {
    scheduleFlush();
  }
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushEvents();
    }
  });
  window.addEventListener("pagehide", () => {
    flushEvents();
  });
}

// ---- Public Tracking Functions ----

export function trackPageView(path?: string, title?: string) {
  if (typeof window === "undefined") return;
  const event = buildEvent("page_view", {
    pageTitle: title || document.title,
    pagePath: path || window.location.pathname,
  });
  enqueueEvent(event);
}

export function trackBlogView(slug: string, title: string) {
  if (typeof window === "undefined") return;
  const event = buildEvent("blog_view", { slug, blogTitle: title });
  enqueueEvent(event);
}

export function trackLike(slug: string) {
  if (typeof window === "undefined") return;
  enqueueEvent(buildEvent("blog_like", { slug }));
}

export function trackComment(slug: string) {
  if (typeof window === "undefined") return;
  enqueueEvent(buildEvent("blog_comment", { slug }));
}

export function trackShare(slug: string, method: string) {
  if (typeof window === "undefined") return;
  enqueueEvent(buildEvent("blog_share", { slug, method }));
}

export function trackLinkClick(
  pagePath: string,
  targetUrl: string,
  linkText?: string
) {
  if (typeof window === "undefined") return;
  enqueueEvent(
    buildEvent("link_click", {
      pagePath,
      targetUrl,
      linkText: linkText || "",
    })
  );
}

export function trackCustomEvent(
  name: string,
  properties: Record<string, string> = {}
) {
  if (typeof window === "undefined") return;
  enqueueEvent(buildEvent(name, properties));
}
