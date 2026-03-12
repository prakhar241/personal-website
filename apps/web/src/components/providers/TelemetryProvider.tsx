"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/telemetry-events";

export function TelemetryProvider() {
  const pathname = usePathname();
  const prevPathRef = useRef<string>("");
  const initRef = useRef(false);

  // Initialize Application Insights on mount (dynamic import to avoid bundle issues)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
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
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
