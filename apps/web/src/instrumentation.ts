// ============================================
// Next.js Instrumentation Hook
//
// This file is automatically loaded by Next.js
// when the server starts (requires experimental
// instrumentationHook in next.config.js).
//
// Initializes server-side OpenTelemetry tracing.
// ============================================

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerTelemetry } = await import("./lib/otel-server");
    initServerTelemetry();
  }
}
