// ============================================
// Server-side OpenTelemetry Instrumentation
//
// Initializes OpenTelemetry tracing for the Next.js
// server. Sends traces to the OTel Collector sidecar
// which exports to Azure Monitor and Azure Data Explorer.
//
// Load this file early - e.g., via NODE_OPTIONS or
// Next.js instrumentation hook.
// ============================================

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode } from "@opentelemetry/api";

let initialized = false;

export function initServerTelemetry() {
  if (initialized) return;
  initialized = true;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "personal-website",
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
    "deployment.environment": process.env.NODE_ENV || "development",
  });

  // Build span processors
  const spanProcessors: BatchSpanProcessor[] = [];

  // Export to OTel Collector sidecar (OTLP over HTTP)
  const collectorUrl =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";
  const otlpExporter = new OTLPTraceExporter({
    url: `${collectorUrl}/v1/traces`,
  });
  spanProcessors.push(new BatchSpanProcessor(otlpExporter));

  // Also export directly to Azure Monitor (backup path)
  const aiConnectionString =
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING;
  if (aiConnectionString) {
    const azureExporter = new AzureMonitorTraceExporter({
      connectionString: aiConnectionString,
    });
    spanProcessors.push(new BatchSpanProcessor(azureExporter));
  }

  const provider = new NodeTracerProvider({
    resource,
    spanProcessors,
  });

  provider.register();

  console.log("[OTel] Server telemetry initialized");
}

/**
 * Create a traced span for telemetry event processing.
 */
export function traceEventIngestion(
  eventCount: number,
  fn: () => Promise<void>
): Promise<void> {
  const tracer = trace.getTracer("telemetry-api");
  return tracer.startActiveSpan("telemetry.ingest", async (span) => {
    span.setAttribute("telemetry.event_count", eventCount);
    try {
      await fn();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
